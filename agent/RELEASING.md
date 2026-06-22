# Releasing ACYN-Go

Walkthrough lives at <https://go.acyninnovation.com/release>. The examples below
use `<your-user>/<your-repo>` — substitute your own GitHub owner/repo. The
GoReleaser config no longer pins an owner, so forks ship to their own repos
without edits.

## Part A — One-time GitHub setup

### A1. Create the repo
1. Open <https://github.com/new>
2. **Owner** → your account or org
3. **Repository name** → e.g. `acyn-go` (any name works)
4. **Visibility** → Public (Private also works but installer users will need a PAT)
5. Leave README / .gitignore / license **unchecked**
6. Click **Create repository**

### A2. Push the `agent/` folder as the repo root

*Already cloned from Lovable's GitHub mirror:*
```bash
cd <lovable-project>
git subtree push --prefix=agent https://github.com/<your-user>/<your-repo>.git main
```

*Pushing directly from the agent folder:*
```bash
cd agent
git init -b main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### A3. Enable workflow write permissions
1. Open the repo on github.com
2. **Settings** (top nav, far right)
3. Left sidebar → **Actions** → **General**
4. Scroll to **Workflow permissions**
5. Select **Read and write permissions**
6. Tick **Allow GitHub Actions to create and approve pull requests**
7. Click **Save**

### A4. (Optional) Point install.ps1 at your fork
```powershell
$env:ACYN_REPO = "<your-user>/<your-repo>"
iwr -useb https://go.acyninnovation.com/install.ps1 | iex
```

## Part B — Cut a release

### 1. Prep
- Update `CHANGELOG.md`
- Bump examples in `README.md` if defaults changed
- `go test ./... && go vet ./...`

### 2. Dry-run
```bash
cd agent
goreleaser release --snapshot --clean
```

### 3. Tag & push
```bash
git tag -a v1.2.0 -m "ACYN-Go v1.2.0"
git push origin v1.2.0
```

### 4. CI runs `.github/workflows/release.yml`
GoReleaser produces:
- `acyn-go_v1.2.0_windows_amd64.zip`
- `acyn-go_v1.2.0_linux_amd64.tar.gz`
- `acyn-go_v1.2.0_darwin_arm64.tar.gz`
- `checksums.txt`

### 5. Verify
```powershell
.\acyn-go.exe --version   # acyn-go v1.2.0
```

### 6. Mark as Latest on the GitHub Release page.

### 7. Hotfix
```bash
git checkout -b release/v1.2.x v1.2.0
git cherry-pick <sha>
git tag -a v1.2.1 -m "Hotfix"
git push origin release/v1.2.x v1.2.1
```
