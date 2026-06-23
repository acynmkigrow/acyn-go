import { HardwareItem } from "./HardwareItem";
import { FadeUp } from "../motion/FadeUp";
import oltImg from "@/assets/hardware-olt.png";
import ontImg from "@/assets/hardware-ont.png";
import switchImg from "@/assets/hardware-switch.png";

const items = [
  {
    image: oltImg,
    title: "High-Density OLTs",
    subtitle: "ZTE, Huawei, & Nokia chassis. Automated VLAN & TCONT provisioning.",
    glow: "cyan" as const,
  },
  {
    image: ontImg,
    title: "GPON / EPON ONTs",
    subtitle: "Bridge & Router mode configuration, PPPoE credentials injection.",
    glow: "emerald" as const,
  },
  {
    image: switchImg,
    title: "Core / Edge Switches",
    subtitle: "Uplink configuration via SSH. Cisco, Juniper, and MikroTik.",
    glow: "cyan" as const,
  },
];

export function HardwareGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <FadeUp key={it.title} delay={i * 0.1}>
          <HardwareItem {...it} />
        </FadeUp>
      ))}
    </div>
  );
}
