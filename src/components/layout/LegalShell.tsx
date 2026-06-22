import type { ReactNode } from "react";
import { FadeUp } from "../motion/FadeUp";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
      <FadeUp>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Legal</div>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tighter text-gradient leading-[1.05]">
          {title}
        </h1>
        {updated && <p className="text-sm text-white/40 mt-4">Last updated: {updated}</p>}
      </FadeUp>
      <FadeUp delay={0.1}>
        <article className="prose prose-invert mt-12 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-white prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-white/70 prose-li:text-white/70 prose-strong:text-white prose-a:text-primary hover:prose-a:underline prose-code:text-primary prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          {children}
        </article>
      </FadeUp>
    </div>
  );
}
