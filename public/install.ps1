#Requires -Version 5.1
<#
.SYNOPSIS
  One-line installer for ACYN-Go.
.DESCRIPTION
  Detects architecture, downloads the latest signed release from GitHub,
  extracts to %LOCALAPPDATA%\acyn-go, adds it to the user PATH, and optionally
  prompts for a Gemini or OpenAI API key.

  Usage (default — ACYN's hosted build):
    iwr -useb https://go.acyninnovation.com/install.ps1 | iex

  Usage (a different GitHub repo):
    $env:ACYN_REPO = "yourgithubuser/yourrepo"
    iwr -useb https://go.acyninnovation.com/install.ps1 | iex
#>

$ErrorActionPreference = 'Stop'

# Repo can be overridden with $env:ACYN_REPO = "owner/name"
$repo = if ($env:ACYN_REPO) { $env:ACYN_REPO } else { 'acynmkigrow/acyn-go' }
$RepoOwner, $RepoName = $repo.Split('/', 2)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " ACYN-Go installer" -ForegroundColor Cyan
Write-Host " AI-Powered Huawei Device Configuration Agent" -ForegroundColor DarkCyan
Write-Host " Source: $RepoOwner/$RepoName" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detect arch
$arch = if ([Environment]::Is64BitOperatingSystem) { 'amd64' } else { '386' }
if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }
Write-Host "[1/5] Detected platform: windows/$arch" -ForegroundColor Green

# 2. Resolve latest release
Write-Host "[2/5] Resolving latest release..." -ForegroundColor Green
try {
  $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest" -UseBasicParsing
  $tag = $rel.tag_name
} catch {
  Write-Host ""
  Write-Error @"
Could not resolve the latest release for $RepoOwner/$RepoName.

Likely causes:
  - The repo has no published releases yet. In GitHub, open the repo's
    Actions tab and confirm the release workflow exists. Then push a tag from
    the repo root, e.g.:
        git tag -a v1.0.0 -m v1.0.0
        git push origin v1.0.0
    The workflow must finish successfully and upload the Windows zip.
  - The repo name is wrong. Override with:
        `$env:ACYN_REPO = "owner/repo"`
        iwr -useb https://go.acyninnovation.com/install.ps1 | iex
  - GitHub API rate limit. Wait a minute and retry.
"@
  exit 1
}
$asset = "acyn-go_${tag}_windows_${arch}.zip"
$url   = "https://github.com/$RepoOwner/$RepoName/releases/download/$tag/$asset"
Write-Host "       $url"

# 3. Download + extract
$dest = "$env:USERPROFILE\AppData\Local\acyn-go"
$tmp  = Join-Path $env:TEMP "acyn-go.zip"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Host "[3/5] Downloading..." -ForegroundColor Green
try {
  Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
} catch {
  Write-Host ""
  Write-Error @"
Download failed: $url

The release $tag exists but no asset named ``$asset`` was found on it.
Check https://github.com/$RepoOwner/$RepoName/releases/tag/$tag and confirm
the GoReleaser workflow ran and uploaded the Windows archive.
"@
  exit 1
}
Write-Host "       Extracting to $dest"
Expand-Archive -LiteralPath $tmp -DestinationPath $dest -Force
Remove-Item $tmp -Force

# 4. Add to PATH
Write-Host "[4/5] Updating PATH..." -ForegroundColor Green
$userPath = [Environment]::GetEnvironmentVariable('PATH','User')
if ($userPath -notlike "*$dest*") {
  [Environment]::SetEnvironmentVariable('PATH', "$userPath;$dest", 'User')
  $env:PATH += ";$dest"
}

# 5. Optional API key prompt
Write-Host "[5/5] AI provider key (optional, press Enter to skip)" -ForegroundColor Green
$key = Read-Host "       GEMINI_API_KEY"
if ($key) {
  [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $key, 'User')
  $env:GEMINI_API_KEY = $key
  Write-Host "       Saved."
} else {
  Write-Host "       Skipped — set it later with:"
  Write-Host "         [Environment]::SetEnvironmentVariable('GEMINI_API_KEY','your-key','User')"
}

Write-Host ""
Write-Host "  ACYN-Go installed." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    1. Restart PowerShell (or run: refreshenv)"
Write-Host "    2. Verify:     acyn-go --version"
Write-Host "    3. Configure:  acyn-go"
Write-Host ""
Write-Host "  Docs: https://go.acyninnovation.com/guide" -ForegroundColor DarkCyan
Write-Host ""
