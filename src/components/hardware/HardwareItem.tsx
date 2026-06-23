import { ArrowRight } from "lucide-react";

type Props = {
  image: string;
  title: string;
  subtitle: string;
  href?: string;
  glow?: "cyan" | "emerald";
};

export function HardwareItem({ image, title, subtitle, href = "/guide", glow = "cyan" }: Props) {
  return (
    <a href={href} className="group block rounded-md border border-border bg-card px-5 py-8 text-center transition-colors hover:border-primary/60 hover:bg-muted/60 sm:px-6">
      <div className="relative flex h-44 items-end justify-center sm:h-52">
        <img src={image} alt={title} className="max-h-full w-auto object-contain transition-transform duration-300 group-hover:-translate-y-1" />
      </div>
      <h3 className="mt-7 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary transition-colors group-hover:text-primary/90">
        View Config Specs <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}
