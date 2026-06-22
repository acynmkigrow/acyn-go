
# ACYN-Go Console — Web GUI + Agent pairing + Release guide

A signed-in web console at `/console` chats with Lovable AI, pairs to the locally-running `acyn-go` agent over a LAN WebSocket using a 6-digit pairing code, and runs validated Huawei commands against the device the agent is connected to. Adds a `/release` guide for cutting GitHub releases and hardens the agent's command templates against the official Huawei CLI references.

## 1. Architecture

```text
 Browser (/console)                Local machine                LAN
 ┌────────────────────┐  Lovable   ┌──────────────────────┐    ┌─────────┐
 │ Chat UI + pairing  │◀──AI──────▶│  acyn-go --serve     │───▶│ OLT/ONT │
 │ (AI Elements)      │            │  WebSocket :17017    │    │ HG / SW │
 │ ws://127.0.0.1:    │◀──────────▶│  pairing + bridge    │    └─────────┘
 │   17017 + token    │   LAN ws   │  SSH / Telnet        │
 └────────────────────┘            └──────────────────────┘
```

- AI lives in a TanStack server fn `planConfig` (Lovable AI Gateway, `google/gemini-3-flash-preview`, structured `Output` → `{commands, description, warning, requires_save}`).
- Browser shows the plan, user clicks **Run**, browser sends commands over the LAN WebSocket to the agent, agent executes via existing `transport.Conn`, streams output back.
- No device credentials ever hit Lovable Cloud — only the natural-language intent + device family.

## 2. Pairing flow (LAN WebSocket, no relay)

1. User runs `acyn-go serve` (new subcommand). Agent:
   - Connects to the device interactively as today.
   - Starts `ws://127.0.0.1:17017` with a self-generated **6-digit pairing code** + **64-char session token** printed to the terminal.
   - Only accepts `Origin: https://*.lovable.app`, `http://localhost:*`, or the user's custom domain.
2. In `/console`, user enters the 6-digit code. Browser POSTs to `ws://127.0.0.1:17017/pair` with the code, receives the session token, then opens the persistent `ws://127.0.0.1:17017/session?token=...`.
3. Browser stores token in `sessionStorage` (cleared on tab close). Reconnect attempts auto-resume until the agent exits.

Messages (JSON):
- `→ {type:"exec", id, commands:[…], save:true}`
- `← {type:"output", id, line, stream:"stdout"|"stderr"}`
- `← {type:"done", id, ok, durationMs}`
- `← {type:"device", vendor, model, prompt, mode}` (sent on connect)

## 3. Web GUI (`/console`, authenticated)

Routes:
- `src/routes/_authenticated/console.tsx` — chat + pairing panel.
- `src/routes/_authenticated/console.history.tsx` — past sessions (DB-backed, see §5).

Components (AI Elements first, per chat-ui-composition):
- `Conversation` / `Message` / `MessageResponse` / `PromptInput` from AI Elements.
- `PairingCard` — input for 6-digit code, shows connection state, device banner.
- `PlanCard` — renders `{description, warning, commands[]}` from the AI with **Run** / **Edit** / **Discard**.
- `ExecLog` — streamed output lines per command with OK/ERR badges.
- Assistant messages: no background; user messages: `bg-primary text-primary-foreground`.
- Identity: reuse the generated ACYN-Go mark — no `Sparkles` placeholder.

One conversation per browser, persisted to `localStorage` under `acyn-go.console.messages` (per the user's chat-history choice). "New conversation" button clears it.

## 4. AI plumbing

- `src/lib/ai-gateway.server.ts` — shared `createLovableAiGatewayProvider` helper.
- `src/lib/agent.functions.ts`:
  - `planConfig({ intent, device: {vendor, model, mode}, recentOutput })` — `createServerFn` POST, uses `generateText` + `Output.object` with Zod schema; system prompt assembled from `agent/internal/agent/prompts.go` content + device-specific hardened hints (§7).
- No tool calling on the server side; execution happens client→agent over the LAN WS. Keeps the AI stateless and audit-friendly.
- `LOVABLE_API_KEY` already present; surface `429` (rate limit) and `402` (credits) as toasts.

## 5. Auth + history (Supabase)

- Email/password auth via the existing Lovable Supabase integration (`_authenticated` layout already managed).
- New `/auth` page (sign in / sign up, password reset).
- Tables (migration):
  - `profiles(id uuid pk → auth.users, display_name, created_at)` + auto-insert trigger.
  - `device_profiles(id, user_id, label, vendor, model, last_used_at)` — saved device labels (no credentials).
  - `command_runs(id, user_id, device_profile_id null, intent, commands jsonb, output text, ok bool, created_at)` — audit log written from the browser after each Run.
- RLS: every row scoped to `auth.uid()`. Grants per the public-schema-grants rule.

## 6. Agent changes (`acyn-go serve`)

Additions, no rewrites:
- `internal/server/ws.go` — `nhooyr.io/websocket` server, pairing handshake, token gate, JSON message loop, per-message timeout.
- `internal/server/exec.go` — wraps existing `transport.Conn.Send`, streams output line-by-line.
- `main.go` — new `serve` subcommand: prompts for device connection as today, then starts the WS server and prints:
  ```
  Pairing code: 482-915
  Open https://go.acyninnovation.com/console and enter the code.
  Listening on ws://127.0.0.1:17017
  ```
- Bind to `127.0.0.1` only by default; `--lan` flag to bind `0.0.0.0` for cross-host LAN use.
- Reuse `ui.SessionLogger` for local logs.

## 7. Command accuracy hardening

Refresh device profiles against vendor references (Huawei MA5800 V100R022 CLI Reference, MA5600T CLI Reference, HG8245H/HG8546M Product Docs, S5700/S6700 CLI). Sources read via `web_code_search` + `fetch_website` during the build step.

Per family, store **templates + validators** in `internal/devices/<family>.go`:

- **MA5800 / MA5600T OLT** — enter sequence `enable` → `config`; VLAN create `vlan <id> smart`; service-port `service-port <idx> vlan <vid> gpon 0/<slot>/<port> ont <ontid> gemport <gid> multi-service user-vlan <uvid>`; ONT add `ont add 0/<slot>/<port> <ontid> sn-auth "<SN>" omci ont-lineprofile-id <lp> ont-srvprofile-id <sp> desc "<d>"`; always end with `save`; refuse `undo`/`reset` without explicit `confirm: true` from the user.
- **HG8245/HG8546 HG ONT** — `enable` → `config`; WLAN: `wlan ssid-profile name <p>`/`wlan security-profile name <p>`/`wlan vap-profile name <p>` then bind under `interface vap-profile`; WAN: `wan-srv-profile`; finish with `save`.
- **Generic GPON/XPON ONT** — bridge vs route mode detection via `display wancfg`; tag uplink via `wan-ip-connection … vlan <id>`.
- **S-series switch** — `system-view`; `vlan batch <list>`; `interface GigabitEthernet0/0/x` → `port link-type access|trunk` → `port default vlan <id>` or `port trunk allow-pass vlan …`; LACP `interface Eth-Trunk N`; `save` then `Y`.

Guardrails (encoded in the AI system prompt + a Go-side `validateCommands`):
- Reject `reset saved-configuration`, `factory reset`, `undo vlan all`, `clear configuration this`, `format`, `reboot` unless the user typed the same intent verbatim.
- Require explicit slot/port in every interface command — no wildcards.
- For OLT writes, force `save` as the final command (auto-append if missing).
- Strip backticks / markdown that LLMs sometimes emit.

## 8. Release guide (`/release` route + `RELEASING.md`)

New `src/routes/release.tsx` (public) renders the same content as `agent/RELEASING.md`:

1. **Prep** — bump version in `agent/main.go` defaults, update `CHANGELOG.md`.
2. **Tag** — `git tag -a v1.2.0 -m "v1.2.0" && git push origin v1.2.0`.
3. **CI** — `.github/workflows/release.yml` (already present) runs GoReleaser on tag push, producing Windows/Linux/macOS archives + `checksums.txt`.
4. **Verify** — download `acyn-go_windows_amd64.zip` from the Releases page, run `acyn-go --version`.
5. **Promote** — mark the GitHub release as Latest. `public/install.ps1` already pulls `/releases/latest`, so end users get the new build immediately.
6. **Hotfix flow** — branch `release/v1.2.x`, cherry-pick, tag `v1.2.1`.
7. **Local dry-run** — `goreleaser release --snapshot --clean` before pushing the tag.

Header gets a new "Release" link; Footer too.

## 9. File map

```text
src/
  routes/
    auth.tsx                              new (sign in / up / reset)
    release.tsx                           new
    _authenticated/
      route.tsx                           managed (exists)
      console.tsx                         new
      console.history.tsx                 new
  components/
    console/
      PairingCard.tsx                     new
      PlanCard.tsx                        new
      ExecLog.tsx                         new
      useAgentSocket.ts                   new (LAN WS client + reconnect)
      useConsoleChat.ts                   new (useChat + localStorage)
    ai-elements/…                         installed via ai-elements CLI
  lib/
    ai-gateway.server.ts                  new
    agent.functions.ts                    new (planConfig)
    huawei/
      schemas.ts                          new (Zod plan schema, shared)
agent/
  cmd/serve.go                            new (subcommand wiring)
  internal/server/{ws,exec,validate}.go   new
  internal/devices/*.go                   hardened templates + Hints
  RELEASING.md                            new
supabase/migrations/<ts>_console.sql      profiles + device_profiles + command_runs + RLS + grants
```

## 10. Out of scope (this pass)

- Cloud relay / remote pairing across NAT — local LAN only for now.
- Gemini direct key path — user will wire later; the server fn already abstracts the provider.
- Mobile-optimized console layout beyond responsive defaults.
- Per-device firmware-version detection (templates assume current GA firmware).

## 11. Verification checklist

- [ ] `acyn-go serve` prints code, browser pairs, device banner appears in `/console`.
- [ ] Plan card renders, **Run** streams output line-by-line, audit row written.
- [ ] Refresh restores chat from `localStorage`; sign-out clears session + redirects to `/auth`.
- [ ] `goreleaser release --snapshot --clean` succeeds locally.
- [ ] Validator rejects a synthetic `reset saved-configuration` plan.
- [ ] Lighthouse/SEO: `/release` and `/console` have unique `head()`.
