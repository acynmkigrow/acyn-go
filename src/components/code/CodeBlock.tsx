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
    <div className={cn("rounded-xl overflow-hidden border border-white/10 bg-black/60 backdrop-blur-md", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
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
