import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code/CodeBlock";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { FadeUp } from "@/components/motion/FadeUp";
import { buildMeta } from "@/components/seo/Seo";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/install")({
  head: () => buildMeta({
    title: "Install ACYN-Go — One-line PowerShell installer",
    description: "Install the ACYN-Go CLI agent on Windows, Linux or macOS in seconds with a single PowerShell or shell command.",
    path: "/install",
  }),
  component: Install,
});

const ONE_LINER = "iwr -useb https://go.acyninnovation.com/install.ps1 | iex";

const MANUAL = `# 1. Install Go (PowerShell, as Administrator)
winget install GoLang.Go

# 2. Enable Telnet client (optional, for legacy OLTs)
dism /online /Enable-Feature /FeatureName:TelnetClient

# 3. Web GUI users do not need an AI key
# Optional only for standalone CLI mode:
# [System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY","YOUR_KEY_HERE","User")

# 4. Download latest release binary
$ver = (iwr https://api.github.com/repos/acyninnovation/acyn-go/releases/latest | ConvertFrom-Json).tag_name
iwr "https://github.com/acyninnovation/acyn-go/releases/download/$ver/acyn-go_windows_amd64.zip" -OutFile acyn-go.zip
Expand-Archive acyn-go.zip -DestinationPath C:\\Tools\\acyn-go -Force

# 5. Add to PATH
$env:PATH += ";C:\\Tools\\acyn-go"
[System.Environment]::SetEnvironmentVariable("PATH",$env:PATH,"User")`;

const FIRST_RUN = `PS C:\\> acyn-go

████████████████████████████████████████
█        ACYN-Go  v1.0                █
█  AI-Powered Huawei Device Agent     █
████████████████████████████████████████

Device IP: 192.168.1.1
Protocol (telnet/ssh) [telnet]:
Port [23]:
Username [admin]: admin
Password: ********
Device type (hg/gpon/xpon/olt) [hg]: hg

■ Connected!
Type your instruction in plain English. Type 'quit' to exit.

acyn-go> Set SSID to FamilyNet with WPA2 password Home2025

■ Plan: Configure WLAN radio with new SSID and WPA2 PSK
Commands to execute:
  1. interface wlan-radio 0/0/0
  2. ssid FamilyNet
  3. security-policy wpa2-psk
  4. wpa2-psk ascii Home2025
  5. quit
  6. save

Proceed? [y/N]: y
  > interface wlan-radio 0/0/0     [OK]
  > ssid FamilyNet                 [OK]
  > security-policy wpa2-psk       [OK]
  > wpa2-psk ascii Home2025        [OK]
  > save                           [OK]
■ Done in 412ms.`;

function Install() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
      <FadeUp>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Installer</div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tighter text-gradient leading-[1.05]">
          One command. <br /> Then provision anything.
        </h1>
        <p className="mt-6 text-lg text-white/60 max-w-2xl">
          Open PowerShell as Administrator and paste the command below. The installer detects your
          architecture, fetches the latest signed release from GitHub, adds <code className="text-primary">acyn-go</code> to your PATH,
          and opens the paired web console. Web GUI users use the project AI keys automatically.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div className="mt-10">
          <TerminalWindow title="PowerShell" copyValue={ONE_LINER} variant="glow">
            <div className="flex gap-2">
              <span className="text-primary">PS&gt;</span>
              <span>{ONE_LINER}</span>
            </div>
          </TerminalWindow>
        </div>
      </FadeUp>

      <FadeUp delay={0.2}>
        <div className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight mb-6">What the installer does</h2>
          <ul className="space-y-3 text-white/70">
            {[
              "Detects your OS and CPU architecture (windows/amd64, linux/amd64, darwin/arm64).",
              "Downloads the latest signed release archive from github.com/acyninnovation/acyn-go.",
              "Extracts to C:\\Tools\\acyn-go (or ~/.local/bin on Unix) and adds it to your user PATH.",
              "Uses the project Gemini key in the web GUI; local AI keys are optional only for standalone CLI mode.",
              "Verifies the install with acyn-go --version.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-glow shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </FadeUp>

      <FadeUp delay={0.3}>
        <div className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight mb-6">Manual install</h2>
          <p className="text-white/60 mb-6">
            Prefer to do it by hand, or running on an air-gapped jump host? Follow the steps below.
          </p>
          <CodeBlock code={MANUAL} language="powershell" filename="manual-install.ps1" />
        </div>
      </FadeUp>

      <FadeUp delay={0.4}>
        <div className="mt-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight mb-6">First run</h2>
          <CodeBlock code={FIRST_RUN} language="bash" filename="acyn-go session" />
        </div>
      </FadeUp>
    </div>
  );
}
