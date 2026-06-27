import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildPrompt, validateCommands, type Family } from "./huawei-prompts";

const PlanSchema = z.object({
  description: z.string(),
  warning: z.string().default(""),
  commands: z.array(z.string()).default([]),
  verify_commands: z.array(z.string()).default([]),
  verify_expect: z.array(z.string()).default([]),
  rollback_commands: z.array(z.string()).default([]),
  requires_save: z.boolean().default(false),
  destructive: z.boolean().default(false),
});

export type Plan = z.infer<typeof PlanSchema>;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(2000),
});

const FactValueSchema = z.union([z.string(), z.array(z.string())]);
const FactsSchema = z.record(z.string().max(64), FactValueSchema).optional();

const InputSchema = z.object({
  intent: z.string().min(1).max(2000),
  family: z.enum(["hg", "gpon", "xpon", "olt", "switch", "mikrotik", "cisco"]),
  device_model: z.string().max(120).optional(),
  device_facts: FactsSchema,
  recent_output: z.string().max(4000).optional(),
  history: z.array(TurnSchema).max(12).optional(),
});

type PlanInput = z.infer<typeof InputSchema>;

type RuntimeEnv = Record<string, unknown>;

function getRuntimeEnv() {
  return (globalThis as typeof globalThis & { __env__?: RuntimeEnv }).__env__;
}

function readSecret(name: "GEMINI_API_KEY" | "LOVABLE_API_KEY") {
  const fromEnv = process.env[name];
  const fromRuntime = getRuntimeEnv()?.[name];
  const raw =
    (typeof fromEnv === "string" && fromEnv.length > 0 ? fromEnv : undefined) ??
    (typeof fromRuntime === "string" && fromRuntime.length > 0 ? fromRuntime : undefined);
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^export\s+/i, "")
    .replace(new RegExp(`^${name}\\s*=\\s*`, "i"), "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function providerMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key not valid|INVALID_ARGUMENT|403|401/i.test(msg)) return "credentials rejected";
  if (/429|rate/i.test(msg)) return "rate limit";
  if (/402|credit|billing/i.test(msg)) return "out of credits";
  return msg.slice(0, 200);
}

function formatFacts(facts?: PlanInput["device_facts"]): string {
  if (!facts) return "";
  const lines: string[] = [];
  for (const [k, v] of Object.entries(facts)) {
    const val = Array.isArray(v) ? v.join(", ") : v;
    if (val && val.length > 0) lines.push(`- ${k}: ${val.slice(0, 600)}`);
  }
  return lines.length ? `Live device facts (use these — do NOT invent):\n${lines.join("\n")}` : "";
}

function buildUserPrompt(data: PlanInput) {
  const history = (data.history ?? [])
    .slice(-8)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n");
  return [
    `Device family: ${data.family}${data.device_model ? ` (${data.device_model})` : ""}`,
    formatFacts(data.device_facts),
    history ? `Conversation so far:\n${history}` : "",
    data.recent_output ? `Recent device output:\n${data.recent_output.slice(-2000)}` : "",
    `Latest user request: ${data.intent}`,
    `Return JSON with: description, warning, commands (apply), verify_commands (read-only show/display/print that prove the change took effect), verify_expect (one regex per verify command that MUST match its output to consider apply successful — use ".*" only when no meaningful check exists), rollback_commands (commands that undo 'commands' when possible; empty array if not safely reversible), requires_save, destructive.`,
    `Hard requirements:`,
    `- If commands is non-empty, verify_commands and verify_expect MUST be non-empty and the same length.`,
    `- Use real interface names / VLAN ids / slot-port values from "Live device facts" above. If a required value is missing from facts and not supplied by the user, return commands: [] and explain in warning.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function postProcess(plan: Plan, intent: string, family: string): Plan {
  const check = validateCommands([...plan.commands, ...plan.rollback_commands], intent);
  if (!check.ok) {
    return {
      ...plan,
      commands: [],
      rollback_commands: [],
      verify_commands: [],
      verify_expect: [],
      warning: `${plan.warning ? plan.warning + " " : ""}Blocked by safety validator: ${check.reason}`,
      destructive: true,
    };
  }
  const huaweiSave = ["hg", "gpon", "xpon", "olt", "switch"].includes(family);
  if (plan.requires_save && plan.commands.length > 0 && huaweiSave) {
    const last = plan.commands[plan.commands.length - 1].trim().toLowerCase();
    if (last !== "save" && last !== "save y") plan.commands.push("save");
  }
  // Enforce verify_commands when commands present.
  if (plan.commands.length > 0 && plan.verify_commands.length === 0) {
    const fallback =
      family === "mikrotik"
        ? "/export compact"
        : family === "cisco"
        ? "show running-config | include !"
        : "display current-configuration";
    plan.verify_commands = [fallback];
    plan.verify_expect = [".*"];
  }
  // Pad/truncate verify_expect to match verify_commands length.
  if (plan.verify_commands.length !== plan.verify_expect.length) {
    plan.verify_expect = plan.verify_commands.map((_, i) => plan.verify_expect[i] ?? ".*");
  }
  return plan;
}

async function planWithGemini(system: string, user: string, apiKey: string): Promise<Plan> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  const responseSchema = {
    type: "OBJECT",
    properties: {
      description: { type: "STRING" },
      warning: { type: "STRING" },
      commands: { type: "ARRAY", items: { type: "STRING" } },
      verify_commands: { type: "ARRAY", items: { type: "STRING" } },
      verify_expect: { type: "ARRAY", items: { type: "STRING" } },
      rollback_commands: { type: "ARRAY", items: { type: "STRING" } },
      requires_save: { type: "BOOLEAN" },
      destructive: { type: "BOOLEAN" },
    },
    required: ["description", "commands"],
  };
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.2,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
      const parsed = JSON.parse(jsonText);
      return PlanSchema.parse(parsed);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function planWithLovable(system: string, user: string, key: string): Promise<Plan> {
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);
  const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
  let lastErr: unknown = null;
  for (const id of models) {
    try {
      const { output } = await generateText({
        model: gateway(id),
        system,
        prompt: user,
        output: Output.object({ schema: PlanSchema }),
      });
      return output as Plan;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/402|429/.test(msg)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function planWithSupabaseSecrets(data: PlanInput): Promise<{ plan: Plan; provider: "supabase-secrets" }> {
  const { planWithSupabaseSecrets: impl } = await import("./agent-supabase-fallback.server");
  return impl(data) as Promise<{ plan: Plan; provider: "supabase-secrets" }>;
}

export async function createConfigPlan(input: unknown) {
  const data = InputSchema.parse(input);
  const geminiKey = readSecret("GEMINI_API_KEY");
  const lovableKey = readSecret("LOVABLE_API_KEY");

  if (!geminiKey && !lovableKey) {
    console.error("[planner] no provider keys found in process.env or runtime env");
    try {
      return await planWithSupabaseSecrets(data);
    } catch (err) {
      console.error("[planner] supabase-secret fallback failed:", err);
      return {
        error:
          "AI service is temporarily unavailable. The deployed server cannot read Vercel env vars and the Supabase secret fallback did not respond. Please sign out/in and retry.",
      } as const;
    }
  }

  const system = buildPrompt(data.family as Family);
  const user = buildUserPrompt(data);
  const errors: string[] = [];

  if (geminiKey) {
    try {
      const plan = postProcess(
        await planWithGemini(system, user, geminiKey),
        data.intent,
        data.family,
      );
      return { plan, provider: "gemini" } as const;
    } catch (err) {
      console.error("[planner] gemini failed:", err);
      errors.push(`Gemini: ${providerMessage(err)}`);
    }
  }

  if (lovableKey) {
    try {
      const plan = postProcess(
        await planWithLovable(system, user, lovableKey),
        data.intent,
        data.family,
      );
      return { plan, provider: "lovable" } as const;
    } catch (err) {
      console.error("[planner] lovable failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/402/.test(msg))
        return {
          error: "AI service is over its credit limit right now. Please try again later.",
        } as const;
      if (/429/.test(msg))
        return {
          error: "AI service is rate-limited. Wait a few seconds and try again.",
        } as const;
      errors.push(`Lovable: ${providerMessage(err)}`);
    }
  }

  try {
    return await planWithSupabaseSecrets(data);
  } catch (err) {
    console.error("[planner] supabase-secret fallback failed:", err);
    errors.push(`Supabase secrets fallback: ${providerMessage(err)}`);
  }

  return {
    error: `AI service couldn't generate a plan (${errors.join(" | ")}). Try rewording your request.`,
  } as const;
}

export const planConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => createConfigPlan(data));
