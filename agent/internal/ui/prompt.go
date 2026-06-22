// Package ui contains tiny presentation helpers for the CLI agent.
package ui

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Banner prints the splash header.
func Banner(version string) {
	bar := strings.Repeat("█", 42)
	fmt.Println()
	fmt.Println(bar)
	fmt.Printf("█  ACYN-Go  %-29s█\n", "v"+version)
	fmt.Println("█  AI-Powered Huawei Device Agent        █")
	fmt.Println(bar)
	fmt.Println()
}

// Connected prints the post-handshake hint block.
func Connected() {
	fmt.Println("\n■ Connected!")
	fmt.Println("Type your instruction in plain English. Type 'quit' to exit.")
	fmt.Println("Examples:")
	fmt.Println("  • Change WiFi password to MySecure99")
	fmt.Println("  • Show all connected clients")
	fmt.Println("  • Enable port forwarding 8080 → 192.168.1.50")
	fmt.Println()
}

// RenderPlan prints the LLM's proposed command batch.
func RenderPlan(desc, warning string, cmds []string) {
	fmt.Printf("\n■ Plan: %s\n", desc)
	if warning != "" {
		fmt.Printf("■■ Warning: %s\n", warning)
	}
	fmt.Println("Commands to execute:")
	for i, c := range cmds {
		fmt.Printf("  %d. %s\n", i+1, c)
	}
}

// Confirm reads a yes/no prompt from stdin.
func Confirm(prompt string) bool {
	fmt.Print(prompt)
	r := bufio.NewReader(os.Stdin)
	line, _ := r.ReadString('\n')
	line = strings.TrimSpace(strings.ToLower(line))
	return line == "y" || line == "yes"
}

// OK prints a success line.
func OK(msg string) { fmt.Printf("\x1b[32m%s   [OK]\x1b[0m\n", msg) }

// Errorf prints an error line.
func Errorf(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "\x1b[31m"+format+"\x1b[0m\n", a...)
}
