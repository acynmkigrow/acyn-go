import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "@/components/layout/LegalShell";
import { buildMeta } from "@/components/seo/Seo";
import { Mail, MessageCircle, Shield, Code2 } from "lucide-react";

export const Route = createFileRoute("/legal/contact")({
  head: () => buildMeta({
    title: "Contact — ACYN-Go",
    description: "Get in touch with ACYN Innovation about ACYN-Go: general, support, legal and developer contacts.",
    path: "/legal/contact",
  }),
  component: Contact,
});

const channels = [
  { icon: Mail, title: "General", email: "info@acyninnovation.com", desc: "Sales, partnerships, press." },
  { icon: MessageCircle, title: "Support", email: "support@acyninnovation.com", desc: "Bug reports, configuration help." },
  { icon: Shield, title: "Legal & Privacy", email: "legal@acyninnovation.com", desc: "Compliance, takedowns, privacy requests." },
  { icon: Code2, title: "Developer", email: "okelojnr@acyninnovation.com", desc: "Maintainer — Okelo Jnr." },
];

function Contact() {
  return (
    <LegalShell title="Contact">
      <p className="mb-10">
        ACYN-Go is built and maintained by ACYN Innovation. Reach the right team directly using one
        of the channels below.
      </p>
      <div className="not-prose grid sm:grid-cols-2 gap-6">
        {channels.map((c) => (
          <a
            key={c.email}
            href={`mailto:${c.email}`}
            className="group block p-6 rounded-xl border border-white/10 hover:border-primary/40 hover:bg-white/5 transition-all"
          >
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-lg font-semibold text-white">{c.title}</div>
            <div className="text-sm text-white/55 mt-1">{c.desc}</div>
            <div className="text-sm text-primary mt-3 group-hover:underline">{c.email}</div>
          </a>
        ))}
      </div>
    </LegalShell>
  );
}
