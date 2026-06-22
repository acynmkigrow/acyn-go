import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code/CodeBlock";
import { SectionNav } from "@/components/layout/SectionNav";
import { FadeUp } from "@/components/motion/FadeUp";
import { buildMeta } from "@/components/seo/Seo";
import type { ReactNode } from "react";

export const Route = createFileRoute("/guide")({
  head: () => buildMeta({
    title: "ACYN-Go Guide — End-to-End Configuration Walkthrough",
    description: "Prerequisites, project structure, first run, device recipes (HG / GPON / OLT), troubleshooting and extending ACYN-Go.",
    path: "/guide",
  }),
  component: Guide,
});

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="py-16 scroll-mt-32">
      <FadeUp>
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-gradient mb-6">
          {title}
        </h2>
        <div className="space-y-6 text-white/70 leading-relaxed">{children}</div>
      </FadeUp>
    </section>
  );
}

function Guide() {
  return (
    <>
      <SectionNav
        items={[
          { id: "prereqs", label: "Prerequisites" },
          { id: "structure", label: "Structure" },
          { id: "firstrun", label: "First Run" },
          { id: "recipes", label: "Device Recipes" },
          { id: "troubleshoot", label: "Troubleshooting" },
          { id: "extend", label: "Extending" },
        ]}
      />
      <div className="mx-auto max-w-4xl px-6 pt-12 pb-32">
        <FadeUp>
          <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Guide · v1.0</div>
          <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tighter text-gradient leading-[1.05]">
            Build, install &amp; operate ACYN-Go.
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-2xl">
            A complete walkthrough — from a clean Windows host to a production fibre network being
            provisioned by AI in under 15 minutes.
          </p>
        </FadeUp>

        <Section id="prereqs" title="1. Prerequisites">
          <p>Open PowerShell as Administrator and run:</p>
          <CodeBlock code={`winget install GoLang.Go\nwinget install Git.Git\ndism /online /Enable-Feature /FeatureName:TelnetClient\nAdd-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`} language="powershell" />
          <p>Grab a free AI key from <a className="text-primary hover:underline" href="https://aistudio.google.com" target="_blank" rel="noreferrer">Google AI Studio</a> (Gemini Flash, 60 req/min free) or <a className="text-primary hover:underline" href="https://platform.openai.com" target="_blank" rel="noreferrer">OpenAI</a>, then export it:</p>
          <CodeBlock code={`[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY","YOUR_KEY_HERE","User")`} language="powershell" />
        </Section>

        <Section id="structure" title="2. Project Structure">
          <p>If you want to build from source rather than use the installer, clone the repo:</p>
          <CodeBlock code={`git clone https://github.com/acyninnovation/acyn-go.git\ncd acyn-go\ngo mod tidy\ngo build -ldflags='-s -w' -o acyn-go.exe .`} language="powershell" />
          <p>The layout:</p>
          <CodeBlock code={`acyn-go/
├── main.go                  Entry point, REPL loop
├── internal/
│   ├── config/              Session struct (IP, proto, creds, device type)
│   ├── transport/           ssh.go, telnet.go, transport.go interface
│   ├── devices/             hg.go, gpon.go, olt.go, registry.go
│   ├── agent/               agent.go, prompts.go, llm/{gemini,openai}.go
│   └── ui/                  prompt.go, logger.go
├── .goreleaser.yaml         Cross-platform release matrix
└── .github/workflows/release.yml`} language="text" />
        </Section>

        <Section id="firstrun" title="3. First Run">
          <CodeBlock code={`PS C:\\> acyn-go
Device IP: 192.168.1.1
Protocol (telnet/ssh) [telnet]:
Port [23]:
Username [admin]: admin
Password: ********
Device type (hg/gpon/xpon/olt) [hg]: hg

■ Connected!
acyn-go> Show all connected clients
■ Plan: List DHCP leases on the LAN interface
Commands:
  1. display dhcp-server pool
Proceed? [y/N]: y
  > display dhcp-server pool        [OK]
■ Done.`} language="bash" />
        </Section>

        <Section id="recipes" title="4. Device-Specific Recipes">
          <p>Copy these plain-English prompts straight into the agent REPL.</p>
          <h3 className="text-white text-lg font-semibold mt-6">HG router</h3>
          <CodeBlock code={`acyn-go> Set primary DNS to 8.8.8.8 and secondary to 1.1.1.1 on WAN
acyn-go> Enable HTTP remote management on WAN port 8080
acyn-go> Block device with MAC aa:bb:cc:dd:ee:ff from the network`} language="bash" />
          <h3 className="text-white text-lg font-semibold mt-6">GPON ONT</h3>
          <CodeBlock code={`acyn-go> Switch to bridge mode and tag uplink with VLAN 200
acyn-go> Inject PPPoE credentials user=fiber@isp pass=Secret99`} language="bash" />
          <h3 className="text-white text-lg font-semibold mt-6">MA5800 OLT</h3>
          <CodeBlock code={`acyn-go> Reset the ONT with index 0 on PON port 0
acyn-go> Create VLAN 100 for management and bind to uplink 0/19/0
acyn-go> Display all currently active alarms on the OLT
acyn-go> Save a backup of the current configuration to device flash`} language="bash" />
        </Section>

        <Section id="troubleshoot" title="5. Troubleshooting">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/50 text-left">
                <tr><th className="py-3 pr-6">Symptom</th><th className="py-3 pr-6">Likely cause</th><th className="py-3">Fix</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/75">
                <tr><td className="py-3 pr-6">Connection refused on port 23</td><td className="py-3 pr-6">Telnet disabled on device</td><td className="py-3">Enable Telnet service via serial/web UI</td></tr>
                <tr><td className="py-3 pr-6">Auth failed over SSH</td><td className="py-3 pr-6">Modern Huawei OLTs need legacy KEX</td><td className="py-3">Pass <code>--ssh-legacy</code> flag</td></tr>
                <tr><td className="py-3 pr-6">API key error from Gemini</td><td className="py-3 pr-6">Env var not set in current shell</td><td className="py-3"><code>$env:GEMINI_API_KEY="..."</code></td></tr>
                <tr><td className="py-3 pr-6">Hangs after first command</td><td className="py-3 pr-6">Prompt regex didn't match</td><td className="py-3">Use <code>--debug</code> to dump raw output</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="extend" title="6. Extending the Agent">
          <p>Add new device families by dropping a file into <code className="text-primary">internal/devices/</code> and registering it. Switch the AI provider by swapping <code className="text-primary">internal/agent/llm/</code> implementations. Session logs land in <code className="text-primary">~/.acyn-go/sessions/</code>.</p>
          <CodeBlock code={`// internal/devices/mikrotik.go
package devices

func init() {
  Register("mikrotik", Profile{
    Prompts: []string{"] >", "] >>"},
    LoginCmds: []string{},
    SaveCmd: "/system backup save",
  })
}`} language="go" />
        </Section>
      </div>
    </>
  );
}
