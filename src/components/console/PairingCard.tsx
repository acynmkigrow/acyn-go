import { useEffect, useState } from "react";
import type { Family } from "@/lib/huawei-prompts";

export type AgentInfo = {
  vendor: string;
  model: string;
  family: Family;
  prompt: string;
};

export function PairingCard({
  status,
  device,
  onPair,
  onDisconnect,
  initialHost,
  initialPort,
  initialCode,
  autoPair,
}: {
  status: "idle" | "pairing" | "connected" | "error";
  device: AgentInfo | null;
  onPair: (host: string, port: number, code: string) => void;
  onDisconnect: () => void;
  initialHost?: string;
  initialPort?: number;
  initialCode?: string;
  autoPair?: boolean;
}) {
  const [host, setHost] = useState(initialHost || "127.0.0.1");
  const [port, setPort] = useState(initialPort || 17017);
  const [code, setCode] = useState(initialCode || "");
  const [autoTried, setAutoTried] = useState(false);

  // Re-sync if URL params arrive after mount
  useEffect(() => {
    if (initialHost) setHost(initialHost);
    if (initialPort) setPort(initialPort);
    if (initialCode) setCode(initialCode);
  }, [initialHost, initialPort, initialCode]);

  // Auto-pair from deep link once
  useEffect(() => {
    if (autoPair && !autoTried && code.length === 6 && status === "idle") {
      setAutoTried(true);
      onPair(host, port, code);
    }
  }, [autoPair, autoTried, code, status, host, port, onPair]);

  if (status === "connected" && device) {
    return (
      <div className="rounded-md border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Connected
        </div>
        <div className="mt-3 break-words font-display text-lg text-foreground">
          {device.vendor} {device.model || ""}
        </div>
        <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {device.family.toUpperCase()} · prompt: <span className="text-foreground/80">{device.prompt}</span>
        </div>
        <button
          onClick={onDisconnect}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Pair to local agent</div>
      <div className="mb-4 text-xs leading-relaxed text-muted-foreground">
        Run <code className="text-primary">acyn-go serve</code> on the same network. Paste the 6-digit code it prints, or click the pair link in your terminal to auto-fill.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="min-w-0 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
        />
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(parseInt(e.target.value) || 17017)}
          className="min-w-0 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
        placeholder="000000"
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-3 text-center font-mono text-xl tracking-[0.35em] text-foreground outline-none focus:border-primary sm:text-2xl sm:tracking-[0.5em]"
      />
      <button
        disabled={code.length !== 6 || status === "pairing"}
        onClick={() => onPair(host, port, code)}
        className="mt-3 w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
      >
        {status === "pairing" ? "Pairing…" : "Pair"}
      </button>
      {status === "error" && (
        <div className="mt-3 text-xs text-red-400">Pairing failed. Check the code and that the agent is running.</div>
      )}
    </div>
  );
}
