// Package discover performs a fast, dependency-free LAN sweep to find
// candidate Huawei network devices. It uses plain TCP dials + tiny banner
// reads — no raw sockets, no ARP, no admin rights — so it works on stock
// Windows without npcap/Wireshark.
package discover

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strings"
	"sync"
	"time"
)

// Device is one discovered host.
type Device struct {
	IP        string   `json:"ip"`
	OpenPorts []int    `json:"openPorts"`
	Vendor    string   `json:"vendor"`      // "huawei" | "unknown"
	Family    string   `json:"family"`      // "hg" | "olt" | "switch" | "gpon" | ""
	Banner    string   `json:"banner"`      // first line of whatever we read
	Suggested Suggest  `json:"suggested"`   // best-guess connection params
}

// Suggest are sane defaults for the picker.
type Suggest struct {
	Protocol string `json:"protocol"` // "ssh" | "telnet"
	Port     int    `json:"port"`
	Username string `json:"username"`
}

// Probe ports, ordered by how informative the banner is.
// 8728/8729 are MikroTik API/API-SSL — open ports alone are a strong vendor hint.
var probePorts = []int{22, 23, 80, 443, 8728, 8729}

// Scan sweeps every reachable RFC1918 /24 the host is attached to.
// Hard-capped at 8 seconds total. Safe to call repeatedly.
func Scan(ctx context.Context) ([]Device, error) {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	subnets := localSubnets()
	if len(subnets) == 0 {
		return nil, nil
	}

	type result struct {
		ip   string
		port int
		bann string
	}
	out := make(chan result, 256)

	// Producer: every host IP in every /24, every probe port.
	jobs := make(chan struct {
		ip   string
		port int
	}, 512)
	go func() {
		defer close(jobs)
		for _, sub := range subnets {
			for _, ip := range sub {
				for _, p := range probePorts {
					select {
					case <-ctx.Done():
						return
					case jobs <- struct {
						ip   string
						port int
					}{ip, p}:
					}
				}
			}
		}
	}()

	// Worker pool.
	var wg sync.WaitGroup
	const workers = 200
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				if ctx.Err() != nil {
					return
				}
				if banner, ok := probe(ctx, j.ip, j.port); ok {
					select {
					case out <- result{j.ip, j.port, banner}:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}
	go func() { wg.Wait(); close(out) }()

	// Aggregate by IP.
	byIP := map[string]*Device{}
	for r := range out {
		d, ok := byIP[r.ip]
		if !ok {
			d = &Device{IP: r.ip, Vendor: "unknown"}
			byIP[r.ip] = d
		}
		d.OpenPorts = append(d.OpenPorts, r.port)
		if d.Banner == "" && r.bann != "" {
			d.Banner = firstLine(r.bann)
		}
		if v, f := classify(r.bann); v != "" {
			d.Vendor = v
			if f != "" {
				d.Family = f
			}
		}
	}

	devices := make([]Device, 0, len(byIP))
	for _, d := range byIP {
		sort.Ints(d.OpenPorts)
		// Vendor inference fallback: MikroTik API ports open without other banner match.
		if d.Vendor == "unknown" {
			for _, p := range d.OpenPorts {
				if p == 8728 || p == 8729 {
					d.Vendor = "mikrotik"
					if d.Family == "" {
						d.Family = "mikrotik"
					}
					break
				}
			}
		}
		d.Suggested = suggest(d)
		devices = append(devices, *d)
	}
	// Known vendors first (huawei, mikrotik), then by IP.
	known := func(v string) bool { return v == "huawei" || v == "mikrotik" }
	sort.Slice(devices, func(i, j int) bool {
		if known(devices[i].Vendor) != known(devices[j].Vendor) {
			return known(devices[i].Vendor)
		}
		return ipLess(devices[i].IP, devices[j].IP)
	})
	return devices, nil
}

func probe(ctx context.Context, ip string, port int) (string, bool) {
	addr := net.JoinHostPort(ip, fmt.Sprintf("%d", port))
	dctx, cancel := context.WithTimeout(ctx, 400*time.Millisecond)
	defer cancel()
	var d net.Dialer
	conn, err := d.DialContext(dctx, "tcp", addr)
	if err != nil {
		return "", false
	}
	defer conn.Close()

	_ = conn.SetReadDeadline(time.Now().Add(600 * time.Millisecond))

	// Some services (HTTP, sometimes Telnet) wait for the client to speak first.
	// SSH/Telnet usually push a banner immediately; for HTTP we nudge with a HEAD.
	if port == 80 || port == 443 {
		_, _ = conn.Write([]byte("HEAD / HTTP/1.0\r\nHost: " + ip + "\r\nUser-Agent: acyn-go-discover/1\r\n\r\n"))
	}

	buf := make([]byte, 1024)
	n, _ := conn.Read(buf)
	return string(buf[:n]), true
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, "\r\n"); i >= 0 {
		return s[:i]
	}
	if len(s) > 200 {
		return s[:200]
	}
	return s
}

func suggest(d *Device) Suggest {
	has := func(p int) bool {
		for _, x := range d.OpenPorts {
			if x == p {
				return true
			}
		}
		return false
	}
	switch {
	case has(22):
		return Suggest{Protocol: "ssh", Port: 22, Username: "admin"}
	case has(23):
		return Suggest{Protocol: "telnet", Port: 23, Username: "admin"}
	default:
		return Suggest{Protocol: "ssh", Port: 22, Username: "admin"}
	}
}

// localSubnets returns one /24 of host IPs (network and broadcast skipped)
// per attached private interface, capped at 2 subnets / 512 IPs total.
func localSubnets() [][]string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var subnets [][]string
	seen := map[string]bool{}
	for _, ifc := range ifaces {
		if ifc.Flags&net.FlagUp == 0 || ifc.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := ifc.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			ipNet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil {
				continue
			}
			// Skip link-local 169.254/16.
			if ip4[0] == 169 && ip4[1] == 254 {
				continue
			}
			if !isPrivate(ip4) {
				continue
			}
			// Always treat as /24 around the host's IP to keep the
			// scan small and predictable on big /16 home setups.
			key := fmt.Sprintf("%d.%d.%d", ip4[0], ip4[1], ip4[2])
			if seen[key] {
				continue
			}
			seen[key] = true

			hosts := make([]string, 0, 254)
			for i := 1; i <= 254; i++ {
				if i == int(ip4[3]) {
					continue // skip ourselves
				}
				hosts = append(hosts, fmt.Sprintf("%s.%d", key, i))
			}
			subnets = append(subnets, hosts)
			if len(subnets) >= 2 {
				return subnets
			}
		}
	}
	return subnets
}

func isPrivate(ip net.IP) bool {
	switch {
	case ip[0] == 10:
		return true
	case ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31:
		return true
	case ip[0] == 192 && ip[1] == 168:
		return true
	}
	return false
}

func ipLess(a, b string) bool {
	pa, pb := net.ParseIP(a).To4(), net.ParseIP(b).To4()
	if pa == nil || pb == nil {
		return a < b
	}
	for i := 0; i < 4; i++ {
		if pa[i] != pb[i] {
			return pa[i] < pb[i]
		}
	}
	return false
}
