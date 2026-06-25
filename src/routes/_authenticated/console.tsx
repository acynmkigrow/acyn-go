import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Trash2, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { planConfig, type Plan } from "@/lib/agent.functions";
import { useServerFn } from "@tanstack/react-start";
import { PairingCard } from "@/components/console/PairingCard";
import { useAgentSocket, type ExecMessage } from "@/components/console/useAgentSocket";
import { EditablePlan } from "@/components/console/EditablePlan";
import { Wizard, RECIPES } from "@/components/console/Wizard";
import { DiscoverPanel } from "@/components/console/DiscoverPanel";
import type { Family } from "@/lib/huawei-prompts";

export const Route = createFileRoute("/_authenticated/console")({
  validateSearch: (search: Record<string, unknown>) => ({
    pair: typeof search.pair === "string" ? search.pair : undefined,
    host: typeof search.host === "string" ? search.host : undefined,
    port: typeof search.port === "string" ? search.port : undefined,
    auto: typeof search.auto === "string" ? search.auto : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Console · ACYN-Go" },
      { name: "description", content: "Chat with the ACYN-Go agent and configure Huawei, MikroTik, and Cisco devices from your browser." },
    ],
  }),
  component: ConsolePage,
});

type ChatMsg =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      plan?: Plan;
      output?: string;
      verifyOutput?: string;
      rollbackOutput?: string;
      ran?: boolean;
      ok?: boolean;
      verifyRan?: boolean;
      rollbackRan?: boolean;
    };

type RunPhase = "apply" | "verify" | "rollback";

function phaseKey(id: string, phase: RunPhase) {
  return phase === "apply" ? id : `${id}::${phase}`;
}
function splitPhaseId(rawId: string): { id: string; phase: RunPhase } {
  if (rawId.endsWith("::verify")) return { id: rawId.slice(0, -8), phase: "verify" };
  if (rawId.endsWith("::rollback")) return { id: rawId.slice(0, -10), phase: "rollback" };
  return { id: rawId, phase: "apply" };
}

const STORAGE_KEY = "acyn-go.console.messages.v1";

function loadMessages(): ChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMsg[]) : [];
  } catch {
    return [];
  }
}

function ConsolePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState<Family>("hg");
  const [pendingExecId, setPendingExecId] = useState<string | null>(null);
  const outputBufRef = useRef<Map<string, string>>(new Map());
  const callPlanConfig = useServerFn(planConfig);

  const onSocketMsg = useCallback((m: ExecMessage) => {
    if (m.type === "output") {
      const cur = outputBufRef.current.get(m.id) ?? "";
      outputBufRef.current.set(m.id, cur + m.line + "\n");
      setMessages((prev) =>
        prev.map((msg) => (msg.id === m.id ? { ...msg, output: outputBufRef.current.get(m.id) } : msg)),
      );
    } else if (m.type === "done") {
      const finalOutput = outputBufRef.current.get(m.id) ?? "";
      setMessages((prev) =>
        prev.map((msg) => (msg.id === m.id ? { ...msg, ran: true, ok: m.ok, output: finalOutput } : msg)),
      );
      void (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        await supabase.from("command_runs").insert({
          user_id: u.user.id,
          intent: "",
          family,
          commands: [],
          output: finalOutput,
          ok: m.ok,
          duration_ms: m.durationMs,
        });
      })();
      setPendingExecId(null);
    }
  }, [family]);

  const { status, device, pair, exec, disconnect, discover, connectDevice } = useAgentSocket(onSocketMsg);

  // Sync family from connected device
  useEffect(() => {
    if (device?.family) setFamily(device.family);
  }, [device]);

  // Persist messages
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Clear pair params from URL once consumed so reload doesn't re-pair
  useEffect(() => {
    if (status === "connected" && (search.pair || search.host || search.port)) {
      void navigate({ to: "/console", search: {}, replace: true });
    }
  }, [status, search.pair, search.host, search.port, navigate]);

  const initialPort = useMemo(() => {
    const n = search.port ? parseInt(search.port) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [search.port]);

  async function send(text?: string) {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    const userId = crypto.randomUUID();
    const asstId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userId, role: "user", text: value }]);
    setInput("");
    setBusy(true);
    try {
      const res = await callPlanConfig({ data: { intent: value, family } });
      if ("error" in res) {
        toast.error(res.error);
        setMessages((prev) => [
          ...prev,
          { id: asstId, role: "assistant", text: res.error ?? "Couldn't plan that.", plan: undefined },
        ]);
      } else {
        setMessages((prev) => [...prev, { id: asstId, role: "assistant", text: value, plan: res.plan }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Planner failed");
    } finally {
      setBusy(false);
    }
  }

  async function run(msg: ChatMsg, resolvedCommands: string[]) {
    if (msg.role !== "assistant" || !msg.plan) return;
    if (status !== "connected") {
      toast.error("Pair the agent first.");
      return;
    }
    outputBufRef.current.set(msg.id, "");
    setPendingExecId(msg.id);
    const ok = exec(msg.id, resolvedCommands, msg.plan.requires_save);
    if (!ok) {
      toast.error("Socket not ready.");
      setPendingExecId(null);
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("command_runs").insert({
        user_id: u.user.id,
        intent: msg.text,
        family,
        commands: resolvedCommands,
        ok: false,
      });
    }
  }

  function clearChat() {
    setMessages([]);
    outputBufRef.current.clear();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const paired = status === "connected";
  const intentSent = messages.some((m) => m.role === "user");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-8">
        <aside className="space-y-4">
          <PairingCard
            status={status}
            device={device}
            onPair={pair}
            onDisconnect={disconnect}
            initialHost={search.host}
            initialPort={initialPort}
            initialCode={search.pair}
            autoPair={Boolean(search.pair) && search.auto === "1"}
          />
          {!paired && (
            <Wizard installed paired={paired} intentSent={intentSent} />
          )}
          {paired && !device && (
            <DiscoverPanel onDiscover={discover} onConnect={connectDevice} autoScan />
          )}
          <div className="rounded-md border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Device family</div>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as Family)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="hg">Huawei HG ONT (HG8245/HG8546)</option>
              <option value="gpon">Huawei GPON ONT</option>
              <option value="xpon">Huawei XPON ONT</option>
              <option value="olt">Huawei OLT (MA5800/MA5600T)</option>
              <option value="switch">Huawei Switch (S5700/S6700)</option>
              <option value="mikrotik">MikroTik RouterOS (CCR/CRS/RB/hAP)</option>
              <option value="cisco">Cisco IOS / IOS-XE / NX-OS</option>
            </select>
            <p className="mt-3 text-xs text-muted-foreground">Auto-detected when paired.</p>
          </div>
          <button
            onClick={clearChat}
            className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear conversation
          </button>
          <button
            onClick={signOut}
            className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </aside>

        <section className="flex min-h-[70vh] min-w-0 flex-col rounded-md border border-border bg-card p-4 sm:p-6">
          <div className="flex-1 space-y-6 overflow-y-auto pr-1 sm:pr-2">
            {messages.length === 0 && (
              <div className="space-y-5">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2 font-display text-lg text-foreground">Ready when you are.</p>
                  <p>Pick a recipe to start, or type plain English below.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RECIPES.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => {
                        setFamily(r.family);
                        setInput(r.intent);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs transition hover:border-primary/50 hover:bg-muted"
                    >
                      <Sparkles className="h-3 w-3 text-primary/80" /> {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[92%] rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:max-w-[80%]">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="text-sm space-y-3">
                  {m.plan ? (
                    <EditablePlan
                      plan={m.plan}
                      output={m.output}
                      ran={m.ran}
                      ok={m.ok}
                      running={pendingExecId === m.id}
                      onRun={(resolved) => run(m, resolved)}
                    />
                  ) : (
                    <div className="text-muted-foreground">{m.text}</div>
                  )}
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to configure…"
              className="min-w-0 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              disabled={busy || !input.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {busy ? "Thinking…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
