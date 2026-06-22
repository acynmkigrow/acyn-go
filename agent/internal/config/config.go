// Package config defines the live session configuration for ACYN-Go.
package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Session holds the live connection parameters supplied by the user at startup.
type Session struct {
	IP         string
	Port       int
	Protocol   string // "telnet" or "ssh"
	Username   string
	Password   string
	DeviceType string // "hg" | "gpon" | "xpon" | "olt"
	Debug      bool
	SSHLegacy  bool
}

// FromPromptOrFlags builds a Session from CLI flags, falling back to an
// interactive PowerShell-style prompt for missing fields.
func FromPromptOrFlags(ipFlag, profileFlag string) *Session {
	r := bufio.NewReader(os.Stdin)
	ip := ipFlag
	if ip == "" {
		ip = ask(r, "Device IP", "")
	}
	proto := ask(r, "Protocol (telnet/ssh)", "telnet")
	defPort := "23"
	if proto == "ssh" {
		defPort = "22"
	}
	portStr := ask(r, "Port", defPort)
	port, _ := strconv.Atoi(portStr)
	user := ask(r, "Username", "admin")
	pass := ask(r, "Password", "admin")
	dtype := profileFlag
	if dtype == "" {
		dtype = ask(r, "Device type (hg/gpon/xpon/olt)", "hg")
	}
	return &Session{
		IP:         ip,
		Port:       port,
		Protocol:   strings.ToLower(proto),
		Username:   user,
		Password:   pass,
		DeviceType: strings.ToLower(dtype),
	}
}

func ask(r *bufio.Reader, label, def string) string {
	if def != "" {
		fmt.Printf("%s [%s]: ", label, def)
	} else {
		fmt.Printf("%s: ", label)
	}
	line, _ := r.ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return def
	}
	return line
}
