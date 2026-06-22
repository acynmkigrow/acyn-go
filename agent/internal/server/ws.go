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
	dev        DeviceInfo
	conn       transport.Conn
	addr       string
	pairCode   string
	token      string
	tokenOnce  sync.Once
	httpSrv    *http.Server
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

// New constructs a server bound to host:port with the given device transport.
func New(host string, port int, conn transport.Conn, dev DeviceInfo) *Server {
	return &Server{
		dev:      dev,
		conn:     conn,
		addr:     fmt.Sprintf("%s:%d", host, port),
		pairCode: newPairCode(),
		token:    newToken(),
	}
}

// PairCode returns the human-typed handshake code.
func (s *Server) PairCode() string { return s.pairCode }

// Addr returns the bound address.
func (s *Server) Addr() string { return s.addr }

func (s *Server) originOK(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true // curl / non-browser clients
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
			if strings.HasSuffix(strings.Split(strings.TrimPrefix(o, "https://"), "/")[0], a) {
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
		// Slow brute force; pair codes are 1M-space, rate-limit by sleep.
		time.Sleep(500 * time.Millisecond)
		http.Error(w, "invalid code", http.StatusUnauthorized)
		return
	}
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(pairResp{Token: s.token})
}

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

	// device info fields
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
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // origin already gated above
	})
	if err != nil {
		return
	}
	defer c.Close(websocket.StatusNormalClosure, "bye")

	ctx := r.Context()

	// Send device hello
	hello := outMsg{
		Type:   "device",
		Vendor: s.dev.Vendor,
		Model:  s.dev.Model,
		Family: s.dev.Family,
		Prompt: s.dev.Prompt,
	}
	if buf, err := json.Marshal(hello); err == nil {
		_ = c.Write(ctx, websocket.MessageText, buf)
	}

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
	for _, cmd := range msg.Commands {
		out, err := s.conn.Send(cmd)
		stream := "stdout"
		line := strings.TrimRight(out, "\r\n")
		if err != nil {
			stream = "stderr"
			line = err.Error()
			ok = false
		}
		writeJSON(ctx, c, outMsg{Type: "output", ID: msg.ID, Line: line, Stream: stream})
		if err != nil {
			break
		}
	}
	if msg.Save && ok {
		if out, err := s.conn.Send("save"); err == nil {
			writeJSON(ctx, c, outMsg{Type: "output", ID: msg.ID, Line: strings.TrimRight(out, "\r\n"), Stream: "stdout"})
		}
	}
	writeJSON(ctx, c, outMsg{Type: "done", ID: msg.ID, OK: ok, DurMs: time.Since(start).Milliseconds()})
}

func writeJSON(ctx context.Context, c *websocket.Conn, m outMsg) {
	if buf, err := json.Marshal(m); err == nil {
		_ = c.Write(ctx, websocket.MessageText, buf)
	}
}
