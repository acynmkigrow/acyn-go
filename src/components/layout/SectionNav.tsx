import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SectionItem = { id: string; label: string };

export function SectionNav({ items }: { items: SectionItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(it.id);
          });
        },
        { rootMargin: "-30% 0px -60% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  return (
    <div className="sticky top-[105px] z-40 border-b border-border bg-background/95 backdrop-blur sm:top-16">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 overflow-x-auto px-4 text-sm sm:px-6 md:gap-6">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={cn(
              "relative whitespace-nowrap py-3 transition-colors",
              active === it.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
            {active === it.id && (
              <span className="absolute left-0 right-0 -bottom-px h-px bg-primary" />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
