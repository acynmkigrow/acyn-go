import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { validateCommands } from "./huawei-prompts";

const SUPABASE_AI_PLAN_URL = "https://mrthznysxanbwzyawzyd.supabase.co/functions/v1/ai-plan";
const SUPABASE_URL = "https://mrthznysxanbwzyawzyd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydGh6bnlzeGFuYnd6eWF3enlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzI2OTIsImV4cCI6MjA5NzcwODY5Mn0.c5IGWzCkdP9tIxzbPRqinYcDxNF5gcRi_L63wDWJ3j0";

const PlanSchema = z.object({
  description: z.string(),
  warning: z.string().default(""),
  commands: z.array(z.string()).default([]),
  verify_commands: z.array(z.string()).default([]),
  rollback_commands: z.array(z.string()).default([]),
  requires_save: z.boolean().default(false),
  destructive: z.boolean().default(false),
});

export type FallbackPlan = z.infer<typeof PlanSchema>;

function postProcess(plan: FallbackPlan, intent: string, family: string): FallbackPlan {
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

export async function planWithSupabaseSecrets(data: {
  intent: string;
  family: string;
  [k: string]: unknown;
}): Promise<{ plan: FallbackPlan; provider: "supabase-secrets" }> {
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
    plan: postProcess(PlanSchema.parse((body as { plan: unknown }).plan), data.intent, data.family),
    provider: "supabase-secrets",
  };
}
