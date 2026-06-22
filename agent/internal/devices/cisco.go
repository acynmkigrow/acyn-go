package devices

func init() {
	cisco := Profile{
		// Cisco IOS / IOS-XE / NX-OS prompts: "Router>", "Router#", "Router(config)#", etc.
		Prompts: []string{"(config)#", "(config-if)#", "(config-vlan)#", "#", ">"},
		SaveCmd: "write memory",
		Hints: `Target: Cisco IOS / IOS-XE switch or router (Catalyst, ISR, ASR). NX-OS shares most of this syntax — confirm via 'show version' if unsure.
- Mode ladder: user EXEC '>' -> enable -> privileged '#' -> configure terminal -> '(config)#' -> end (back to '#').
- VLAN: vlan <id> / name <n> / exit
- Access port: interface GigabitEthernet0/<x> / switchport mode access / switchport access vlan <id>
- Trunk port: interface GigabitEthernet0/<x> / switchport trunk encapsulation dot1q / switchport mode trunk / switchport trunk allowed vlan <list>
- L3 SVI: interface vlan <id> / ip address <ip> <mask> / no shutdown
- Static route: ip route <net> <mask> <gw>
- ACL: ip access-list extended <name> / permit|deny ... / interface <if> / ip access-group <name> in|out
- OSPF: router ospf <pid> / network <net> <wild> area <id>
- Save: 'write memory' (or 'copy running-config startup-config').
- Read-only: 'show running-config', 'show ip interface brief', 'show vlan brief', 'show mac address-table'.
- FORBIDDEN unless user typed the same verb: reload, erase startup-config, write erase, delete /force, format flash:, no vlan <id> on production VLANs.
- Never invent interface names, IPs, ACLs. If missing, return commands:[] and ask in warning.`,
	}
	Register("cisco", cisco)
}
