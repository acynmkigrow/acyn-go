import { createFileRoute } from "@tanstack/react-router";
import { createConfigPlan } from "@/lib/agent.functions";

export const Route = createFileRoute("/api/public/diag-ai")({
  server: {
    handlers: {
      GET: async () => {
        const hasGemini = typeof process.env.GEMINI_API_KEY === "string" && process.env.GEMINI_API_KEY.length > 0;
        const hasLovable = typeof process.env.LOVABLE_API_KEY === "string" && process.env.LOVABLE_API_KEY.length > 0;
        const envKeys = Object.keys(process.env).filter((k) =>
          /GEMINI|LOVABLE|SUPABASE/i.test(k),
        );

        let probe: unknown = null;
        try {
          probe = await createConfigPlan({
            intent: "show ip address print",
            family: "mikrotik",
          });
        } catch (err) {
          probe = { thrown: err instanceof Error ? err.message : String(err) };
        }

        return Response.json({ hasGemini, hasLovable, envKeys, probe });
      },
    },
  },
});
