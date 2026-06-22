## Plan

1. **Pin the release tool instead of using `latest`**
   - Replace GoReleaser Action `version: latest` with a fixed v2 release, removing the “using latest” warning and preventing future surprise breakage.

2. **Fix manual release tag flow**
   - Make manual runs check both local and remote tags before creating one.
   - Use the workflow input version consistently so GoReleaser releases the intended tag.
   - Avoid pushing duplicate tags that can cause exit 128/1 failures.

3. **Add real preflight checks before GoReleaser**
   - Verify `agent/go.mod` exists.
   - Run `go mod tidy` in `agent/`.
   - Run `go test ./...` in `agent/` so broken agent code fails before packaging.
   - Run `go build` for the main agent binary so the workflow proves the app compiles before release.

4. **Harden GoReleaser config**
   - Keep release assets named exactly how the installer expects, especially the Windows zip.
   - Add `goamd64: v1` for maximum Windows compatibility.
   - Keep version injection into `acyn-go --version`.

5. **Update release docs / installer guidance only where needed**
   - Make the release page/docs tell you to re-run with a new version like `v1.0.3` after a failed attempt.
   - Keep the installer pointed at `acynmkigrow/acyn-go`.

## Expected result

After syncing to GitHub, you can run **Actions → release → Run workflow**, enter a new version such as `v1.0.3`, and the workflow should test, build, package, publish the GitHub Release, and make the Windows installer succeed end to end.