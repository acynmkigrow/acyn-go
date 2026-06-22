package discover

import "strings"

// classify inspects a banner blob and returns (vendor, family).
// vendor is "huawei" or "" (unknown); family is "hg"|"olt"|"switch"|"gpon"|"".
func classify(banner string) (string, string) {
	if banner == "" {
		return "", ""
	}
	low := strings.ToLower(banner)

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

	// Family guesses, ordered specific → general.
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
