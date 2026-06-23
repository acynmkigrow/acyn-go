import { FadeUp } from "../motion/FadeUp";
import { Float } from "../motion/Float";
import { TerminalWindow } from "../terminal/TerminalWindow";
import { PillLink } from "../ui/PillButton";
import { ArrowRight } from "lucide-react";
import oltImg from "@/assets/hero-olt.png";

const INSTALL_CMD = "iwr -useb https://go.acyninnovation.com/install.ps1 | iex";

export function Hero() {
  return (
    <section className="relative flex min-h-[82vh] items-center overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:gap-16">
        <div className="min-w-0">
          <FadeUp>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              v1.0 · single Go binary · ~8MB
            </div>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="font-display text-4xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Provision Fiber
              <br />
              Networks in Seconds.
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A single, zero-dependency Go binary. Install via PowerShell. Configure GPON, OLT, and
              ONT devices concurrently over SSH &amp; Telnet — driven by plain-English instructions.
            </p>
          </FadeUp>
          <FadeUp delay={0.25}>
            <div className="mt-8 max-w-full sm:max-w-lg">
              <TerminalWindow title="PS C:\>" copyValue={INSTALL_CMD}>
                <div className="flex min-w-0 gap-2">
                  <span className="text-primary">PS&gt;</span>
                  <span className="break-all text-foreground">{INSTALL_CMD}</span>
                </div>
              </TerminalWindow>
            </div>
          </FadeUp>
          <FadeUp delay={0.35}>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <PillLink to="/install" icon={<ArrowRight className="h-4 w-4" />}>
                Get the installer
              </PillLink>
              <PillLink to="/guide" variant="ghost">
                Read the guide
              </PillLink>
            </div>
          </FadeUp>
        </div>
        <div className="relative hidden min-w-0 md:block md:h-[460px] lg:h-[520px]">
          <Float duration={7} className="absolute inset-0 flex items-center justify-center">
            <img
              src={oltImg}
              alt="ACYN-Go orchestrating an OLT chassis"
              className="max-h-[400px] w-auto object-contain lg:max-h-[440px]"
            />
          </Float>
          <Float duration={5} amplitude={10} className="absolute bottom-0 right-0 w-[min(340px,92%)]">
            <TerminalWindow title="acyn-go session">
              <div className="space-y-1.5">
                <div><span className="text-primary">acyn-go&gt;</span> Set SSID FamilyNet WPA2 Home2025</div>
                <div className="text-muted-foreground">■ Plan: configure WLAN radio 0/0/0</div>
                <div className="text-accent">  ✓ interface wlan-radio 0/0/0</div>
                <div className="text-accent">  ✓ ssid FamilyNet</div>
                <div className="text-accent">  ✓ wpa2-psk ascii Home2025</div>
                <div className="text-accent">  ✓ save</div>
                <div className="text-muted-foreground">■ Done in 412ms</div>
              </div>
            </TerminalWindow>
          </Float>
        </div>
      </div>
    </section>
  );
}
