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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid h-auto min-h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 md:flex md:justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2 group">
          <span className="inline-flex shrink-0 items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </span>
          <span className="truncate font-display text-base font-semibold tracking-tight text-foreground">
            ACYN-Go
          </span>
        </Link>
        <nav className="order-3 col-span-2 flex items-center gap-4 overflow-x-auto pb-1 text-sm text-muted-foreground md:order-none md:col-span-1 md:gap-6 md:overflow-visible md:pb-0">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="shrink-0 hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/acyninnovation/acyn-go"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </nav>
        <PillLink to="/console" variant="primary" className="justify-self-end px-3 py-2 sm:px-4">
          Console
        </PillLink>
      </div>
    </header>
  );
}
