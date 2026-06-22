# Add MikroTik RouterOS support

Extend the agent and web console so the same "describe intent → safe plan → run" flow that works for Huawei also works for any MikroTik RouterOS device (CCR, CRS in RouterOS mode, RB, hAP/cAP/wAP, Chateau). SwOS-only devices (CSS, CRS in SwOS) are explicitly marked unsupported with a clear message.

## What gets added

### 1. New device family: `mikrotik`
- Extend `Family` in `src/lib/huawei-prompts.ts` (rename the constant set, keep file path) to include `"mikrotik"`.
- Add a `mikrotik` profile in `agent/internal/devices/` with its own prompt strings (`>` / `[admin@…] >`) and `SaveCmd` of empty string (RouterOS auto-persists).
- Add `mikrotik` to the family dropdown in `console.tsx` ("MikroTik RouterOS (CCR/CRS/RB/hAP)").

### 2. MikroTik LLM prompt module
New `FAMILY_HINTS.mikrotik` covering the surface area requested:
- Syntax rules: hierarchical paths (`/system identity set …`), one statement per line, multi-statement via `;`, no `enable`/`config`/`save` needed.
- v6 vs v7 awareness: if model unknown, prefer v7 syntax; v6 fallback noted (`+cet512w` username, legacy `/routing ospf` etc.).
- Hardening recipes: identity, `/ip service` port + disable telnet/ftp/www/api, `/user add`, `/ip ssh set host-key-type=ed25519 …`.
- L2/L3: `/interface bridge`, `vlan-filtering=yes`, `/interface vlan`, `/ip address`, `/ip route`.
- Edge services: `/ip pool`, `/ip dhcp-server`, `/ip dhcp-server network`, `/ip firewall nat` masquerade.
- WireGuard: `/interface wireguard add`, `/interface wireguard peers add`, `/ip address add interface=wg…`.
- RADIUS: `/radius add service=… address=… secret=…`, `/user aaa set use-radius=yes`, hotspot/PPP profile binding.
- SMS (LTE/Chateau): `/tool sms send`, `/interface lte` config, inbox via `/tool sms inbox print`.
- Hotspot, PPP secrets, queues, scripts/schedulers — short bullets so the model can compose.
- Destructive list: `/system reset-configuration`, `/system reboot`, `/file remove`, `/user remove admin`, `/interface remove`. Only allowed when user types the same verb.
- Output discipline reused: JSON-only, never invent IPs / interface names / secrets — return empty `commands` and ask in `warning`.

### 3. Safety validator update
In `validateCommands`, add MikroTik-specific destructive patterns alongside the existing Huawei ones:
- `/system reset-configuration`, `/system reboot`, `/file remove`, `/user remove`, `/interface .* remove`, `/ip firewall .* remove [find]` without explicit filter.
Also block obvious footguns: `remove [find]` with no `where`, `disable [find]` on `/interface ether*` without a name.

### 4. Discovery: identify MikroTik on the LAN
Update `agent/internal/discover/signatures.go` and `scan.go`:
- Add MikroTik markers: SSH banner contains `ROSSSH` / `MikroTik`, Telnet banner `MikroTik v…`, HTTP `Server: Mikrotik …` or HTML title `RouterOS`, plus port `8728` (API) and `8729` (API-SSL) as additional probe ports — open 8728/8729 alone is a strong MikroTik signal.
- New `classify` return values: `vendor="mikrotik"`, `family="mikrotik"` (sub-family detection — `ccr`/`crs`/`rb`/`hap` — done from banner when present, stored as `Model` on `Device` for the picker label).
- `Suggest`: prefer SSH/22, username `admin` (RouterOS default), note password may be blank on factory-fresh units.
- Discovery panel sort order: Huawei + MikroTik first, then unknown.

### 5. SwOS guardrail
When a probed device looks like MikroTik but only :80/:443 are open and HTTP says `SwOS`, mark `family="swos"` and surface a non-blocking warning in the picker: "SwOS device — CLI not supported. Use web UI." `connectDevice` refuses with a clear error.

### 6. Transport
No new transport. Existing `transport/ssh.go` and `transport/telnet.go` work as-is; only the per-family `Prompts` differ (handled by the new `devices/mikrotik.go` profile).

### 7. Web console glue
- `DiscoverPanel.tsx`: show vendor badge for MikroTik (orange), display model when present, render the SwOS warning row.
- `Wizard.tsx` RECIPES: add three MikroTik recipes — "Harden MikroTik SSH + disable Telnet/FTP", "Set up WireGuard server on MikroTik", "Add LAN bridge + DHCP + masquerade".
- Family is auto-set to `mikrotik` when a MikroTik device is connected (same path that already auto-sets `hg`/`olt`).

### 8. Tests
- `agent/internal/discover/scan_test.go`: add cases for MikroTik SSH banner, RouterOS HTTP header, SwOS HTTP header, and API-only (8728) signal.
- New `src/lib/__tests__/huawei-prompts.test.ts` (rename later if desired): validate that destructive MikroTik commands without matching intent get blocked, and that benign `/ip address add …` passes.

### 9. Release
Bump `agent/main.go` version to `v1.0.8`. After merge, the user triggers Actions → release → `v1.0.8`, reinstalls, and the new "Find devices" sweep will now list MikroTik routers with a one-click connect.

## Files touched

- `src/lib/huawei-prompts.ts` (add family, hints, validator patterns)
- `src/routes/_authenticated/console.tsx` (dropdown option)
- `src/components/console/Wizard.tsx` (recipes)
- `src/components/console/DiscoverPanel.tsx` (vendor badge, SwOS warning)
- `agent/internal/devices/mikrotik.go` (new)
- `agent/internal/discover/signatures.go` (markers, sub-family)
- `agent/internal/discover/scan.go` (extra probe ports 8728/8729, Device.Model field)
- `agent/internal/discover/scan_test.go` (new cases)
- `agent/internal/server/ws.go` (pass family=mikrotik through `device` hello)
- `agent/main.go` (version bump)

## Out of scope (call out, don't build)
- MikroTik API protocol (8728/8729) — we stay on SSH for parity and safety.
- Auto-upgrading RouterOS firmware.
- Backup/restore via `/export` file download — can be a follow-up once the basics land.

## Acceptance
1. `go test ./...` passes including new discover cases.
2. Web console "Find devices" lists a MikroTik hAP next to a Huawei HG with correct badges.
3. Asking "harden ssh and disable telnet" on a MikroTik produces the v7 hardening block, requires_save=false, no destructive flag.
4. Asking "reset the router" returns `commands: []` with a warning explaining the destructive guard.
5. A CSS/SwOS device shows up with the "CLI not supported" warning and connect is disabled.
