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
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-28">
      <FadeUp>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Supported Hardware</div>
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
          From legacy OLT racks to next-gen ONTs.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          ACYN-Go ships device-aware command templates for the most deployed fibre hardware on the
          planet. The agent waits for the right prompt, captures output, and surfaces vendor errors
          in plain English.
        </p>
      </FadeUp>
      <div className="mt-12 md:mt-20">
        <HardwareGrid />
      </div>
    </div>
  );
}
