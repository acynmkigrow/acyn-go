package discover

import "strings"

// classify inspects a banner blob and returns (vendor, family).
// vendor: "huawei" | "mikrotik" | "" (unknown)
// family: huawei -> "hg"|"olt"|"switch"|"gpon"
//         mikrotik -> "mikrotik" (RouterOS) or "swos" (SwOS — CLI not supported)
func classify(banner string) (string, string) {
	if banner == "" {
		return "", ""
	}
	low := strings.ToLower(banner)

	// MikroTik markers (check first — they're very specific).
	mikrotikMarkers := []string{"rosssh", "mikrotik", "routeros", "router os"}
	for _, m := range mikrotikMarkers {
		if strings.Contains(low, m) {
			if strings.Contains(low, "swos") {
				return "mikrotik", "swos"
			}
			return "mikrotik", "mikrotik"
		}
	}
	// SwOS standalone (no "mikrotik" string but distinctive)
	if strings.Contains(low, "swos") {
		return "mikrotik", "swos"
	}

	// Cisco markers.
	ciscoMarkers := []string{"cisco", "ios software", "ios-xe", "nx-os", "catalyst", "nexus", "cisco-ios", " asa "}
	for _, m := range ciscoMarkers {
		if strings.Contains(low, m) {
			return "cisco", "cisco"
		}
	}

	// Huawei markers.
	huaweiMarkers := []string{"huawei", "echolife", "smartax", "hg8", "ma56", "ma58", "ar1200", "ar2200"}
	isHuawei := false
	for _, m := range huaweiMarkers {
		if strings.Contains(low, m) {
			isHuawei = true
			break
		}
	}
	if !isHuawei {
		return "", ""
	}
	switch {
	case containsAny(low, "ma5800", "ma5600", "ma56", "ma58", "olt", "smartax"):
		return "huawei", "olt"
	case containsAny(low, "s5700", "s6700", "s5731", "s5720", "switch"):
		return "huawei", "switch"
	case containsAny(low, "hg8", "echolife", "ont", "epon", "gpon"):
		return "huawei", "hg"
	default:
		return "huawei", ""
	}
}

func containsAny(s string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(s, n) {
			return true
		}
	}
	return false
}
