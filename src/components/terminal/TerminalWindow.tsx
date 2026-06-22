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
        "relative rounded-xl overflow-hidden backdrop-blur-md bg-black/70 border border-white/10",
        variant === "glow" && "glow-cyan",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] uppercase tracking-widest text-white/40 font-mono">
            {title}
          </span>
        </div>
        {copyValue && <CopyButton value={copyValue} />}
      </div>
      <div className="p-5 font-mono text-[13px] leading-relaxed text-white/85 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
