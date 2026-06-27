// Package agent — device fingerprint helpers.
//
// After a successful connect, Fingerprint runs a short, read-only batch of
// vendor commands and returns the parsed facts (model, firmware, free
// interfaces, VLAN list, WAN mode, …). Failures are non-fatal: any command
// that errors is simply skipped. The console feeds these facts back into the
// AI planner so it can use real interface names instead of <placeholders>.
package agent

import (
	"strings"

	"github.com/acyninnovation/acyn-go/internal/transport"
)

// Fingerprint runs a family-specific read-only batch and returns compact facts.
// Each value is capped to keep the device hello message small.
func Fingerprint(conn transport.Conn, family string) map[string]string {
	out := map[string]string{}
	if conn == nil {
		return out
	}

	type probe struct {
		key string
		cmd string
		max int
	}
	var probes []probe

	switch strings.ToLower(family) {
	case "olt":
		probes = []probe{
			{"version", "display version", 400},
			{"board", "display board 0", 600},
			{"vlan", "display vlan all", 600},
			{"autofind", "display ont autofind all", 800},
		}
	case "switch":
		probes = []probe{
			{"version", "display version", 400},
			{"device", "display device", 400},
			{"interfaces", "display interface brief", 1200},
			{"vlan", "display vlan brief", 600},
		}
	case "hg", "gpon", "xpon":
		probes = []probe{
			{"version", "display version", 400},
			{"wan", "display wan-info", 600},
			{"wlan", "display wlan ap-profile all", 600},
		}
	case "mikrotik":
		probes = []probe{
			{"identity", "/system identity print", 200},
			{"resource", "/system resource print", 400},
			{"routerboard", "/system routerboard print", 400},
			{"interfaces", "/interface print", 1200},
			{"addresses", "/ip address print", 600},
			{"bridges", "/interface bridge print", 400},
			{"vlans", "/interface vlan print", 600},
		}
	case "cisco":
		probes = []probe{
			{"version", "show version", 500},
			{"inventory", "show inventory", 500},
			{"interfaces", "show ip interface brief", 1200},
			{"vlan", "show vlan brief", 600},
		}
	default:
		return out
	}

	for _, p := range probes {
		text, err := conn.Send(p.cmd)
		if err != nil || text == "" {
			continue
		}
		text = strings.TrimSpace(text)
		if len(text) > p.max {
			text = text[:p.max] + "…"
		}
		out[p.key] = text
	}
	return out
}
