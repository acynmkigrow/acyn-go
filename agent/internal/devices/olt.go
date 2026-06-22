package devices

func init() {
	Register("olt", Profile{
		Prompts: []string{">", "#", ")#"},
		SaveCmd: "save",
		Hints: `Target: Huawei MA5600/MA5800-series OLT.
- 'enable' then 'config' to reach configuration mode.
- VLAN creation: 'vlan <id> smart'.
- Port binding: 'port vlan <id> 0/<slot>/<port>'.
- ONT provisioning lives under 'interface gpon 0/<slot>'.
- Use 'display ont info ...' for status, 'ont reset 0/<slot>/<port> <ont-id>' to reboot.
- Backup: 'save configuration data backup-filename cfg_bk'.`,
	})
}
