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
    <section id={id} className="py-24 md:py-36">
      <div
        className={cn(
          "mx-auto max-w-7xl px-6 grid gap-16 md:gap-24 items-center md:grid-cols-2",
          reverse && "md:[&>*:first-child]:order-2",
        )}
      >
        <FadeUp>
          <div className="max-w-xl">
            {eyebrow && (
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">{eyebrow}</div>
            )}
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-gradient leading-[1.05]">
              {title}
            </h2>
            <div className="mt-6 text-lg text-white/60 leading-relaxed">{body}</div>
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="flex justify-center">{visual}</div>
        </FadeUp>
      </div>
    </section>
  );
}
