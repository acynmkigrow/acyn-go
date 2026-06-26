## Current fix

The console planner now has two paths:

1. **Direct server runtime keys** — `src/lib/agent.functions.ts` still uses `GEMINI_API_KEY` and `LOVABLE_API_KEY` when the deployment runtime exposes them.
2. **Supabase secret fallback** — if Vercel does not expose those keys, the server function calls the deployed `ai-plan` Supabase Edge Function, which uses the already-configured Supabase secrets for `GEMINI_API_KEY` and `LOVABLE_API_KEY`.

The fallback requires the user's signed-in Supabase bearer token, so anonymous callers cannot use the project AI keys.

## Why this was needed

The earlier assumption was that adding Vercel Environment Variables would be enough. The live error proves the Vercel runtime still sees no AI keys, while this project already has the keys saved in Supabase/Lovable secrets. The new fallback makes the console use those existing secrets instead of failing with:

> "AI service is temporarily unavailable. The project's keys are not reaching the runtime — please retry in a moment."

## Deployment steps

1. Deploy the Supabase Edge Function named `ai-plan`.
2. Redeploy/update the frontend/server build so `src/lib/agent.functions.ts` can call the fallback.
3. Sign out and back in on `/console` if the fallback reports that no signed-in session was forwarded.
