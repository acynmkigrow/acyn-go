## Goal

Make onboarding a single command. The user runs `acyn-go serve` and:

1. The agent starts on `127.0.0.1:17017` with no prompts.
2. The default browser opens straight to the console, already paired (no 6-digit code to type).
3. The console auto-runs subnet discovery and lists every Huawei / MikroTik / Cisco / unknown device found.
4. The user clicks a device → enters credentials in a modal → connection swaps live → AI chat is ready.

No CLI questions, no copy-pasting codes, no deep-link clicking unless something goes wrong.

## Changes

### 1. Agent: default `serve` to web + auto-launch browser

`agent/cmd/serve.go` and `agent/main.go`:
- Make `--web` the default. Add `--cli` flag for the legacy interactive prompts (opt-in for power users / headless boxes).
- After the WS bridge is listening, build a one-shot deep link that embeds the pair code:
  `https://go.acyninnovation.com/console?pair=<code>&host=127.0.0.1&port=17017&auto=1`
- Open it with the OS default browser:
  - Windows: `rundll32 url.dll,FileProtocolHandler <url>`
  - macOS: `open <url>`
  - Linux: `xdg-open <url>`
  Wrap in a small `internal/ui/browser.go` helper. Fall back to printing the link if launch fails or `--no-browser` is set.
- Keep printing the pair code + link as a fallback (for SSH / remote sessions where the browser can't open locally).

### 2. Web console: auto-pair from URL params

`src/components/console/PairingCard.tsx` + `src/routes/_authenticated/console.tsx`:
- On mount, read `pair`, `host`, `port`, `auto` from URL search params.
- When `auto=1` and a pair code is present, immediately call `pair(host, port, code)` — skip the form entirely and show a "Connecting to your local agent…" spinner.
- On success, strip the `pair` param from the URL (so refresh doesn't re-pair a stale code) and reveal the console.
- On failure, fall back to the existing manual pairing form with a clear "Auto-pair failed — paste the 6-digit code" message.

### 3. Web console: auto-run discovery after pairing

`src/routes/_authenticated/console.tsx` + `src/components/console/DiscoverPanel.tsx`:
- As soon as `status === "connected"` AND no device is attached yet, trigger `discover()` automatically (single sweep) and show the device list with a "Scanning your LAN…" skeleton.
- Add a manual "Rescan" button (already exists in DiscoverPanel — confirm).
- Add a small "Connect manually by IP" link for cases where discovery misses the device.

### 4. Cisco device family (basic)

Since the user mentioned Cisco, add a minimal Cisco IOS profile so the UI lists it as a real option, not a TODO:
- `agent/internal/devices/cisco.go`: prompts `[">", "#", "(config)#"]`, `SaveCmd: "write memory"`, hints describing IOS modes (`enable` → `configure terminal` → exit with `end`), interface/vlan/access-list basics, `show running-config`, never emit `reload` / `erase startup-config` / `delete flash:`.
- `agent/internal/discover/signatures.go`: detect Cisco banners (`cisco`, `IOS`, `Catalyst`, `Nexus`, `NX-OS`, `ASA`) → vendor=`cisco`, family=`cisco`.
- `src/lib/huawei-prompts.ts`: add `cisco` to `Family` union + `FAMILY_HINTS.cisco` mirroring the agent profile, and add Cisco destructive patterns (`erase startup`, `reload`, `delete /force`, `format`, `write erase`).
- `src/lib/agent.functions.ts`: include `cisco` alongside `mikrotik` in the "skip auto-save append" check only if needed (Cisco needs explicit `write memory`, so keep save). Just thread the family through.
- UI: add Cisco to the family dropdown in `console.tsx`, the Wizard recipes (one starter: "Cisco access port + VLAN"), and the DiscoverPanel vendor badge (blue).

### 5. Polish

- `src/components/console/DiscoverPanel.tsx`: badge colors per vendor — Huawei red, MikroTik orange, Cisco blue, unknown gray.
- Banner in console: "Paired with agent on 127.0.0.1 · v1.0.x" once connected.
- Persist last successful `{ip, family, username}` in `localStorage` and pre-fill the credentials modal on next visit.

## Files

**Agent (Go)**
- `agent/cmd/serve.go` — default `--web` true, launch browser, build pair URL
- `agent/main.go` — flag rename (`--cli` opt-in), bump version to `v1.0.9`
- `agent/internal/ui/browser.go` — new, cross-platform URL opener
- `agent/internal/devices/cisco.go` — new
- `agent/internal/discover/signatures.go` — Cisco markers
- `agent/internal/discover/scan_test.go` — Cisco banner test

**Web**
- `src/components/console/PairingCard.tsx` — auto-pair from query params
- `src/routes/_authenticated/console.tsx` — auto-discover after connect, add Cisco to dropdown, last-device memory
- `src/components/console/DiscoverPanel.tsx` — vendor color badges, auto-trigger scan
- `src/components/console/Wizard.tsx` — Cisco recipe
- `src/lib/huawei-prompts.ts` — Cisco family + hints + destructive patterns
- `src/lib/agent.functions.ts` — thread `cisco` family
- `src/components/console/useAgentSocket.ts` — accept `cisco` in `DiscoveredDevice.family` union

## Release

Bump `agent/main.go` to `v1.0.9`, run GitHub Actions → release → `v1.0.9`, reinstall via `iwr -useb https://go.acyninnovation.com/install.ps1 | iex`, then just run `acyn-go serve` — browser opens, device list appears, click → configure.

## Out of scope

- Cisco NX-OS / IOS-XE deep dialect differences (covered by hints, not separate families).
- mDNS / SSDP discovery (TCP sweep is enough for now).
- Saving credentials to disk (only `localStorage` in the browser, never the agent).
