import { Link } from "@tanstack/react-router";
import { Activity, Github } from "lucide-react";
import { PillLink } from "../ui/PillButton";

const links = [
  { to: "/", label: "Overview" },
  { to: "/hardware", label: "Hardware" },
  { to: "/install", label: "Install" },
  { to: "/guide", label: "Guide" },
  { to: "/console", label: "Console" },
  { to: "/release", label: "Release" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/60 border-b border-white/5">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="relative inline-flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
            <span className="absolute inset-0 blur-md bg-primary/40 -z-10" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            ACYN-Go
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="hover:text-white transition-colors"
              activeProps={{ className: "text-white" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/acyninnovation/acyn-go"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </nav>
        <PillLink to="/install" variant="primary" className="hidden sm:inline-flex">
          Copy Install Script
        </PillLink>
      </div>
    </header>
  );
}
