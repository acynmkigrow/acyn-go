I found the installer problem: the GitHub repo is public and tags exist, but the public GitHub Releases API returns an empty release list. The workflow run that succeeded was only the manual tag-creation run; no published GitHub Release/assets exist yet, so PowerShell cannot resolve `/releases/latest`.

Plan:

1. Fix the release workflow so one successful manual run actually publishes the release
- Remove the fragile two-run flow where `workflow_dispatch` only creates a tag and depends on a second tag-triggered run.
- Make manual release do everything in one job: validate version, ensure tag does not already exist, tag the checked-out commit, run Go tests/build checks, then run GoReleaser with `--clean` against that tag.
- Keep tag-push release support too, but ensure both trigger paths publish assets consistently.

2. Make GoReleaser publish assets the installer expects
- Keep GoReleaser v2 schema and hardcoded GitHub owner/name.
- Verify the Windows asset name is exactly `acyn-go_<tag>_windows_amd64.zip`.
- Ensure `acyn-go --version` gets the released version from ldflags.

3. Harden the PowerShell installer
- Keep `acynmkigrow/acyn-go` as the default repo.
- Improve release lookup errors so they distinguish: no published release, no Windows asset, GitHub API failure, and rate limiting.
- Add a fallback path: if `/releases/latest` is unavailable but tags exist, show the latest tag and explain that the release assets were not published yet rather than giving generic instructions.
- After extraction, verify `acyn-go.exe` exists and run `acyn-go --version`; fail clearly if not.

4. Improve agent pairing reliability
- Make the Go agent’s `serve` command friendlier for browser pairing by printing the exact host/port and pairing code clearly.
- Ensure CORS/origin handling supports the production console domain and localhost development.
- Keep the browser console pairing flow aligned with the local agent endpoint.

5. Validate locally as far as possible
- Run non-release Go checks in `agent/`: module tidy check, build, tests.
- Run a dry GoReleaser config check if available.
- Confirm the public GitHub API currently has tags but no releases, so after the workflow fix the expected next action is to run a fresh version such as `v1.0.6`.

Expected result:
- You run Actions → release → Run workflow once with a new version.
- That single successful run creates a published GitHub Release with Windows zip assets.
- `iwr -useb https://go.acyninnovation.com/install.ps1 | iex` downloads, extracts, verifies `acyn-go --version`, and the installed agent can pair with the web console.