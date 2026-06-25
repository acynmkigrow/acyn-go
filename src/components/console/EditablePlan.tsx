import { useMemo, useState } from "react";
import { Play, Pencil, Check, AlertTriangle, Eye, Undo2 } from "lucide-react";
import type { Plan } from "@/lib/agent.functions";

const PLACEHOLDER_RE = /<([a-zA-Z][\w-]*)>|\b(TBD|TODO|FILL_ME)\b/g;

type Segment =
  | { kind: "text"; value: string }
  | { kind: "ph"; name: string; raw: string };

function tokenize(cmd: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  cmd.replace(PLACEHOLDER_RE, (raw, named: string | undefined, lit: string | undefined, idx: number) => {
    if (idx > last) out.push({ kind: "text", value: cmd.slice(last, idx) });
    out.push({ kind: "ph", name: (named ?? lit ?? "value").toLowerCase(), raw });
    last = idx + raw.length;
    return raw;
  });
  if (last < cmd.length) out.push({ kind: "text", value: cmd.slice(last) });
  return out;
}

function resolve(cmd: string, values: Record<string, string>): string {
  return cmd.replace(PLACEHOLDER_RE, (raw, named: string | undefined, lit: string | undefined) => {
    const key = (named ?? lit ?? "value").toLowerCase();
    const v = values[key];
    return v && v.trim() ? v.trim() : raw;
  });
}

export type RunPhase = "apply" | "verify" | "rollback";

export function EditablePlan({
  plan,
  output,
  verifyOutput,
  rollbackOutput,
  ran,
  ok,
  verifyRan,
  rollbackRan,
  running,
  runningPhase,
  onRun,
}: {
  plan: Plan;
  output?: string;
  verifyOutput?: string;
  rollbackOutput?: string;
  ran?: boolean;
  ok?: boolean;
  verifyRan?: boolean;
  rollbackRan?: boolean;
  running: boolean;
  runningPhase?: RunPhase | null;
  onRun: (phase: RunPhase, resolvedCommands: string[]) => void;
}) {
  const tokenized = useMemo(() => plan.commands.map(tokenize), [plan.commands]);

  const placeholderNames = useMemo(() => {
    const set = new Set<string>();
    tokenized.forEach((segs) => segs.forEach((s) => s.kind === "ph" && set.add(s.name)));
    return Array.from(set);
  }, [tokenized]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [editingLine, setEditingLine] = useState<number | null>(null);

  const resolvedCommands = useMemo(
    () =>
      plan.commands.map((c, i) =>
        overrides[i] !== undefined ? overrides[i] : resolve(c, values),
      ),
    [plan.commands, values, overrides],
  );

  const resolvedVerify = useMemo(
    () => (plan.verify_commands ?? []).map((c) => resolve(c, values)),
    [plan.verify_commands, values],
  );
  const resolvedRollback = useMemo(
    () => (plan.rollback_commands ?? []).map((c) => resolve(c, values)),
    [plan.rollback_commands, values],
  );

  const unresolved = useMemo(
    () => resolvedCommands.filter((c) => /<([a-zA-Z][\w-]*)>|\b(TBD|TODO|FILL_ME)\b/.test(c)),
    [resolvedCommands],
  );

  const hasPlaceholders = placeholderNames.length > 0;
  const canRun = !ran && !running && plan.commands.length > 0 && unresolved.length === 0;
  const canVerify =
    ran && ok && !running && resolvedVerify.length > 0 && !verifyRan;
  const canRollback =
    ran && !running && resolvedRollback.length > 0 && !rollbackRan;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-3 sm:px-4">
        <div className="text-foreground/90">{plan.description}</div>
        {plan.warning && (
          <div className="mt-1.5 text-xs text-amber-400/90 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{plan.warning}</span>
          </div>
        )}
        {hasPlaceholders && !ran && (
          <div className="mt-2 text-[11px] text-white/40">
            Fill the highlighted fields. Edit any line with the pencil icon.
          </div>
        )}
      </div>

      {plan.commands.length > 0 && (
        <div className="px-3 py-3 space-y-1.5 font-mono text-xs">
          {plan.commands.map((cmd, i) => {
            const segs = tokenized[i];
            const isOver = overrides[i] !== undefined;
            const isEditing = editingLine === i;
            const lineHasPh = segs.some((s) => s.kind === "ph");
            return (
              <div
                key={i}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03]"
              >
                <span className="text-white/30 select-none w-5 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  {isEditing || isOver ? (
                    <input
                      autoFocus={isEditing}
                      value={overrides[i] ?? cmd}
                      onChange={(e) => setOverrides((p) => ({ ...p, [i]: e.target.value }))}
                      onBlur={() => setEditingLine(null)}
                      className="w-full bg-white/5 border border-primary/40 rounded px-2 py-1 text-emerald-200 outline-none focus:border-primary"
                    />
                  ) : (
                    <div className="text-emerald-300/90 leading-relaxed break-all">
                      {segs.map((s, j) =>
                        s.kind === "text" ? (
                          <span key={j}>{s.value}</span>
                        ) : (
                          <PlaceholderInput
                            key={j}
                            name={s.name}
                            value={values[s.name] ?? ""}
                            onChange={(v) => setValues((p) => ({ ...p, [s.name]: v }))}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>
                {!ran && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isOver) {
                        setOverrides((p) => {
                          const c = { ...p };
                          delete c[i];
                          return c;
                        });
                        setEditingLine(null);
                      } else {
                        setEditingLine(i);
                        setOverrides((p) => ({ ...p, [i]: cmd }));
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-white shrink-0 mt-1"
                    title={isOver ? "Revert to placeholders" : "Free-edit this line"}
                  >
                    {isOver ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                )}
                {!lineHasPh && !isOver && (
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-white/30 self-center">
                    ready
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 border-t border-border bg-muted/50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
        <div className="text-xs text-muted-foreground">
          {plan.destructive && <span className="text-amber-400">destructive · </span>}
          {plan.requires_save ? "writes config" : "read-only"}
          {unresolved.length > 0 && (
            <span className="text-amber-400/90">
              {" "}· {unresolved.length} field{unresolved.length === 1 ? "" : "s"} to fill
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {plan.commands.length > 0 && !ran && (
            <button
              onClick={() => onRun("apply", resolvedCommands)}
              disabled={!canRun}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              title={canRun ? "Run resolved commands" : "Fill all placeholders first"}
            >
              <Play className="h-3 w-3" />
              {running && runningPhase === "apply" ? "Running…" : "Run on device"}
            </button>
          )}
          {ran && (
            <span className={`text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>
              {ok ? "✓ applied" : "✕ failed"}
            </span>
          )}
          {canVerify && (
            <button
              onClick={() => onRun("verify", resolvedVerify)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Eye className="h-3 w-3" />
              {running && runningPhase === "verify" ? "Verifying…" : "Verify"}
            </button>
          )}
          {canRollback && (
            <button
              onClick={() => onRun("rollback", resolvedRollback)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
              title="Undo the commands above"
            >
              <Undo2 className="h-3 w-3" />
              {running && runningPhase === "rollback" ? "Rolling back…" : "Rollback"}
            </button>
          )}
        </div>
      </div>

      {output && (
        <PhaseOutput label="apply" text={output} />
      )}
      {verifyOutput && <PhaseOutput label="verify" text={verifyOutput} />}
      {rollbackOutput && <PhaseOutput label="rollback" text={rollbackOutput} />}
    </div>
  );
}

function PhaseOutput({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-t border-white/5">
      <div className="px-4 pt-2 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <pre className="px-4 pb-3 pt-1 text-[11px] font-mono text-white/60 whitespace-pre-wrap max-h-64 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

function PlaceholderInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const filled = value.trim().length > 0;
  const width = Math.max(name.length + 2, value.length + 2);
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`<${name}>`}
      style={{ width: `${width}ch` }}
      className={
        "inline-block align-baseline mx-0.5 px-1.5 py-0.5 rounded border bg-black/60 text-center " +
        (filled
          ? "border-emerald-500/40 text-emerald-200"
          : "border-amber-400/60 text-amber-200 placeholder:text-amber-400/50 animate-pulse")
      }
    />
  );
}
