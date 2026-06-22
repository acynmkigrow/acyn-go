## Fix the installer 404

Two things are wrong:

1. **Hardcoded default repo** — `public/install.ps1` defaults to `acyninnovation/acyn-go`. Since `go.acyninnovation.com` now serves *your* deployment, the default should point at your fork `acynmkigrow/acyn-go`.
2. **Bogus `v1.0.0` fallback** — when the GitHub API call fails (rate limit, no releases yet, network), the script silently falls back to tag `v1.0.0` and tries to download an asset that doesn't exist → the `Not Found` you saw. The API call most likely succeeded against `acyninnovation/acyn-go` and returned a tag, but that repo's release assets aren't named the way the script expects — either way the fallback hides the real problem.

### Changes to `public/install.ps1`

- Change the default at the top from `'acyninnovation/acyn-go'` to `'acynmkigrow/acyn-go'`.
- Remove the `v1.0.0` fallback. If the GitHub API call fails, print a clear error explaining how to override with `$env:ACYN_REPO` and exit. No silent guessing.
- After resolving the tag, do a `HEAD` request on the asset URL first; if it 404s, print the exact asset name expected vs. what's on the release page and exit.

### Changes to `agent/RELEASING.md` and `src/routes/release.tsx`

- Update the example `$env:ACYN_REPO` line to use `acynmkigrow/acyn-go` as the example, and clarify that the bare `iwr ... | iex` now defaults to your fork.

### What you'll need to do on GitHub (one-time, outside the code)

Even after the fix, the installer needs a real release on `acynmkigrow/acyn-go` with assets named `acyn-go_<tag>_windows_amd64.zip`. To create one:

1. Push a tag from the GitHub repo root: `git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0`
2. The root `.github/workflows/release.yml` workflow runs GoReleaser inside `agent/`, auto-detects `acynmkigrow/acyn-go` from `git remote origin`, and uploads the correctly-named zip.
3. Re-run `iwr -useb https://go.acyninnovation.com/install.ps1 | iex` — it'll find the release and install.

If you'd rather not cut a release yet, you can also test against any other repo of yours that has matching assets via `$env:ACYN_REPO = "owner/repo"` before the `iwr` call.

### Files touched
- `public/install.ps1` (edit)
- `.github/workflows/release.yml` (add — release workflow for the full GitHub repo)
- `agent/RELEASING.md` (edit — example only)
- `src/routes/release.tsx` (edit — example only)

No backend, DB, or agent runtime changes.