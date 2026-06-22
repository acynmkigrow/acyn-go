import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, Play, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { planConfig, type Plan } from "@/lib/agent.functions";
import { useServerFn } from "@tanstack/react-start";
import { PairingCard } from "@/components/console/PairingCard";
import { useAgentSocket, type ExecMessage } from "@/components/console/useAgentSocket";
import type { Family } from "@/lib/huawei-prompts";

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({
    meta: [
      { title: "Console · ACYN-Go" },
      { name: "description", content: "Chat with the ACYN-Go agent and configure Huawei devices from your browser." },
    ],
  }),
  component: ConsolePage,
});

type ChatMsg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; plan?: Plan; output?: string; ran?: boolean; ok?: boolean };

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

  const { status, device, pair, exec, disconnect } = useAgentSocket(onSocketMsg);

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

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const userId = crypto.randomUUID();
    const asstId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userId, role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await callPlanConfig({ data: { intent: text, family } });
      if ("error" in res) {
        toast.error(res.error);
        setMessages((prev) => [
          ...prev,
          { id: asstId, role: "assistant", text: "Couldn't plan that.", plan: undefined },
        ]);
      } else {
        setMessages((prev) => [...prev, { id: asstId, role: "assistant", text, plan: res.plan }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Planner failed");
    } finally {
      setBusy(false);
    }
  }

  async function run(msg: ChatMsg) {
    if (msg.role !== "assistant" || !msg.plan) return;
    if (status !== "connected") {
      toast.error("Pair the agent first.");
      return;
    }
    outputBufRef.current.set(msg.id, "");
    setPendingExecId(msg.id);
    const ok = exec(msg.id, msg.plan.commands, msg.plan.requires_save);
    if (!ok) {
      toast.error("Socket not ready.");
      setPendingExecId(null);
    }
    // record initial row when done (handled in onSocketMsg via supabase insert)
    // Pre-write a row so the audit log captures even disconnects:
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("command_runs").insert({
        user_id: u.user.id,
        intent: msg.text,
        family,
        commands: msg.plan.commands,
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        <aside className="space-y-4">
          <PairingCard
            status={status}
            device={device}
            onPair={pair}
            onDisconnect={disconnect}
          />
          <div className="rounded-2xl bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">Device family</div>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as Family)}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="hg">HG ONT (HG8245/HG8546)</option>
              <option value="gpon">GPON ONT</option>
              <option value="xpon">XPON ONT</option>
              <option value="olt">OLT (MA5800/MA5600T)</option>
              <option value="switch">Switch (S5700/S6700)</option>
            </select>
            <p className="mt-3 text-xs text-white/40">Auto-detected when paired.</p>
          </div>
          <button
            onClick={clearChat}
            className="w-full text-xs text-white/40 hover:text-white inline-flex items-center justify-center gap-1.5 py-2"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear conversation
          </button>
          <button
            onClick={signOut}
            className="w-full text-xs text-white/40 hover:text-white inline-flex items-center justify-center gap-1.5 py-2"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </aside>

        <section className="flex flex-col min-h-[70vh] rounded-2xl bg-white/[0.015] p-6">
          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            {messages.length === 0 && (
              <div className="text-white/40 text-sm">
                <p className="font-display text-lg text-white/70 mb-2">Ready when you are.</p>
                <p>Try: <em className="text-primary">"Create VLAN 100 and bind it to port 0/19/0"</em></p>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="text-sm space-y-3">
                  {m.plan ? (
                    <PlanBlock
                      plan={m.plan}
                      output={m.output}
                      ran={m.ran}
                      ok={m.ok}
                      running={pendingExecId === m.id}
                      onRun={() => run(m)}
                    />
                  ) : (
                    <div className="text-white/70">{m.text}</div>
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
            className="mt-6 flex gap-2"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to configure…"
              className="flex-1 rounded-md bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={busy || !input.trim()}
              className="rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm inline-flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40"
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

function PlanBlock({
  plan,
  output,
  ran,
  ok,
  running,
  onRun,
}: {
  plan: Plan;
  output?: string;
  ran?: boolean;
  ok?: boolean;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="text-white/80">{plan.description}</div>
        {plan.warning && (
          <div className="mt-1.5 text-xs text-amber-400/90">⚠ {plan.warning}</div>
        )}
      </div>
      {plan.commands.length > 0 && (
        <pre className="px-4 py-3 text-xs font-mono text-emerald-300/90 whitespace-pre-wrap">
          {plan.commands.map((c, i) => `${i + 1}. ${c}`).join("\n")}
        </pre>
      )}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 bg-white/[0.02]">
        <div className="text-xs text-white/40">
          {plan.destructive && <span className="text-amber-400">destructive · </span>}
          {plan.requires_save ? "writes config" : "read-only"}
        </div>
        {plan.commands.length > 0 && !ran && (
          <button
            onClick={onRun}
            disabled={running}
            className="rounded-md bg-emerald-500/90 text-black px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-emerald-400 disabled:opacity-40"
          >
            <Play className="h-3 w-3" /> {running ? "Running…" : "Run on device"}
          </button>
        )}
        {ran && (
          <div className={`text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>
            {ok ? "✓ done" : "✕ failed"}
          </div>
        )}
      </div>
      {output && (
        <pre className="px-4 py-3 text-[11px] font-mono text-white/60 whitespace-pre-wrap border-t border-white/5 max-h-64 overflow-y-auto">
          {output}
        </pre>
      )}
    </div>
  );
}
