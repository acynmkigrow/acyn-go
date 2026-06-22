import { Link } from "@tanstack/react-router";
import { Activity, Github, Mail } from "lucide-react";

const cols = [
  {
    title: "Product",
    items: [
      { to: "/", label: "Overview" },
      { to: "/hardware", label: "Supported Hardware" },
      { to: "/install", label: "Installer" },
      { to: "/guide", label: "Guide" },
    ],
  },
  {
    title: "Developers",
    items: [
      { href: "https://github.com/acyninnovation/acyn-go", label: "GitHub" },
      { href: "https://github.com/acyninnovation/acyn-go/releases", label: "Releases" },
      { href: "https://github.com/acyninnovation/acyn-go/blob/main/README.md", label: "CLI Reference" },
    ],
  },
  {
    title: "Legal",
    items: [
      { to: "/legal/privacy", label: "Privacy" },
      { to: "/legal/terms", label: "Terms" },
      { to: "/legal/license", label: "MIT License" },
      { to: "/legal/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black text-white/50">
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-display text-base font-semibold text-white">ACYN-Go</span>
          </div>
          <p className="text-sm leading-relaxed">
            AI-powered CLI agent for provisioning fiber networks. Built by ACYN Innovation.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href="https://github.com/acyninnovation/acyn-go"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="mailto:info@acyninnovation.com"
              className="hover:text-white transition-colors"
              aria-label="Email"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-4">{c.title}</div>
            <ul className="space-y-2 text-sm">
              {c.items.map((it) =>
                "to" in it ? (
                  <li key={it.to}>
                    <Link to={it.to} className="hover:text-white transition-colors">
                      {it.label}
                    </Link>
                  </li>
                ) : (
                  <li key={it.href}>
                    <a
                      href={it.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      {it.label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© {new Date().getFullYear()} ACYN Innovation. MIT Licensed.</p>
          <p>
            <a href="mailto:info@acyninnovation.com" className="hover:text-white">info@acyninnovation.com</a>
            {" · "}
            <a href="mailto:support@acyninnovation.com" className="hover:text-white">support</a>
            {" · "}
            <a href="mailto:legal@acyninnovation.com" className="hover:text-white">legal</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
