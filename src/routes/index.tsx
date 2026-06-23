import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero/Hero";
import { FeatureRow } from "@/components/features/FeatureRow";
import { HardwareGrid } from "@/components/hardware/HardwareGrid";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { CodeBlock } from "@/components/code/CodeBlock";
import { Float } from "@/components/motion/Float";
import { FadeUp } from "@/components/motion/FadeUp";
import { SectionNav } from "@/components/layout/SectionNav";
import { PillLink } from "@/components/ui/PillButton";
import { buildMeta } from "@/components/seo/Seo";
import chipImg from "@/assets/feature-chip.png";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => buildMeta({
    title: "ACYN-Go — AI-Powered Fiber Network CLI Agent",
    description: "Single Go binary. Install via PowerShell. Configure GPON, OLT, ONT and HG devices over SSH & Telnet using plain English.",
    path: "/",
  }),
  component: Home,
});

const POWERSHELL_DEPLOY = `# Bypass execution policy for current session
Set-ExecutionPolicy -Scope Process Bypass -Force

# Install with one line
iwr -useb https://go.acyninnovation.com/install.ps1 | iex

# Verify
acyn-go --version

# Configure a ZTE GPON OLT interactively
acyn-go configure --ip 192.168.1.50 --profile zte_gpon`;

function Home() {
  return (
    <>
      <Hero />
      <SectionNav
        items={[
          { id: "overview", label: "Overview" },
          { id: "architecture", label: "Architecture" },
          { id: "protocols", label: "GPON / xPON" },
          { id: "hardware", label: "Hardware" },
          { id: "deploy", label: "Deploy" },
        ]}
      />

      <FeatureRow
        id="overview"
        eyebrow="The Power of Go"
        title={<>Compiled for Speed. <br /> Zero Dependencies.</>}
        body={
          <>
            A single static binary cross-compiled for Windows, Linux and macOS. No runtime, no
            JVM, no Python — just drop the executable on a jump host and provision devices
            concurrently across thousands of fibres.
          </>
        }
        visual={
          <Float duration={8}>
            <img src={chipImg} alt="Compiled binary chip" className="max-h-72 w-auto object-contain sm:max-h-80" loading="lazy" />
          </Float>
        }
      />

      <FeatureRow
        id="architecture"
        reverse
        eyebrow="Legacy & Modern Protocols"
        title={<>Bridging the Gap.</>}
        body={
          <>
            Native Telnet for legacy MA5600 OLTs. Modern SSH for next-gen xPON architectures.
            Plain-English intent is translated into vendor-specific CLI plans, reviewed, then
            applied with rollback-aware confirmations.
          </>
        }
        visual={
          <Float duration={6}>
            <TerminalWindow title="ssh + telnet" variant="glow" className="w-[460px] max-w-full">
              <div className="space-y-1">
                <div className="text-muted-foreground"># two sessions, one agent</div>
                <div><span className="text-primary">[ssh]</span> 10.0.0.1:22 → MA5800 OLT</div>
                <div className="text-accent">  ✓ display version</div>
                <div className="text-accent">  ✓ vlan 100</div>
                <div><span className="text-primary">[telnet]</span> 10.0.0.2:23 → HG8245H</div>
                <div className="text-accent">  ✓ wlan ssid FamilyNet</div>
                <div className="text-accent">  ✓ save</div>
                <div className="text-muted-foreground">■ 2 devices · 7 commands · 412ms</div>
              </div>
            </TerminalWindow>
          </Float>
        }
      />

      <section id="protocols" className="border-b border-border py-16 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FadeUp>
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">GPON · XPON · OLT</div>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Built around the protocols you already run.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Device-aware command templates for HG series, GPON ONTs, XPON ONUs, and MA5600/5800 OLT platforms.
                The agent waits for the right prompt, captures output, and surfaces vendor errors with context.
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      <section id="hardware" className="border-b border-border py-16 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <FadeUp>
            <div className="max-w-2xl mb-16">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Supported Hardware</div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                One agent. Every fibre device on your bench.
              </h2>
            </div>
          </FadeUp>
          <HardwareGrid />
        </div>
      </section>

      <section id="deploy" className="py-16 md:py-28">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <FadeUp>
            <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Deploy</div>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl md:text-6xl">
              Deploys on Windows Server in one line.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              No installer wizard. No MSI. One PowerShell command pulls the latest signed release, sets up your PATH,
              and prompts for your AI key.
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="mt-12 text-left">
              <CodeBlock code={POWERSHELL_DEPLOY} language="powershell" filename="install.ps1" />
            </div>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <PillLink to="/install" icon={<ArrowRight className="h-4 w-4" />}>Open the installer</PillLink>
              <PillLink to="/guide" variant="ghost">Read the full guide</PillLink>
            </div>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
