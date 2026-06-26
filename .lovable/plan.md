## Why the error appears

`src/lib/agent.functions.ts` looks for `GEMINI_API_KEY` and `LOVABLE_API_KEY` in `process.env` (and a Cloudflare-style `globalThis.__env__`). On Vercel, the only thing populating `process.env` is **Vercel's own Environment Variables**. Secrets added in Supabase or in Lovable's project secrets are not forwarded to your Vercel deployment, so both `readSecret(...)` calls return `undefined` and the planner returns:

> "AI service is temporarily unavailable. The project's keys are not reaching the runtime — please retry in a moment."

No code change is needed — the planner already supports both providers with fallback. The fix is purely configuration.

## Steps

1. Open the Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add the following for **Production**, **Preview**, and **Development**:
   - `GEMINI_API_KEY` = your Google AI Studio key
   - `LOVABLE_API_KEY` = your Lovable AI Gateway key (acts as fallback)
3. Click **Save**, then go to **Deployments → latest deployment → Redeploy** (Vercel only picks up new env vars on a fresh deploy; existing builds keep the old empty env).
4. Once redeployed, hit `/console`, send a prompt, and confirm a plan is returned. If Gemini fails the planner will transparently fall back to Lovable.

## Optional hardening (only if you want it)

- Add a `/api/health/ai` server route that returns `{ gemini: !!process.env.GEMINI_API_KEY, lovable: !!process.env.LOVABLE_API_KEY }` so you can verify on the live URL that env vars are wired before debugging the planner.
- Improve the user-facing error to say "AI keys are not configured on this deployment" when both `readSecret` calls return undefined, so this is obvious next time.

Tell me if you want the health-check route and clearer error message added, or if just adding the env vars in Vercel is enough.
