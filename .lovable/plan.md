# Subnet auto-discovery + first-router guided setup

Goal: a brand-new user runs `acyn-go` (or clicks **Discover** in the web console), the agent finds Huawei devices on the LAN, the user picks one, types/confirms credentials, and is paired and configuring inside ~60 seconds. Nothing already-working breaks.

## What changes

### 1. New `discover` package in the Go agent
`agent/internal/discover/scan.go` — pure Go, no extra deps.

- Enumerate local interfaces with `net.InterfaceAddrs()`, pick all RFC1918 IPv4 /24 subnets (skip loopback/docker/`169.254` link-local), cap at the first 2 subnets.
- For each candidate IP in those /24s, run a parallel TCP dial probe (250 workers, 400 ms timeout) on ports 22 (SSH), 23 (Telnet), 80, 443.
- On any open port, grab a tiny banner: 1024-byte read with a 600 ms deadline. Match against known signatures:
  - SSH banner contains `Huawei`, `HG`, `MA5`, `S57`, `S67` → vendor=Huawei + family guess (hg/olt/switch).
  - Telnet/HTTP banner contains `HG`, `Huawei`, `EchoLife`, `MA5800` → vendor=Huawei.
  - Otherwise return `vendor: "unknown"`, just port info — the user can still pick it.
- Return `[]Device{ IP, OpenPorts[], Vendor, FamilyGuess, Banner }`, sorted Huawei-first.
- Hard timeout for the whole scan: 8 seconds.

This is the only new Go code that touches the network. It's read-only TCP probes, no raw sockets, no ARP, no admin rights — works inside the Worker-safe Go subset and on stock Windows without `npcap`/Wireshark.

### 2. Wire discovery into the interactive CLI
`agent/internal/config/config.go`:

- When the user presses Enter on the `Device IP` prompt with no value, run `discover.Scan(ctx)` with a spinner ("Scanning your network…").
- Print a numbered table:
  ```
   #  IP              ports        guess
   1  192.168.1.1     22 80        Huawei HG (likely)
   2  192.168.100.1   23           Huawei OLT (likely)
   3  192.168.1.50    22           unknown
  ```
- Accept `1`-`N` to pick, `r` to rescan, or any IP to override. Pre-fill protocol (ssh if 22 open, telnet if 23) and device type from the guess; user still confirms.
- If discovery finds nothing, fall back to the existing manual prompt — zero regression.

### 3. New `discover` HTTP endpoint on the WS bridge
`agent/internal/server/ws.go`:

- Add `GET /discover` that runs the same scan and returns JSON. Same origin allow-list as `/pair`. Token NOT required — discovery results are not sensitive and the agent only binds 127.0.0.1 by default.
- Add `POST /connect` (token-gated) that lets the web console hand the agent `{ip, port, protocol, username, password, family}` to (re)open the device transport without restarting the process. This is the missing piece that turns the web wizard into "pick → fill creds → go".

### 4. Web console: Discover button + connect flow
- `PairingCard`: when paired but no device yet (rare race) or via a new "Find devices" affordance, call `GET http://host:port/discover`, render the list with a one-click "Use this".
- Selecting a device opens a small credentials modal (username/password, prefilled defaults `admin/admin`, protocol/port prefilled from open ports, family from guess), then `POST /connect` with the pair token.
- On success the existing WS `device` hello fires and the console is ready. No new state machine — reuses `useAgentSocket`.

### 5. First-router safety net
- The agent's existing destructive-command validator already blocks `reset`/`reboot`/etc. Keep that.
- Add a one-time "first config" banner in the chat when `command_runs` is empty for the user: links to the recipe chips and reminds them every command is shown for approval before it touches the device.
- The `EditablePlan` we just shipped already prevents running commands with unresolved `<placeholders>`.

### 6. Release + install validation
- Bump agent to `v1.0.7`, push tag, let the existing GoReleaser workflow publish.
- After release, run end-to-end smoke from a fresh Windows VM (or document the exact steps the user runs):
  1. `iwr -useb https://go.acyninnovation.com/install.ps1 | iex`
  2. `acyn-go --version` → `v1.0.7`
  3. `acyn-go serve` → prints pair code + deep-link
  4. Click deep-link → console pairs
  5. Click **Find devices** → list appears, pick one, enter creds, connected
  6. Click recipe "Show ONU autofind" (read-only) → device output appears

## Technical details

```text
agent/internal/discover/
   scan.go           // Scan(ctx) ([]Device, error), Device struct
   signatures.go     // banner regex → vendor/family
   scan_test.go      // table tests with stubbed dial fn

agent/internal/server/ws.go
   + handleDiscover  // GET /discover  (no token, origin-gated)
   + handleConnect   // POST /connect  (token-gated, swaps transport.Conn)

agent/internal/config/config.go
   FromPromptOrFlags now offers discovery on empty IP

agent/cmd/serve.go
   Banner unchanged; serve still works without --ip (uses discovery)

src/components/console/
   DiscoverPanel.tsx        // Find devices → list → credentials modal
   PairingCard.tsx          // adds "Find devices" button once paired
   useAgentSocket.ts        // adds connectDevice(creds) helper
```

Concurrency: scan uses `errgroup` + buffered worker channel (200-ish), bounded by `ctx` timeout. Each dial closes its own conn; nothing leaks if the user Ctrl-Cs.

Security:
- `/discover` is loopback-only by default (same bind as today). `--lan` widens it; document that in `serve --help`.
- `/connect` requires the pair token. Passwords are kept in agent memory only, never written to disk, never returned over the WS.

## Acceptance checklist (must all pass before claiming done)
- [ ] `go test ./agent/...` passes
- [ ] `goreleaser check` passes; release workflow goes green on `v1.0.7`
- [ ] Installer pulls `v1.0.7` and `acyn-go --version` reports it
- [ ] `acyn-go` with no flags discovers at least the local gateway and lets the user pick it
- [ ] Web console "Find devices" returns the same list and connects via `/connect`
- [ ] An end-to-end read-only command ("display version" or recipe equivalent) succeeds against the first device with zero manual IP typing
- [ ] None of the existing flows (manual IP entry, deep-link pair, EditablePlan, recipes) regress

After you approve, I'll implement in this order: Go `discover` pkg + tests → CLI wiring → `/discover` + `/connect` → web Discover panel → bump tag → verify the full chain.
