// Package config defines the live session configuration for ACYN-Go.
package config

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/acyninnovation/acyn-go/internal/discover"
)

// Session holds the live connection parameters supplied by the user at startup.
type Session struct {
	IP         string
	Port       int
	Protocol   string // "telnet" or "ssh"
	Username   string
	Password   string
	DeviceType string // "hg" | "gpon" | "xpon" | "olt" | "switch"
	Debug      bool
	SSHLegacy  bool
}

// FromPromptOrFlags builds a Session from CLI flags, falling back to an
// interactive prompt for missing fields. If the user provides no IP, an
// auto-discovery sweep is offered.
func FromPromptOrFlags(ipFlag, profileFlag string) *Session {
	r := bufio.NewReader(os.Stdin)
	ip := ipFlag
	defProto := "telnet"
	defPort := "23"
	defType := profileFlag
	if defType == "" {
		defType = "hg"
	}

	if ip == "" {
		picked := offerDiscovery(r)
		if picked != nil {
			ip = picked.IP
			if picked.Suggested.Protocol != "" {
				defProto = picked.Suggested.Protocol
			}
			if picked.Suggested.Port > 0 {
				defPort = strconv.Itoa(picked.Suggested.Port)
			}
			if picked.Family != "" {
				defType = picked.Family
			}
		}
		if ip == "" {
			ip = ask(r, "Device IP", "")
		}
	}

	proto := ask(r, "Protocol (telnet/ssh)", defProto)
	if proto == "ssh" && defPort == "23" {
		defPort = "22"
	}
	portStr := ask(r, "Port", defPort)
	port, _ := strconv.Atoi(portStr)
	user := ask(r, "Username", "admin")
	pass := ask(r, "Password", "admin")
	dtype := profileFlag
	if dtype == "" {
		dtype = ask(r, "Device type (hg/gpon/xpon/olt/switch)", defType)
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

// offerDiscovery runs a LAN scan and lets the user pick a device.
// Returns nil if the user declines, the scan finds nothing, or the user
// chooses to type an IP manually.
func offerDiscovery(r *bufio.Reader) *discover.Device {
	ans := ask(r, "Discover devices on your network? (Y/n)", "y")
	if strings.HasPrefix(strings.ToLower(ans), "n") {
		return nil
	}
	for {
		fmt.Println("  Scanning your network (~8s)…")
		devs, _ := discover.Scan(context.Background())
		if len(devs) == 0 {
			fmt.Println("  No devices found. You can type the IP manually.")
			return nil
		}
		fmt.Println()
		fmt.Println("   #  IP               ports         guess")
		for i, d := range devs {
			ports := ""
			for _, p := range d.OpenPorts {
				ports += fmt.Sprintf("%d ", p)
			}
			guess := "unknown"
			if d.Vendor == "huawei" {
				if d.Family != "" {
					guess = "Huawei " + strings.ToUpper(d.Family)
				} else {
					guess = "Huawei"
				}
			}
			fmt.Printf("  %2d  %-15s  %-12s  %s\n", i+1, d.IP, strings.TrimSpace(ports), guess)
		}
		fmt.Println()
		choice := ask(r, "Pick # (or 'r' to rescan, or type an IP)", "1")
		if strings.EqualFold(choice, "r") {
			continue
		}
		if n, err := strconv.Atoi(choice); err == nil && n >= 1 && n <= len(devs) {
			d := devs[n-1]
			return &d
		}
		// User typed an IP directly.
		return &discover.Device{IP: choice}
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
