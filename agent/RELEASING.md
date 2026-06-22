# Releasing ACYN-Go

Cut a release in seven steps. Detailed walkthrough lives at <https://go.acyninnovation.com/release>.

## 1. Prep
- Update `CHANGELOG.md`
- Bump examples in `README.md` if defaults changed
- `go test ./... && go vet ./...`

## 2. Dry-run
```bash
cd agent
goreleaser release --snapshot --clean
```

## 3. Tag & push
```bash
git tag -a v1.2.0 -m "ACYN-Go v1.2.0"
git push origin v1.2.0
```

## 4. CI runs `.github/workflows/release.yml`
GoReleaser produces:
- `acyn-go_v1.2.0_windows_amd64.zip`
- `acyn-go_v1.2.0_linux_amd64.tar.gz`
- `acyn-go_v1.2.0_darwin_arm64.tar.gz`
- `checksums.txt`

## 5. Verify
```powershell
.\acyn-go.exe --version   # acyn-go v1.2.0
```

## 6. Mark as Latest on the GitHub Release page.

## 7. Hotfix
```bash
git checkout -b release/v1.2.x v1.2.0
git cherry-pick <sha>
git tag -a v1.2.1 -m "Hotfix"
git push origin release/v1.2.x v1.2.1
```

## One-time GitHub setup
1. Create `github.com/acyninnovation/acyn-go`
2. Push `agent/` as the repo root
3. Settings → Actions → General → enable **Read and write permissions** for `GITHUB_TOKEN`
