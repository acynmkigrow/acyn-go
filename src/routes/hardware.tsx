import { createFileRoute } from "@tanstack/react-router";
import { HardwareGrid } from "@/components/hardware/HardwareGrid";
import { FadeUp } from "@/components/motion/FadeUp";
import { buildMeta } from "@/components/seo/Seo";

export const Route = createFileRoute("/hardware")({
  head: () => buildMeta({
    title: "Supported Hardware — ACYN-Go",
    description: "OLTs, ONTs, ONUs and edge switches supported by the ACYN-Go agent. Huawei, ZTE, Nokia, Cisco, Juniper, MikroTik.",
    path: "/hardware",
  }),
  component: Hardware,
});

function Hardware() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <FadeUp>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Supported Hardware</div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tighter text-gradient leading-[1.05] max-w-3xl">
          From legacy OLT racks to next-gen ONTs.
        </h1>
        <p className="mt-6 text-lg text-white/60 max-w-2xl">
          ACYN-Go ships device-aware command templates for the most deployed fibre hardware on the
          planet. The agent waits for the right prompt, captures output, and surfaces vendor errors
          in plain English.
        </p>
      </FadeUp>
      <div className="mt-20">
        <HardwareGrid />
      </div>
    </div>
  );
}
