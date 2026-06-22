package devices

func init() {
	gpon := Profile{
		Prompts: []string{">", "#"},
		SaveCmd: "save",
		Hints: `Target: GPON/XPON ONT (bridge or router mode).
- 'configure terminal' enters config mode.
- 'wan-ip-connection' configures uplink, supports pppoe / dhcp / static.
- Use 'vlan <id>' inside the wan profile to tag uplink.
- Always 'save' before disconnecting.`,
	}
	Register("gpon", gpon)
	Register("xpon", gpon)
}
