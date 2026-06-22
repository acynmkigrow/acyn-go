package devices

func init() {
	switchProfile := Profile{
		Prompts: []string{">", "]", "#"},
		SaveCmd: "save",
		Hints: `Target: Huawei S-series switch (S5700/S6700/S5731).
- Enter: system-view
- Create VLANs in a batch: vlan batch 10 20 30
- Access port:
    interface GigabitEthernet0/0/<x>
    port link-type access
    port default vlan <vid>
- Trunk port:
    interface GigabitEthernet0/0/<x>
    port link-type trunk
    port trunk allow-pass vlan <list>
- LACP: interface Eth-Trunk <N> -> mode lacp-static -> trunkport GigabitEthernet 0/0/<x> to 0/0/<y>
- Display: display vlan, display port vlan, display interface brief
- Save: 'save' then 'Y'
- NEVER emit: reset saved-configuration, clear configuration this, reboot.`,
	}
	Register("switch", switchProfile)
	Register("s", switchProfile)
}
