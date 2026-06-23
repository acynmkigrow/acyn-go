import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  copyValue?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "glow";
};

export function TerminalWindow({
  title = "powershell",
  copyValue,
  children,
  className,
  variant = "default",
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-card",
        variant === "glow" && "border-border",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 truncate text-[11px] uppercase tracking-widest text-muted-foreground font-mono sm:ml-3">
            {title}
          </span>
        </div>
        {copyValue && <CopyButton value={copyValue} />}
      </div>
      <div className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-foreground sm:p-5 sm:text-[13px]">
        {children}
      </div>
    </div>
  );
}
