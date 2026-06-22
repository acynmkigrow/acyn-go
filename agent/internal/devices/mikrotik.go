package devices

func init() {
	Register("mikrotik", Profile{
		// RouterOS shell prompts: "[admin@MikroTik] > " or "<name>] > "
		Prompts: []string{"] > ", "] >", "> "},
		SaveCmd: "", // RouterOS auto-persists; no explicit save command
		Hints: `Target: MikroTik RouterOS (v6/v7) — CCR, CRS (in RouterOS mode), RB, hAP, cAP, wAP, Chateau.
- One statement per line. Use ';' to chain multiple on one line. NO 'enable', NO 'config', NO 'save' — RouterOS auto-persists.
- Hierarchical paths start with '/': '/system identity set name=...', '/ip address add ...'.
- Prefer v7 syntax (rewritten /routing engine, native wireguard). For v6 fallback the user must say so.
- Hardening: '/ip service set ssh port=<n>'; '/ip service set telnet,ftp,www,api,api-ssl disabled=yes'; '/user add name=<u> group=full password="<pw>"'; '/ip ssh set strong-crypto=yes host-key-type=ed25519 allow-none-crypto=no'.
- L2: '/interface bridge add name=BR vlan-filtering=yes'; '/interface bridge port add bridge=BR interface=etherN pvid=<vid>'; '/interface vlan add name=VLAN<id> interface=BR vlan-id=<id>'.
- L3/edge: '/ip address add address=<cidr> interface=<if>'; '/ip route add gateway=<gw>'; '/ip pool add name=<p> ranges=<a>-<b>'; '/ip dhcp-server add address-pool=<p> interface=<if> name=<n> disabled=no'; '/ip dhcp-server network add address=<cidr> dns-server=<dns> gateway=<gw>'; '/ip firewall nat add chain=srcnat action=masquerade out-interface=<wan>'.
- WireGuard (v7): '/interface wireguard add name=wg0 listen-port=51820 private-key="<priv>"'; '/interface wireguard peers add interface=wg0 public-key="<pub>" allowed-address=<cidr> endpoint-address=<ip> endpoint-port=51820'; '/ip address add interface=wg0 address=<cidr>'.
- RADIUS: '/radius add service=login,hotspot,ppp address=<ip> secret="<s>"'; '/user aaa set use-radius=yes'; for hotspot bind via '/ip hotspot profile set <p> use-radius=yes'.
- SMS (LTE/Chateau): '/tool sms send <lte-if> phone-number=<num> message="<text>"'; '/tool sms inbox print'; '/interface lte set <if> apn-profiles=<p>'.
- Hotspot: '/ip hotspot setup' is interactive — emit explicit '/ip hotspot add' / '/ip hotspot profile add' / '/ip pool add' instead.
- PPP secrets: '/ppp secret add name=<u> password=<pw> service=pppoe profile=<prof>'.
- Queues: '/queue simple add name=<n> target=<cidr> max-limit=<up>/<down>'.
- Read-only listing: 'print', 'print detail', 'export compact'. Never invent print filters.
- FORBIDDEN unless the user typed the same verb: /system reset-configuration, /system reboot, /system shutdown, /file remove, /user remove admin, '/interface remove', /system routerboard reset-configuration, /ip firewall filter remove [find], unfiltered 'remove [find]'.
- Never invent IPs, interfaces, secrets, SSIDs, MACs. If missing, return commands:[] and ask in warning.`,
	})
}
