// Package cmd hosts CLI subcommands. The `serve` command starts the local
// WebSocket bridge that pairs with the ACYN-Go web console.
package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/acyninnovation/acyn-go/internal/config"
	"github.com/acyninnovation/acyn-go/internal/devices"
	"github.com/acyninnovation/acyn-go/internal/server"
	"github.com/acyninnovation/acyn-go/internal/transport"
)

// RunServe starts the WS bridge. When sess is non-nil it eagerly dials the
// device; when sess is nil it starts with no device and waits for the web
// console to call POST /connect (--web mode).
func RunServe(ctx context.Context, sess *config.Session, host string, port int) error {
	var conn transport.Conn
	var dev server.DeviceInfo

	if sess != nil {
		prof := devices.Get(sess.DeviceType)
		var err error
		switch sess.Protocol {
		case "ssh":
			conn, err = transport.DialSSH(sess.IP, sess.Port, sess.Username, sess.Password, prof.Prompts, sess.SSHLegacy)
		default:
			conn, err = transport.DialTelnet(sess.IP, sess.Port, sess.Username, sess.Password, prof.Prompts)
		}
		if err != nil {
			return fmt.Errorf("device connect: %w", err)
		}
		dev = server.DeviceInfo{
			Vendor: "huawei",
			Model:  sess.DeviceType,
			Family: sess.DeviceType,
			Prompt: firstPrompt(prof.Prompts),
		}
	}

	srv := server.New(host, port, conn, dev)
	defer func() {
		if conn != nil {
			_ = conn.Close()
		}
	}()

	deepLink := fmt.Sprintf(
		"https://go.acyninnovation.com/console?pair=%s&host=%s&port=%d",
		srv.PairCode(), host, port,
	)
	fmt.Println()
	fmt.Println("┌────────────────────────────────────────────────────────────┐")
	fmt.Printf("│  Pairing code: %s                                       │\n", srv.PairCode())
	fmt.Printf("│  Listening on ws://%s                              │\n", srv.Addr())
	fmt.Println("│                                                            │")
	fmt.Println("│  Click to auto-pair this browser:                          │")
	fmt.Printf("│  %s\n", deepLink)
	fmt.Println("│  (or paste the 6-digit code in the console)                │")
	if sess == nil {
		fmt.Println("│                                                            │")
		fmt.Println("│  No device attached — discover & connect from the browser. │")
	}
	fmt.Println("└────────────────────────────────────────────────────────────┘")
	fmt.Println()

	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer cancel()
	return srv.Serve(ctx)
}

func firstPrompt(p []string) string {
	if len(p) == 0 {
		return "#"
	}
	return p[0]
}
