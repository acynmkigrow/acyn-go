import { ArrowRight } from "lucide-react";

type Props = {
  image: string;
  title: string;
  subtitle: string;
  href?: string;
  glow?: "cyan" | "emerald";
};

export function HardwareItem({ image, title, subtitle, href = "/guide", glow = "cyan" }: Props) {
  const glowClass = glow === "cyan" ? "glow-cyan" : "glow-emerald";
  return (
    <a href={href} className="group block text-center px-6 py-10">
      <div className="relative h-56 flex items-end justify-center transition-transform duration-500 ease-out group-hover:-translate-y-3">
        <img src={image} alt={title} className={`max-h-full w-auto ${glowClass}`} />
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-10 w-40 rounded-full bg-primary/0 group-hover:bg-primary/20 blur-2xl transition-all duration-500"
        />
      </div>
      <h3 className="mt-8 font-display text-xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/55 max-w-xs mx-auto leading-relaxed">{subtitle}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary opacity-0 -translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
        View Config Specs <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}
