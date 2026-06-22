package discover

import "testing"

func TestClassify(t *testing.T) {
	cases := []struct {
		name, banner, vendor, family string
	}{
		{"empty", "", "", ""},
		{"ssh-huawei-olt", "SSH-2.0-HUAWEI-1.5 MA5800", "huawei", "olt"},
		{"ssh-huawei-hg", "SSH-2.0-Huawei-1.5 HG8245H", "huawei", "hg"},
		{"telnet-switch", "Welcome to Huawei S5731", "huawei", "switch"},
		{"echolife-ont", "EchoLife HG8546M telnet", "huawei", "hg"},
		{"random-linux", "SSH-2.0-OpenSSH_8.4p1 Debian", "", ""},
		{"http-iis", "HTTP/1.1 200 OK\r\nServer: Microsoft-IIS/10.0", "", ""},
		{"mikrotik-ssh", "SSH-2.0-ROSSSH", "mikrotik", "mikrotik"},
		{"mikrotik-http", "HTTP/1.1 200 OK\r\nServer: Mikrotik HttpProxy", "mikrotik", "mikrotik"},
		{"mikrotik-routeros", "RouterOS 7.10 (stable) login:", "mikrotik", "mikrotik"},
		{"swos", "SwOS v2.16 login:", "mikrotik", "swos"},
		{"cisco-ssh", "SSH-2.0-Cisco-1.25", "cisco", "cisco"},
		{"cisco-catalyst", "Cisco IOS Software, Catalyst L3 Switch", "cisco", "cisco"},
		{"cisco-nxos", "Cisco NX-OS Software", "cisco", "cisco"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v, f := classify(c.banner)
			if v != c.vendor || f != c.family {
				t.Fatalf("got (%q,%q), want (%q,%q)", v, f, c.vendor, c.family)
			}
		})
	}
}

func TestSuggest(t *testing.T) {
	d := &Device{OpenPorts: []int{22, 80}}
	s := suggest(d)
	if s.Protocol != "ssh" || s.Port != 22 {
		t.Fatalf("expected ssh/22, got %+v", s)
	}
	d = &Device{OpenPorts: []int{23}}
	s = suggest(d)
	if s.Protocol != "telnet" || s.Port != 23 {
		t.Fatalf("expected telnet/23, got %+v", s)
	}
}

func TestIsPrivate(t *testing.T) {
	for _, ip := range []string{"10.0.0.1", "192.168.1.1", "172.16.0.1", "172.31.255.255"} {
		if !isPrivate(parse4(ip)) {
			t.Fatalf("%s should be private", ip)
		}
	}
	for _, ip := range []string{"8.8.8.8", "172.32.0.1", "169.254.1.1"} {
		if isPrivate(parse4(ip)) {
			t.Fatalf("%s should not be private", ip)
		}
	}
}

func parse4(s string) []byte {
	var b [4]byte
	var i, v int
	for k := 0; k < len(s); k++ {
		if s[k] == '.' {
			b[i] = byte(v)
			i++
			v = 0
			continue
		}
		v = v*10 + int(s[k]-'0')
	}
	b[i] = byte(v)
	return b[:]
}
