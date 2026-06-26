import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildPrompt, validateCommands, type Family } from "./huawei-prompts";

const PlanSchema = z.object({
  description: z.string(),
  warning: z.string().default(""),
  commands: z.array(z.string()).default([]),
  verify_commands: z.array(z.string()).default([]),
  rollback_commands: z.array(z.string()).default([]),
  requires_save: z.boolean().default(false),
  destructive: z.boolean().default(false),
});

export type Plan = z.infer<typeof PlanSchema>;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(2000),
});

const InputSchema = z.object({
  intent: z.string().min(1).max(2000),
  family: z.enum(["hg", "gpon", "xpon", "olt", "switch", "mikrotik", "cisco"]),
  device_model: z.string().max(120).optional(),
  recent_output: z.string().max(4000).optional(),
  history: z.array(TurnSchema).max(12).optional(),
});

type PlanInput = z.infer<typeof InputSchema>;

type RuntimeEnv = Record<string, unknown>;

const SUPABASE_AI_PLAN_URL = "https://mrthznysxanbwzyawzyd.supabase.co/functions/v1/ai-plan";
const SUPABASE_URL = "https://mrthznysxanbwzyawzyd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydGh6bnlzeGFuYnd6eWF3enlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzI2OTIsImV4cCI6MjA5NzcwODY5Mn0.c5IGWzCkdP9tIxzbPRqinYcDxNF5gcRi_L63wDWJ3j0";

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

function buildUserPrompt(data: PlanInput) {
  const history = (data.history ?? [])
    .slice(-8)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n");
  return [
    `Device family: ${data.family}${data.device_model ? ` (${data.device_model})` : ""}`,
    history ? `Conversation so far:\n${history}` : "",
    data.recent_output ? `Recent device output:\n${data.recent_output.slice(-2000)}` : "",
    `Latest user request: ${data.intent}`,
    `Return JSON with: description, warning, commands (apply), verify_commands (read-only checks like 'show'/'display'/'print' to confirm config), rollback_commands (commands that undo 'commands' when possible; empty array if not safely reversible), requires_save, destructive.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function postProcess(plan: Plan, intent: string, family: string) {
  const check = validateCommands([...plan.commands, ...plan.rollback_commands], intent);
  if (!check.ok) {
    return {
      ...plan,
      commands: [],
      rollback_commands: [],
      warning: `${plan.warning ? plan.warning + " " : ""}Blocked by safety validator: ${check.reason}`,
      destructive: true,
    };
  }
  const huaweiSave = ["hg", "gpon", "xpon", "olt", "switch"].includes(family);
  if (plan.requires_save && plan.commands.length > 0 && huaweiSave) {
    const last = plan.commands[plan.commands.length - 1].trim().toLowerCase();
    if (last !== "save" && last !== "save y") plan.commands.push("save");
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
  const { getRequest } = await import("@tanstack/react-start/server");
  const authHeader = getRequest()?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("No signed-in session was forwarded to the AI fallback.");
  }

  const resp = await fetch(SUPABASE_AI_PLAN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-acyn-supabase-url": SUPABASE_URL,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: authHeader,
    },
    body: JSON.stringify(data),
  });

  const bodyText = await resp.text();
  let body: unknown = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }

  const error =
    body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : bodyText.slice(0, 300);

  if (!resp.ok) {
    throw new Error(`Supabase AI fallback ${resp.status}: ${error}`);
  }
  if (!body || typeof body !== "object" || !("plan" in body)) {
    throw new Error("Supabase AI fallback returned no plan.");
  }

  return {
    plan: postProcess(PlanSchema.parse(body.plan), data.intent, data.family),
    provider: "supabase-secrets",
  };
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
