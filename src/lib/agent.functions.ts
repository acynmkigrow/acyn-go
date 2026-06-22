import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildPrompt, validateCommands, type Family } from "./huawei-prompts";

const PlanSchema = z.object({
  description: z.string(),
  warning: z.string().default(""),
  commands: z.array(z.string()).default([]),
  requires_save: z.boolean().default(false),
  destructive: z.boolean().default(false),
});

export type Plan = z.infer<typeof PlanSchema>;

const InputSchema = z.object({
  intent: z.string().min(1).max(2000),
  family: z.enum(["hg", "gpon", "xpon", "olt", "switch", "mikrotik", "cisco"]),
  device_model: z.string().max(120).optional(),
  recent_output: z.string().max(4000).optional(),
});

type PlanInput = z.infer<typeof InputSchema>;

function buildUserPrompt(data: PlanInput) {
  return [
    `Device family: ${data.family}${data.device_model ? ` (${data.device_model})` : ""}`,
    data.recent_output ? `Recent device output:\n${data.recent_output.slice(-2000)}` : "",
    `Intent: ${data.intent}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function postProcess(plan: Plan, intent: string, family: string) {
  const check = validateCommands(plan.commands, intent);
  if (!check.ok) {
    return {
      ...plan,
      commands: [],
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

// --- Primary: direct Gemini REST call (uses GEMINI_API_KEY) ---
async function planWithGemini(system: string, user: string, apiKey: string): Promise<Plan> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  const responseSchema = {
    type: "object",
    properties: {
      description: { type: "string" },
      warning: { type: "string" },
      commands: { type: "array", items: { type: "string" } },
      requires_save: { type: "boolean" },
      destructive: { type: "boolean" },
    },
    required: ["description", "commands"],
  };
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
      const parsed = JSON.parse(raw);
      return PlanSchema.parse(parsed);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// --- Fallback: Lovable AI Gateway ---
async function planWithLovable(system: string, user: string, key: string): Promise<Plan> {
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);
  const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
  let lastErr: unknown = null;
  for (const id of models) {
    try {
      const { experimental_output } = await generateText({
        model: gateway(id),
        system,
        prompt: user,
        experimental_output: Output.object({ schema: PlanSchema }),
      });
      return experimental_output as Plan;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/402|429/.test(msg)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const planConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    if (!geminiKey && !lovableKey) {
      return { error: "No AI provider configured. Set GEMINI_API_KEY (primary) or LOVABLE_API_KEY (fallback)." } as const;
    }

    const system = buildPrompt(data.family as Family);
    const user = buildUserPrompt(data);
    const errors: string[] = [];

    if (geminiKey) {
      try {
        const plan = postProcess(await planWithGemini(system, user, geminiKey), data.intent, data.family);
        return { plan, provider: "gemini" } as const;
      } catch (err) {
        errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (lovableKey) {
      try {
        const plan = postProcess(await planWithLovable(system, user, lovableKey), data.intent, data.family);
        return { plan, provider: "lovable" } as const;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/402/.test(msg)) return { error: "AI credits exhausted. Add credits in Lovable workspace settings." } as const;
        if (/429/.test(msg)) return { error: "Rate limit hit. Wait a moment and try again." } as const;
        errors.push(`Lovable: ${msg}`);
      }
    }

    return { error: `Planner failed. ${errors.join(" | ")}` } as const;
  });
