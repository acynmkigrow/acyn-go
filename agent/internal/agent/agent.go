package agent

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/acyninnovation/acyn-go/internal/agent/llm"
	"github.com/acyninnovation/acyn-go/internal/config"
	"github.com/acyninnovation/acyn-go/internal/devices"
	"github.com/acyninnovation/acyn-go/internal/transport"
	"github.com/acyninnovation/acyn-go/internal/ui"
)

// Agent wires a device transport and an LLM provider together and exposes a REPL.
type Agent struct {
	sess *config.Session
	conn transport.Conn
	brain llm.Provider
	log  *ui.SessionLogger
}

// New connects to the device and initialises the LLM provider.
func New(ctx context.Context, sess *config.Session) (*Agent, error) {
	prof := devices.Get(sess.DeviceType)

	var conn transport.Conn
	var err error
	switch sess.Protocol {
	case "ssh":
		conn, err = transport.DialSSH(sess.IP, sess.Port, sess.Username, sess.Password, prof.Prompts, sess.SSHLegacy)
	case "telnet":
		conn, err = transport.DialTelnet(sess.IP, sess.Port, sess.Username, sess.Password, prof.Prompts)
	default:
		return nil, fmt.Errorf("unknown protocol %q", sess.Protocol)
	}
	if err != nil {
		return nil, err
	}

	brain, err := pickProvider(ctx)
	if err != nil {
		_ = conn.Close()
		return nil, err
	}

	log, _ := ui.NewSessionLogger(sess.IP)
	return &Agent{sess: sess, conn: conn, brain: brain, log: log}, nil
}

func pickProvider(ctx context.Context) (llm.Provider, error) {
	if k := os.Getenv("GEMINI_API_KEY"); k != "" {
		return llm.NewGemini(ctx, k)
	}
	if k := os.Getenv("OPENAI_API_KEY"); k != "" {
		return llm.NewOpenAI(k)
	}
	return nil, errors.New("set GEMINI_API_KEY or OPENAI_API_KEY")
}

// REPL runs the interactive prompt loop until the user types quit/exit.
func (a *Agent) REPL(ctx context.Context) error {
	ui.Connected()
	r := bufio.NewScanner(os.Stdin)
	system := buildSystemPrompt(a.sess.DeviceType)
	for {
		fmt.Print("acyn-go> ")
		if !r.Scan() {
			return nil
		}
		input := strings.TrimSpace(r.Text())
		switch input {
		case "":
			continue
		case "quit", "exit":
			return nil
		}

		start := time.Now()
		plan, err := a.brain.Plan(ctx, system, input)
		if err != nil {
			ui.Errorf("planning failed: %v", err)
			continue
		}
		ui.RenderPlan(plan.Description, plan.Warning, plan.Commands)
		if !ui.Confirm("Proceed? [y/N]: ") {
			fmt.Println("Aborted.")
			continue
		}

		for _, cmd := range plan.Commands {
			out, err := a.conn.Send(cmd)
			if a.sess.Debug {
				fmt.Println(out)
			}
			a.log.Record(cmd, out, err)
			if err != nil {
				ui.Errorf("  > %s   [ERR] %v", cmd, err)
				break
			}
			ui.OK("  > " + cmd)
		}
		fmt.Printf("■ Done in %s.\n\n", time.Since(start).Round(time.Millisecond))
	}
}

// Close releases the device transport, LLM client and session log.
func (a *Agent) Close() {
	if a.conn != nil {
		_ = a.conn.Close()
	}
	if a.brain != nil {
		_ = a.brain.Close()
	}
	if a.log != nil {
		_ = a.log.Close()
	}
}
