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
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-28">
      <FadeUp>
        <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">Legal</div>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {updated && <p className="mt-4 text-sm text-muted-foreground">Last updated: {updated}</p>}
      </FadeUp>
      <FadeUp delay={0.1}>
        <article className="prose prose-invert mt-10 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-2xl prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-primary prose-code:before:content-none prose-code:after:content-none">
          {children}
        </article>
      </FadeUp>
    </div>
  );
}
