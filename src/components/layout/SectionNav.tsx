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
    <div className="sticky top-16 z-40 backdrop-blur-md bg-black/70 border-b border-white/5">
      <div className="mx-auto max-w-7xl px-6 h-12 flex items-center gap-6 overflow-x-auto text-sm">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={cn(
              "relative py-3 whitespace-nowrap transition-colors",
              active === it.id ? "text-white font-medium" : "text-white/50 hover:text-white/80",
            )}
          >
            {it.label}
            {active === it.id && (
              <span className="absolute left-0 right-0 -bottom-px h-px bg-primary shadow-[0_0_8px_var(--primary)]" />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
