package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/acyninnovation/acyn-go/cmd"
	"github.com/acyninnovation/acyn-go/internal/agent"
	"github.com/acyninnovation/acyn-go/internal/config"
	"github.com/acyninnovation/acyn-go/internal/ui"
)

// version is overridden at build time via -ldflags "-X main.version=..."
var version = "v1.0.9"

func main() {
	// Subcommand: acyn-go serve [--lan] [--port N]
	if len(os.Args) > 1 && os.Args[1] == "serve" {
		runServe()
		return
	}

	showVersion := flag.Bool("version", false, "print version and exit")
	debug := flag.Bool("debug", false, "dump raw device output for prompt debugging")
	sshLegacy := flag.Bool("ssh-legacy", false, "enable legacy SSH key exchange algorithms")
	configureIP := flag.String("ip", "", "device IP (non-interactive mode)")
	profile := flag.String("profile", "", "device profile (hg|gpon|xpon|olt|switch)")
	flag.Parse()

	if *showVersion {
		fmt.Printf("acyn-go %s\n", version)
		return
	}

	ui.Banner(version)

	sess := config.FromPromptOrFlags(*configureIP, *profile)
	sess.Debug = *debug
	sess.SSHLegacy = *sshLegacy

	ag, err := agent.New(context.Background(), sess)
	if err != nil {
		fmt.Fprintf(os.Stderr, "■■ Failed to start: %v\n", err)
		os.Exit(1)
	}
	defer ag.Close()

	if err := ag.REPL(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "■■ Session error: %v\n", err)
		os.Exit(1)
	}
}

func runServe() {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	lan := fs.Bool("lan", false, "bind 0.0.0.0 instead of 127.0.0.1 (LAN access)")
	port := fs.Int("port", 17017, "TCP port for the WebSocket bridge")
	sshLegacy := fs.Bool("ssh-legacy", false, "enable legacy SSH key exchange algorithms")
	configureIP := fs.String("ip", "", "device IP (non-interactive mode)")
	profile := fs.String("profile", "", "device profile (hg|gpon|xpon|olt|switch|mikrotik|cisco)")
	cliMode := fs.Bool("cli", false, "force interactive CLI prompts (legacy)")
	noBrowser := fs.Bool("no-browser", false, "do not auto-open the web console")
	_ = fs.Parse(os.Args[2:])

	ui.Banner(version)

	// Default: web mode (no prompts). --cli opts back into the legacy interactive flow.
	var sess *config.Session
	if *cliMode || *configureIP != "" || *profile != "" {
		sess = config.FromPromptOrFlags(*configureIP, *profile)
		sess.SSHLegacy = *sshLegacy
	}

	host := "127.0.0.1"
	if *lan {
		host = "0.0.0.0"
	}
	if err := cmd.RunServe(context.Background(), sess, host, *port, !*noBrowser); err != nil {
		fmt.Fprintf(os.Stderr, "■■ serve: %v\n", err)
		os.Exit(1)
	}
}
