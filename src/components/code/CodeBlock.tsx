import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton } from "../terminal/CopyButton";
import { cn } from "@/lib/utils";

type Props = {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
};

export function CodeBlock({ code, language = "bash", filename, className }: Props) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted px-3 py-2 sm:px-4">
        <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {filename ?? language}
        </span>
        <CopyButton value={code} />
      </div>
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        customStyle={{
          margin: 0,
          padding: "1.25rem",
          background: "transparent",
          fontSize: "13px",
          lineHeight: "1.65",
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
