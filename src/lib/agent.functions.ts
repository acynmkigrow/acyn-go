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

export const planConfig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { error: "LOVABLE_API_KEY is not configured on the server." } as const;
    }

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = buildPrompt(data.family as Family);
    const userPrompt = [
      `Device family: ${data.family}${data.device_model ? ` (${data.device_model})` : ""}`,
      data.recent_output ? `Recent device output:\n${data.recent_output.slice(-2000)}` : "",
      `Intent: ${data.intent}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const { experimental_output } = await generateText({
        model,
        system,
        prompt: userPrompt,
        experimental_output: Output.object({ schema: PlanSchema }),
      });
      const plan = experimental_output as Plan;
      const check = validateCommands(plan.commands, data.intent);
      if (!check.ok) {
        return {
          plan: {
            ...plan,
            commands: [],
            warning: `${plan.warning ? plan.warning + " " : ""}Blocked by safety validator: ${check.reason}`,
            destructive: true,
          },
        } as const;
      }
      if (plan.requires_save && plan.commands.length > 0 && data.family !== "mikrotik") {
        const last = plan.commands[plan.commands.length - 1].trim().toLowerCase();
        if (last !== "save" && last !== "save y") {
          plan.commands.push("save");
        }
      }
      return { plan } as const;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/402/.test(msg)) return { error: "AI credits exhausted. Add credits in Lovable workspace settings." } as const;
      if (/429/.test(msg)) return { error: "Rate limit hit. Wait a moment and try again." } as const;
      return { error: `Planner failed: ${msg}` } as const;
    }
  });
