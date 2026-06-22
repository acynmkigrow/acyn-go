import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost";

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  icon?: ReactNode;
};

const base =
  "group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium tracking-tight transition-all duration-300 ease-out";
const variants: Record<Variant, string> = {
  primary:
    "bg-white text-black hover:bg-primary hover:text-primary-foreground hover:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.6)] hover:-translate-y-0.5",
  ghost:
    "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5",
};

export function PillLink({
  to,
  href,
  children,
  variant = "primary",
  className,
  icon,
  ...rest
}: CommonProps & { to?: string; href?: string } & Omit<ComponentProps<"a">, "href" | "children">) {
  const cls = cn(base, variants[variant], className);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
        {icon}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {children}
      {icon}
    </a>
  );
}

export function PillButton({
  children,
  variant = "primary",
  className,
  icon,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], className)} {...rest}>
      {children}
      {icon}
    </button>
  );
}
