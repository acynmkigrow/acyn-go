import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FadeUp } from "../motion/FadeUp";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  body: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  id?: string;
};

export function FeatureRow({ eyebrow, title, body, visual, reverse, id }: Props) {
  return (
    <section id={id} className="border-b border-border py-16 md:py-28">
      <div
        className={cn(
          "mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16 lg:gap-24",
          reverse && "md:[&>*:first-child]:order-2",
        )}
      >
        <FadeUp>
          <div className="max-w-xl">
            {eyebrow && (
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">{eyebrow}</div>
            )}
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {title}
            </h2>
            <div className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{body}</div>
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="flex justify-center">{visual}</div>
        </FadeUp>
      </div>
    </section>
  );
}
