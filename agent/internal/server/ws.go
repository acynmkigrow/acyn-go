// Package server exposes the locally-bound WebSocket bridge that the ACYN-Go
// web console connects to. All traffic is loopback by default; --lan widens
// the bind to 0.0.0.0. Auth is a one-shot 6-digit pairing code that mints a
// long-lived session token for the WS upgrade.
package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/acyninnovation/acyn-go/internal/devices"
	"github.com/acyninnovation/acyn-go/internal/discover"
	"github.com/acyninnovation/acyn-go/internal/transport"

	"nhooyr.io/websocket"
)

type DeviceInfo struct {
	Vendor string `json:"vendor"`
	Model  string `json:"model"`
	Family string `json:"family"`
	Prompt string `json:"prompt"`
}

type Server struct {
	mu       sync.RWMutex
	dev      DeviceInfo
	conn     transport.Conn
	addr     string
	pairCode string
	token    string
	httpSrv  *http.Server
}

func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func newPairCode() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	n := (int(b[0])<<16 | int(b[1])<<8 | int(b[2])) % 1000000
	return fmt.Sprintf("%06d", n)
}

// New constructs a server bound to host:port. conn may be nil — the device
// can be attached later via POST /connect from the web console.
func New(host string, port int, conn transport.Conn, dev DeviceInfo) *Server {
	return &Server{
		dev:      dev,
		conn:     conn,
		addr:     fmt.Sprintf("%s:%d", host, port),
		pairCode: newPairCode(),
		token:    newToken(),
	}
}

func (s *Server) PairCode() string { return s.pairCode }
func (s *Server) Addr() string     { return s.addr }

func (s *Server) currentConn() transport.Conn {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.conn
}

func (s *Server) currentDevice() DeviceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dev
}

func (s *Server) swapDevice(conn transport.Conn, dev DeviceInfo) {
	s.mu.Lock()
	old := s.conn
	s.conn = conn
	s.dev = dev
	s.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
}

func (s *Server) originOK(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	allow := []string{
		"http://localhost", "https://localhost",
		"http://127.0.0.1",
		"https://go.acyninnovation.com",
		"https://acyninnovation.com",
		"https://www.acyninnovation.com",
		".lovable.app",
		".lovableproject.com",
	}
	for _, a := range allow {
		if strings.HasPrefix(a, ".") {
			if strings.HasSuffix(strings.Split(strings.TrimPrefix(strings.TrimPrefix(o, "https://"), "http://"), "/")[0], a) {
				return true
			}
		} else if strings.HasPrefix(o, a) {
			return true
		}
	}
	return false
}

// Serve blocks until ctx is canceled or the server errors.
func (s *Server) Serve(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/pair", s.handlePair)
	mux.HandleFunc("/discover", s.handleDiscover)
	mux.HandleFunc("/connect", s.handleConnect)
	mux.HandleFunc("/session", s.handleSession)

	s.httpSrv = &http.Server{
		Addr:              s.addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ln, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}
	errCh := make(chan error, 1)
	go func() { errCh <- s.httpSrv.Serve(ln) }()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		return s.httpSrv.Shutdown(shutdownCtx)
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "content-type")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// ------------------------- /pair -------------------------

type pairReq struct {
	Code string `json:"code"`
}
type pairResp struct {
	Token string `json:"token"`
}

func (s *Server) handlePair(w http.ResponseWriter, r *http.Request) {
	if !s.originOK(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	var req pairReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.Code != s.pairCode {
		time.Sleep(500 * time.Millisecond)
		http.Error(w, "invalid code", http.StatusUnauthorized)
		return
	}
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(pairResp{Token: s.token})
}

// ------------------------- /discover -------------------------

func (s *Server) handleDiscover(w http.ResponseWriter, r *http.Request) {
	if !s.originOK(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	if r.URL.Query().Get("token") != s.token {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	devs, _ := discover.Scan(r.Context())
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"devices": devs})
}

// ------------------------- /connect -------------------------

type connectReq struct {
	IP        string `json:"ip"`
	Port      int    `json:"port"`
	Protocol  string `json:"protocol"` // "ssh" | "telnet"
	Username  string `json:"username"`
	Password  string `json:"password"`
	Family    string `json:"family"`
	SSHLegacy bool   `json:"sshLegacy"`
}

type connectResp struct {
	OK     bool       `json:"ok"`
	Error  string     `json:"error,omitempty"`
	Device DeviceInfo `json:"device,omitempty"`
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request) {
	if !s.originOK(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	if r.URL.Query().Get("token") != s.token {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	var req connectReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONResp(w, http.StatusBadRequest, connectResp{Error: "bad json"})
		return
	}
	if req.IP == "" || req.Family == "" {
		writeJSONResp(w, http.StatusBadRequest, connectResp{Error: "ip and family required"})
		return
	}
	if req.Port == 0 {
		if strings.EqualFold(req.Protocol, "ssh") {
			req.Port = 22
		} else {
			req.Port = 23
		}
	}
	if req.Username == "" {
		req.Username = "admin"
	}

	prof := devices.Get(req.Family)
	var conn transport.Conn
	var err error
	if strings.EqualFold(req.Protocol, "ssh") {
		conn, err = transport.DialSSH(req.IP, req.Port, req.Username, req.Password, prof.Prompts, req.SSHLegacy)
	} else {
		conn, err = transport.DialTelnet(req.IP, req.Port, req.Username, req.Password, prof.Prompts)
	}
	if err != nil {
		writeJSONResp(w, http.StatusBadGateway, connectResp{Error: err.Error()})
		return
	}

	vendor := "huawei"
	switch req.Family {
	case "mikrotik":
		vendor = "mikrotik"
	case "cisco":
		vendor = "cisco"
	case "swos":
		_ = conn.Close()
		writeJSONResp(w, http.StatusBadRequest, connectResp{Error: "SwOS devices have no CLI — manage via the web UI."})
		return
	}
	dev := DeviceInfo{
		Vendor: vendor,
		Model:  req.Family,
		Family: req.Family,
		Prompt: firstPromptStr(prof.Prompts),
	}
	s.swapDevice(conn, dev)
	writeJSONResp(w, http.StatusOK, connectResp{OK: true, Device: dev})
}

func firstPromptStr(p []string) string {
	if len(p) == 0 {
		return "#"
	}
	return p[0]
}

func writeJSONResp(w http.ResponseWriter, code int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

// ------------------------- /session (WS) -------------------------

type execMsg struct {
	Type     string   `json:"type"`
	ID       string   `json:"id"`
	Commands []string `json:"commands"`
	Save     bool     `json:"save"`
}

type outMsg struct {
	Type   string `json:"type"`
	ID     string `json:"id,omitempty"`
	Line   string `json:"line,omitempty"`
	Stream string `json:"stream,omitempty"`
	OK     bool   `json:"ok,omitempty"`
	DurMs  int64  `json:"durationMs,omitempty"`

	Vendor string `json:"vendor,omitempty"`
	Model  string `json:"model,omitempty"`
	Family string `json:"family,omitempty"`
	Prompt string `json:"prompt,omitempty"`
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("token") != s.token {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	defer c.Close(websocket.StatusNormalClosure, "bye")

	ctx := r.Context()

	// Push current device hello (may be empty if no device attached yet).
	dev := s.currentDevice()
	if dev.Family != "" {
		hello := outMsg{
			Type:   "device",
			Vendor: dev.Vendor,
			Model:  dev.Model,
			Family: dev.Family,
			Prompt: dev.Prompt,
		}
		if buf, err := json.Marshal(hello); err == nil {
			_ = c.Write(ctx, websocket.MessageText, buf)
		}
	}

	// Watch for device swaps and re-hello.
	lastFamily := dev.Family
	stopWatch := make(chan struct{})
	go func() {
		t := time.NewTicker(500 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-stopWatch:
				return
			case <-ctx.Done():
				return
			case <-t.C:
				d := s.currentDevice()
				if d.Family != lastFamily && d.Family != "" {
					lastFamily = d.Family
					hello := outMsg{Type: "device", Vendor: d.Vendor, Model: d.Model, Family: d.Family, Prompt: d.Prompt}
					if buf, err := json.Marshal(hello); err == nil {
						_ = c.Write(ctx, websocket.MessageText, buf)
					}
				}
			}
		}
	}()
	defer close(stopWatch)

	for {
		_, data, err := c.Read(ctx)
		if err != nil {
			return
		}
		var msg execMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		if msg.Type != "exec" {
			continue
		}
		s.runBatch(ctx, c, msg)
	}
}

func (s *Server) runBatch(ctx context.Context, c *websocket.Conn, msg execMsg) {
	start := time.Now()
	ok := true
	conn := s.currentConn()
	if conn == nil {
		writeWS(ctx, c, outMsg{Type: "output", ID: msg.ID, Line: "no device attached — connect one first", Stream: "stderr"})
		writeWS(ctx, c, outMsg{Type: "done", ID: msg.ID, OK: false, DurMs: 0})
		return
	}
	for _, cmd := range msg.Commands {
		out, err := conn.Send(cmd)
		stream := "stdout"
		line := strings.TrimRight(out, "\r\n")
		if err != nil {
			stream = "stderr"
			line = err.Error()
			ok = false
		}
		writeWS(ctx, c, outMsg{Type: "output", ID: msg.ID, Line: line, Stream: stream})
		if err != nil {
			break
		}
	}
	if msg.Save && ok {
		saveCmd := devices.Get(s.currentDevice().Family).SaveCmd
		if saveCmd != "" {
			if out, err := conn.Send(saveCmd); err == nil {
				writeWS(ctx, c, outMsg{Type: "output", ID: msg.ID, Line: strings.TrimRight(out, "\r\n"), Stream: "stdout"})
			}
		}
	}
	writeWS(ctx, c, outMsg{Type: "done", ID: msg.ID, OK: ok, DurMs: time.Since(start).Milliseconds()})
}

func writeWS(ctx context.Context, c *websocket.Conn, m outMsg) {
	if buf, err := json.Marshal(m); err == nil {
		_ = c.Write(ctx, websocket.MessageText, buf)
	}
}
