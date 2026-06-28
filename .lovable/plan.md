# Plan: Stabilize agent + ship release, then preflight / few-shot / recipes

## Phase 0 — Fix the release that's failing (do first)

The release workflow is green only when `agent/go.sum` is fully tidy and the version bump is committed. Symptoms we've seen ("agent fails to release") almost always come from one of:

- `go mod tidy` producing a diff that fails the "Verify module files are committed" gate.
- `main.version` not bumped, so the published binary still reports the previous tag.
- A goreleaser archive name collision with an existing draft.

Actions:
1. Bump `agent/main.go` `version` to `v1.0.10`.
2. Run `go mod tidy` inside `agent/` and commit the resulting `go.mod` / `go.sum` (so the workflow's diff check passes).
3. Trigger the `release` workflow via `workflow_dispatch` with `v1.0.10` (or push the tag).
4. If goreleaser still errors, capture the exact step output and patch `.goreleaser.yaml` (most likely a `goamd64`/archive name issue) before re-tagging as `v1.0.11`.

## Phase 1 — Robust interactive sessions (root cause of the MikroTik desync)

The crash was a classic interactive-terminal race: we wrote the next command before RouterOS finished echoing the prompt, ANSI `[K` clear-line codes leaked into our buffer, and once the device printed "Console does not respond" the session was already dead.

Fixes, all in `agent/internal/transport/`:

### 1.1 `ssh.go` — proper prompt synchronization
- Replace the fixed `time.Sleep(300ms)` + best-effort `readUntilAny` with a real **read loop that returns only when a prompt is matched at end-of-buffer** (anchor to the last non-empty line, not anywhere in the stream).
- Strip ANSI escapes (`\x1b\[[0-9;?]*[A-Za-z]`, plus bare `\x1b[K` / `\r`) from the buffer before prompt matching and before returning output.
- Per-command timeout (default 8s, configurable per family) — on timeout send `\x03` (Ctrl-C), drain to prompt, return an error so the batch stops cleanly instead of cascading.
- Detect the MikroTik "Console does not respond. Restart console? [y/N]" string explicitly → answer `n\r`, then return a typed `ErrConsoleHung` so the WS layer can mark the session dead.
- Disable PTY echo more aggressively (`ssh.ECHO=0`, `ssh.ECHOCTL=0`, `ssh.ICANON=0`) and request a wider PTY (`vt100`, `200x100`) — current 80-col PTY is what causes RouterOS to wrap long commands into themselves.

### 1.2 Family-specific session prelude
New `Profile.LoginPrelude []string` in `internal/devices/registry.go`. After the initial prompt is read, `DialSSH` runs the prelude silently. For MikroTik:
```
/console screen-number-of-lines rows=100
/console screen-number-of-columns columns=200
```
For Cisco: `terminal length 0`, `terminal width 200`. Huawei OLT/HG already use `screen-length 0 temporary`-style cmds — wire those in too.

### 1.3 Dead-session detection in `server/ws.go`
- Wrap `conn.Send` errors: if the error is `ErrConsoleHung` or `io.EOF`, close `s.conn`, mark device as detached, push a `{type:"device-lost"}` WS message, and stop the batch with a clear "session dropped, please reconnect" line.
- Frontend (`useAgentSocket.ts`) handles `device-lost` by clearing `device` state and surfacing a reconnect CTA in `PairingCard`/sidebar.

### 1.4 Command isolation
- In `runBatch`, never concatenate commands with `;` — already true, but add an assertion that strips trailing `;` and splits any accidental multi-line input on `\n` so each line goes through the prompt-wait loop.

## Phase 2 — Preflight dry-run round-trip

New WS message types:
- Client → agent: `{type:"preflight", id, commands[]}` — agent runs only the *read-only* probes the planner attached (e.g. `/interface print where name=ether2`, `show interface ether2`), returns `{type:"preflight-result", id, results:[{cmd, ok, output}]}`.
- Planner side (`src/lib/agent.functions.ts`): extend `PlanSchema` with optional `preflight_commands: string[]`. The system prompt instructs the model to list reads that prove every referenced interface/VLAN/IP exists before apply.
- `EditablePlan.tsx`: "Apply safely" now runs Preflight → if any check fails, abort with the failing cmd surfaced; otherwise proceed to Apply → Verify → Rollback (existing chain).

Agent-side handler in `server/ws.go` reuses `conn.Send` with the same per-cmd timeout; no device-state mutation.

## Phase 3 — `command_runs` schema bump + few-shot retrieval

Migration (call out next turn):
```sql
ALTER TABLE public.command_runs
  ADD COLUMN IF NOT EXISTS plan_intent text,
  ADD COLUMN IF NOT EXISTS plan_commands jsonb,
  ADD COLUMN IF NOT EXISTS verify_ok boolean,
  ADD COLUMN IF NOT EXISTS device_facts jsonb,
  ADD COLUMN IF NOT EXISTS embedding vector(1536);  -- if pgvector available; otherwise skip
CREATE INDEX IF NOT EXISTS command_runs_user_family_idx
  ON public.command_runs (user_id, family, created_at DESC);
```
- New server fn `getFewShotExamples({family, intent})` returns the top 3 prior successful runs (filtered by `user_id`, `family`, `ok=true`, recency; embedding similarity when pgvector is on, else trigram on `intent`).
- `agent.functions.ts` prepends those `{intent, commands}` pairs to the prompt as few-shot examples.
- Persist each run (intent, plan, verify result, facts snapshot) on `done` event in `console.tsx`.

## Phase 4 — Recipe parameter resolver UI

`<placeholder>` tokens in quick-recipe commands already render as inputs in `EditablePlan.tsx`. Extensions:
- Auto-prefill from `device.facts` (e.g. `<wan_iface>` → first non-bridge interface from `/interface print`).
- Required vs optional placeholders (suffix `?` → optional).
- "Resolve from device" button per placeholder that runs a one-shot read (e.g. `/interface print where name~"ether"`) and lets the user pick from the parsed list.

## Technical notes

- All transport changes are covered by a new `transport_test.go` using a scripted SSH server (`gliderlabs/ssh` is dev-only) — verifies prompt sync, ANSI strip, timeout → Ctrl-C path, and console-hung detection.
- `device-lost` is purely additive on the WS protocol; older agent builds remain compatible because the frontend treats unknown types as no-ops.
- No DB writes are made for `preflight` results — they're transient.

## Order of execution

1. Phase 1.1 + 1.2 + 1.3 + 1.4 (transport + ws + prelude).
2. Phase 0 release (`v1.0.10`) with those fixes baked in — that's the "new release" the user is waiting on.
3. Phase 2 preflight.
4. Phase 3 migration + few-shot (I'll ask before running the migration).
5. Phase 4 recipe resolver polish.

Want me to proceed with Phases 1 + 0 first and stop for your go-ahead before Phase 2?
