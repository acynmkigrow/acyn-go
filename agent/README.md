# ACYN-Go

> AI-Powered Huawei Device Configuration Agent · GPON · XPON · OLT · HG · PowerShell · SSH / Telnet

A single Go binary that lets you configure Huawei networking gear (HG routers, GPON/XPON ONTs, MA5600/5800 OLTs) by typing plain-English instructions. The agent translates intent into vendor-specific CLI commands, asks for confirmation, then applies them over SSH or Telnet.

## Install (Windows, one line)

```powershell
iwr -useb https://go.acyninnovation.com/install.ps1 | iex
```

Linux / macOS: download the matching archive from [Releases](https://github.com/acyninnovation/acyn-go/releases) and drop the binary on your `PATH`.

## Configure the AI provider

```powershell
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY","YOUR_KEY","User")
# or
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY","YOUR_KEY","User")
```

Grab a free Gemini key at <https://aistudio.google.com>.

## Run

```text
$ acyn-go
Device IP: 192.168.1.1
Protocol (telnet/ssh) [telnet]: ssh
Port [22]:
Username [admin]: admin
Password: ********
Device type (hg/gpon/xpon/olt) [hg]: olt

■ Connected!
acyn-go> Create VLAN 100 for management and bind it to uplink port 0/19/0
```

## Build from source

```bash
git clone https://github.com/acyninnovation/acyn-go
cd acyn-go
go mod tidy
go build -ldflags='-s -w' -o acyn-go .
```

## Layout

```
acyn-go/
├── main.go
└── internal/
    ├── config/        Session config + interactive prompts
    ├── transport/     Telnet + SSH connectors (shared interface)
    ├── devices/       Per-device-family profiles & prompts
    ├── agent/         LLM orchestration + plan/execute loop
    │   └── llm/       Gemini + OpenAI providers
    └── ui/            Banner, plan rendering, session logger
```

Sessions are logged to `~/.acyn-go/sessions/`.

## Extending

Add a new device family by dropping a file in `internal/devices/`:

```go
package devices

func init() {
    Register("mikrotik", Profile{
        Prompts: []string{"] >"},
        SaveCmd: "/system backup save",
        Hints:   "Target: MikroTik RouterOS. Use '/ip address ...' for L3.",
    })
}
```

## License

MIT © ACYN Innovation. See [LICENSE](./LICENSE).

Contact: <info@acyninnovation.com> · Maintainer: <okelojnr@acyninnovation.com>
