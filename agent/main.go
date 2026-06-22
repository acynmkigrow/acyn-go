package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/acyninnovation/acyn-go/internal/agent"
	"github.com/acyninnovation/acyn-go/internal/config"
	"github.com/acyninnovation/acyn-go/internal/ui"
)

// version is overridden at build time via -ldflags "-X main.version=..."
var version = "dev"

func main() {
	showVersion := flag.Bool("version", false, "print version and exit")
	debug := flag.Bool("debug", false, "dump raw device output for prompt debugging")
	sshLegacy := flag.Bool("ssh-legacy", false, "enable legacy SSH key exchange algorithms")
	configureIP := flag.String("ip", "", "device IP (non-interactive mode)")
	profile := flag.String("profile", "", "device profile (hg|gpon|xpon|olt)")
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
