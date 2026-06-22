package devices

func init() {
	Register("hg", Profile{
		Prompts: []string{">", "#", "WAP>"},
		SaveCmd: "save",
		Hints: `Target: Huawei HG-series home gateway (HG8245H, HG8546M, etc.).
- Enter privileged mode with 'enable' if needed.
- WLAN config lives under 'interface wlan-radio 0/0/0'.
- Use 'wpa2-psk ascii <password>' for WPA2.
- Always end batches with 'quit' then 'save'.`,
	})
}
