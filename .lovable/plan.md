# Plan: Better GitHub guide, generic repo owner, Vercel hosting

## 1. Make repo owner generic (no more hardcoded `acyninnovation`)

The agent currently bakes `acyninnovation/acyn-go` into three places. Replace with a configurable owner so anyone can fork/push to their own GitHub account.

**Files to update:**
- `agent/.goreleaser.yaml` — remove the hardcoded `release.github.owner/name` block. GoReleaser auto-detects the repo from `git remote origin`, so dropping the block makes it work for any fork.
- `public/install.ps1` — replace the hardcoded `acyninnovation/acyn-go` URL with a `$RepoOwner` / `$RepoName` variable pair at the top of the script (defaults preserved for ACYN's own users, but overridable via env var `ACYN_REPO=myuser/myfork` before piping to `iex`).
- `agent/RELEASING.md` — replace `acyninnovation/acyn-go` references with `<your-github-user>/<repo-name>` placeholders and a one-line note: "These examples use ACYN's repo; substitute your own owner/repo if you forked."

## 2. Rewrite the GitHub setup guide (`src/routes/release.tsx`)

Current "GitHub repository setup (one-time)" section is 4 vague bullets. Replace with a full **Part A — First-time GitHub setup** section before the existing release-cutting steps, with literal click paths and screenshots-worth of detail:

**A1. Create the GitHub repo**
- Go to `https://github.com/new`
- **Owner** dropdown → pick your personal account or org
- **Repository name** → e.g. `acyn-go` (any name works; the installer URL just has to match)
- **Visibility** → Public (required for the install.ps1 one-liner to work without auth; Private works too but users need a PAT)
- Leave "Add a README", `.gitignore`, license **unchecked** — we already have those
- Click green **Create repository** button

**A2. Push the `agent/` folder as the repo root**
Two paths depending on whether the user already has the code locally:

*Path 1 — fresh clone from Lovable's GitHub mirror:*
```bash
git clone https://github.com/<lovable-user>/<lovable-project>.git
cd <lovable-project>
git subtree push --prefix=agent https://github.com/<your-user>/<your-repo>.git main
```

*Path 2 — push directly from the agent folder:*
```bash
cd agent
git init -b main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

**A3. Enable write permissions for the release workflow**
- Open your repo on github.com
- Click **Settings** (top nav, far right — next to Insights)
- Left sidebar → **Actions** → **General**
- Scroll to **Workflow permissions**
- Select **Read and write permissions**
- Tick **Allow GitHub Actions to create and approve pull requests**
- Click **Save**

**A4. (Optional) Configure the install.ps1 URL for your fork**
- If you're hosting your own copy, set `$env:ACYN_REPO = "youruser/yourrepo"` before piping to `iex`, or edit the two variables at the top of `install.ps1`.

Existing Parts 1–7 (Prep → Hotfix flow) stay as-is, with two tweaks:
- Section "Files that govern the release" gets a one-liner clarifying that `acyninnovation/acyn-go` in `install.ps1` is just a default — anyone can override.
- Add a tiny callout at the top: "These steps work for any GitHub account/org — substitute your owner/repo wherever you see `<your-user>/<your-repo>`."

## 3. Mirror the same updates into `agent/RELEASING.md`

The in-repo README version should match the web guide so people reading the source see the same instructions. Replace the terse "One-time GitHub setup" section with the A1–A4 walkthrough above (shortened markdown form).

## 4. Add Vercel hosting for `go.acyninnovation.com`

The site is a TanStack Start app. The Lovable Vite preset defaults Nitro to Cloudflare; Vercel needs the Vercel preset. We'll switch presets only when building on Vercel so the Lovable preview keeps working.

**New file: `vercel.json`** (project root)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "bun run build",
  "outputDirectory": ".output/public",
  "framework": null,
  "installCommand": "bun install",
  "build": {
    "env": {
      "NITRO_PRESET": "vercel"
    }
  },
  "trailingSlash": false
}
```

`NITRO_PRESET=vercel` is read by the Nitro build inside `@lovable.dev/vite-tanstack-config` and switches the output to Vercel's expected structure (`.output/server` + `.output/public`). Lovable's own build doesn't set this env var, so the preview/published Lovable URL stays on Cloudflare — no breakage.

**New section in `src/routes/release.tsx` — "Hosting the docs site on Vercel"** with explicit clicks:
1. Push this project to GitHub (Plus menu → GitHub → Connect, in Lovable).
2. Go to `https://vercel.com/new`
3. Click **Import** next to your repo
4. **Framework Preset** → leave as **Other** (vercel.json overrides it)
5. **Build & Output Settings** → leave defaults (vercel.json controls them)
6. **Environment Variables** → add any Lovable Cloud / Supabase keys the app needs at runtime (list what's in `.env` minus secrets)
7. Click **Deploy**
8. After first deploy: **Project → Settings → Domains → Add** → enter `go.acyninnovation.com`
9. In your DNS provider, add the `CNAME` record Vercel shows (typically `cname.vercel-dns.com`)
10. Wait for DNS + SSL (1–10 min); Vercel auto-provisions the cert

Plus a troubleshooting subsection: SSR 500s → check `NITRO_PRESET` is set in Vercel env; build fails on `bun install` → switch installCommand to `npm install` if Bun isn't enabled in the Vercel project.

## Files touched
- `agent/.goreleaser.yaml` (edit — drop hardcoded owner/name)
- `public/install.ps1` (edit — variables + ACYN_REPO env override)
- `agent/RELEASING.md` (edit — expanded one-time setup)
- `src/routes/release.tsx` (edit — new Part A walkthrough + Vercel section)
- `vercel.json` (new)

No DB changes, no new deps, no agent runtime behavior changes.
