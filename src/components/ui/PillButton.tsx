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
  "group inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium tracking-tight transition-colors duration-200 ease-out";
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost:
    "border border-border bg-secondary text-secondary-foreground hover:bg-muted",
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
