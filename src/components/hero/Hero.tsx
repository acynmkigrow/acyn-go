import { FadeUp } from "../motion/FadeUp";
import { Float } from "../motion/Float";
import { TerminalWindow } from "../terminal/TerminalWindow";
import { PillLink } from "../ui/PillButton";
import { ArrowRight } from "lucide-react";
import oltImg from "@/assets/hero-olt.png";

const INSTALL_CMD = "iwr -useb https://go.acyninnovation.com/install.ps1 | iex";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 30%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(ellipse 70% 50% at 85% 70%, rgba(16,185,129,0.08), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-6 py-24 grid md:grid-cols-2 gap-16 items-center w-full">
        <div>
          <FadeUp>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 mb-6 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-glow shadow-[0_0_8px_var(--emerald-glow)]" />
              v1.0 · single Go binary · ~8MB
            </div>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tighter leading-[0.95] text-gradient">
              Provision Fiber
              <br />
              Networks in Seconds.
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="mt-7 text-lg text-white/55 max-w-xl leading-relaxed">
              A single, zero-dependency Go binary. Install via PowerShell. Configure GPON, OLT, and
              ONT devices concurrently over SSH &amp; Telnet — driven by plain-English instructions.
            </p>
          </FadeUp>
          <FadeUp delay={0.25}>
            <div className="mt-8 max-w-lg">
              <TerminalWindow title="PS C:\>" copyValue={INSTALL_CMD} variant="glow">
                <div className="flex gap-2">
                  <span className="text-primary">PS&gt;</span>
                  <span className="text-white/90">{INSTALL_CMD}</span>
                </div>
              </TerminalWindow>
            </div>
          </FadeUp>
          <FadeUp delay={0.35}>
            <div className="mt-7 flex items-center gap-3">
              <PillLink to="/install" icon={<ArrowRight className="h-4 w-4" />}>
                Get the installer
              </PillLink>
              <PillLink to="/guide" variant="ghost">
                Read the guide
              </PillLink>
            </div>
          </FadeUp>
        </div>
        <div className="relative h-[520px] hidden md:block">
          <Float duration={7} className="absolute inset-0 flex items-center justify-center">
            <img
              src={oltImg}
              alt="ACYN-Go orchestrating an OLT chassis"
              className="max-h-[440px] w-auto glow-cyan"
            />
          </Float>
          <Float duration={5} amplitude={10} className="absolute bottom-0 right-0 w-[340px]">
            <TerminalWindow title="acyn-go session" variant="glow">
              <div className="space-y-1.5">
                <div><span className="text-primary">acyn-go&gt;</span> Set SSID FamilyNet WPA2 Home2025</div>
                <div className="text-white/50">■ Plan: configure WLAN radio 0/0/0</div>
                <div className="text-emerald-glow">  ✓ interface wlan-radio 0/0/0</div>
                <div className="text-emerald-glow">  ✓ ssid FamilyNet</div>
                <div className="text-emerald-glow">  ✓ wpa2-psk ascii Home2025</div>
                <div className="text-emerald-glow">  ✓ save</div>
                <div className="text-white/60">■ Done in 412ms</div>
              </div>
            </TerminalWindow>
          </Float>
        </div>
      </div>
    </section>
  );
}
