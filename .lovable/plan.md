# ACYN-Go Agent — Website + Agent Plan

A dark, premium, "floating-in-space" landing site for **ACYN-Go**, the Go-based PowerShell-installable AI agent that configures Huawei GPON/XPON/OLT/HG devices over SSH/Telnet. Plus a properly structured Go agent ready to drop into a GitHub release.

## 1. Site structure (TanStack Start routes)

```
src/routes/
  __root.tsx           Sticky glass header + footer + meta defaults
  index.tsx            Homepage (hero, features, hardware grid, install CTA)
  install.tsx          One-line PowerShell installer + manual steps + verify
  guide.tsx            End-to-end usage guide (from the PDF), with anchored sections
  hardware.tsx         Supported devices deep-dive (HG / GPON / XPON / OLT)
  legal.privacy.tsx    Privacy Policy
  legal.terms.tsx      Terms of Service
  legal.license.tsx    MIT License
  legal.contact.tsx    Contact (info@, support@, legal@, developer)
```

Each route gets its own `head()` with unique title/description/OG tags. Brand: **ACYN-Go**, domain `go.acyninnovation.com`, contact `info@acyninnovation.com`, support/legal aliases, developer `okelojnr@acyninnovation.com`.

## 2. Reusable components

```
src/components/
  layout/Header.tsx          Glass sticky nav + "Copy Install Script" pill
  layout/Footer.tsx          Minimal dark footer with links + socials
  layout/SectionNav.tsx      Sticky secondary category nav (Overview/Arch/GPON/...)
  hero/Hero.tsx              Headline + subhead + terminal + floating visual
  terminal/TerminalWindow.tsx  macOS-style window, syntax-highlighted body, copy btn
  terminal/CopyButton.tsx    Reusable copy-to-clipboard w/ toast
  features/FeatureRow.tsx    Borderless alternating row (text <-> visual)
  hardware/HardwareItem.tsx  Borderless floating hardware tile w/ hover lift
  hardware/HardwareGrid.tsx  Responsive 1/3 col grid
  code/CodeBlock.tsx         react-syntax-highlighter wrapper, dark theme
  motion/Float.tsx           Framer Motion infinite levitation wrapper
  motion/FadeUp.tsx          Scroll-triggered fade+slide-up
  ui/PillButton.tsx          Primary/secondary glowing pill button
  seo/Seo.tsx                Helper for per-route meta
```

Design tokens added to `src/styles.css` (oklch): bg `#0a0a0a`, accent cyan + emerald glow, no borders/boxes on feature/hardware items, ambient `drop-shadow` glows, `hover:-translate-y-*` physics.

## 3. Installer page (`/install`)

- Big one-liner PowerShell command in a terminal window with copy button:
  `iwr -useb https://go.acyninnovation.com/install.ps1 | iex`
- Manual install fallback: winget Go + Git, enable Telnet client, OpenSSH, set `GEMINI_API_KEY`, download release binary from GitHub.
- Verify step: `acyn-go --version`.
- First-run walkthrough block (from PDF Section 7).
- A static `public/install.ps1` PowerShell script that:
  1. Detects arch, downloads latest release `acyn-go_windows_amd64.zip` from `https://github.com/acyninnovation/acyn-go/releases/latest`
  2. Extracts to `C:\Tools\acyn-go`
  3. Adds to user PATH
  4. Prompts for `GEMINI_API_KEY` (or skips) and sets it as a user env var
  5. Prints success + next steps

## 4. Guide page (`/guide`)

Long-form, anchored sections rendered from the PDF: Prerequisites, Project Structure, First Run, Device Recipes (HG/GPON/OLT), Troubleshooting, Extending. Uses `CodeBlock` for every snippet. Sticky `SectionNav` for in-page jumps (this is the valid hash-anchor case).

## 5. Hardware page (`/hardware`)

Borderless grid with three families: High-Density OLTs, GPON/EPON ONTs, Core/Edge Switches — each with hover lift + ambient glow. Generated transparent hardware renders via `imagegen` (transparent PNG, "on a clean background").

## 6. Legal pages

App-owner-maintained, neutral wording. Privacy (no PII collected by the site beyond standard logs; agent runs locally, API keys stored locally only), Terms (MIT-licensed OSS, no warranty), MIT License (full text), Contact (info/support/legal aliases + developer).

## 7. The Go agent (shipped via GitHub release)

Lives in `agent/` at the repo root (not bundled into the web app). Structure mirrors the PDF but renamed to `acyn-go`:

```
agent/
  main.go                 CLI loop, interactive prompt session
  go.mod / go.sum
  internal/
    config/config.go      Session struct (IP, port, proto, creds, device type)
    transport/
      telnet.go           Pure-Go Telnet connector w/ prompt detection
      ssh.go              golang.org/x/crypto/ssh client w/ interactive shell
      transport.go        Common interface { Send, Close }
    devices/
      hg.go               HG router command templates + prompt hints
      gpon.go             GPON/XPON ONT templates
      olt.go              MA5600/5800 OLT templates
      registry.go         DeviceType -> template+prompt lookup
    agent/
      agent.go            Orchestrator: LLM -> plan -> confirm -> execute
      prompts.go          System prompt + few-shot JSON examples
      llm/
        gemini.go         Google Gemini Flash client
        openai.go         Optional OpenAI GPT-4o-mini client
        llm.go            Provider interface
    ui/
      prompt.go           Pretty CLI prompts, colors, confirmations
      logger.go           Session log writer (~/.acyn-go/sessions/)
  .github/workflows/
    release.yml           GoReleaser on tag push -> Windows/Linux/macOS binaries + checksums
  .goreleaser.yaml        Build matrix, archive naming used by install.ps1
  README.md               Quickstart mirroring the website guide
  LICENSE                 MIT
```

End-to-end flow verified by the agent:
1. `acyn-go` launches, prompts for IP/proto/port/user/pass/device-type.
2. Connects via SSH or Telnet, waits for device prompt.
3. REPL: user types plain-English instruction.
4. Agent calls Gemini/OpenAI with system prompt + device-family context, expects JSON `{commands, description, warning}`.
5. Prints plan, asks `[y/N]`, executes commands sequentially, captures output, prints OK/error per line.
6. `quit`/`exit` closes connection and writes session log.

## 8. Animations / motion

- Hero text: `FadeUp` on mount.
- Hero visual + terminal: `Float` infinite levitation (`y: [0,-15,0]`, 6s).
- Grid items: staggered scroll-triggered `FadeUp` with `viewport={{ once: true, margin: "-100px" }}`.
- Hover: `hover:-translate-y-3 duration-500 ease-out` + expanding radial glow.

## 9. Out of scope (this pass)

- No auth, no database, no Supabase. The pre-existing supabase TS errors are unrelated to this site and can be cleaned up separately.
- No pricing/SaaS UI — open-source aesthetic per the brief.
- Hardware images are AI-generated transparent renders, not vendor photos.

## 10. Deliverables checklist

- [ ] Routes + per-route SEO meta
- [ ] Reusable component library above
- [ ] `public/install.ps1` working installer
- [ ] Homepage matching the dark/borderless/floating spec
- [ ] Install, Guide, Hardware, 4 legal pages
- [ ] `agent/` Go module with full code, GoReleaser config, README, MIT
- [ ] Generated transparent hardware images under `src/assets/`
