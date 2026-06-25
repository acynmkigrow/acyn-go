Plan to make the console AI work reliably without user-provided keys:

1. Replace the fragile planner call path
   - Keep all AI calls server-side.
   - Add a dedicated `/api/plan-config` server route for the console instead of relying only on the current server function path.
   - Read `GEMINI_API_KEY` and `LOVABLE_API_KEY` from the project runtime secrets inside the request handler, including the Worker/Nitro runtime bindings.
   - Never expose either key to the browser.

2. Make provider fallback impossible to block chat
   - Try Gemini first when a valid `GEMINI_API_KEY` is available.
   - If Gemini returns 401/403/429/5xx, immediately fall back to Lovable AI using the existing `LOVABLE_API_KEY`.
   - If Lovable AI works, the user sees the plan, not “nothing configured”.
   - Only show an error if both project-level providers fail.
   - Improve the error text so it never tells end users to add their own API key.

3. Preserve console context
   - Send the planner the selected/connected device family, model, prompt, recent chat turns, recent device output, and the latest user request.
   - Update the prompt so follow-up requests like “now add another peer” can use prior context instead of starting from scratch.
   - Store enough conversation context in local state/localStorage for page refreshes without storing secrets or device passwords.

4. Make plans device-configuration ready
   - Extend the plan schema to include:
     - `commands` for the actual configuration
     - `verify_commands` to confirm the config applied
     - `rollback_commands` for safe reversal when possible
     - warnings for commands that cannot be safely rolled back
   - Update Huawei, MikroTik, and Cisco prompts so generated commands include vendor-correct verification and rollback guidance.

5. Add execution phases in the console UI
   - Show Apply, Verify, and Rollback sections in the generated plan.
   - Run apply commands through the paired local agent.
   - After apply succeeds, allow running verification commands.
   - If apply fails, show the rollback action immediately when rollback commands exist.
   - Keep command output attached to the same assistant response so context is not lost.

6. Improve agent batch behavior
   - Keep using the local WebSocket agent for execution.
   - Add explicit batch phase/type support so the browser can run `apply`, `verify`, and `rollback` batches separately and label returned output correctly.
   - Stop on first failed command and report which command failed.

7. Validate before finishing
   - Test the exact WireGuard prompt through the app planner and confirm it returns RouterOS commands using project-level AI.
   - Confirm fallback works when Gemini fails by using Lovable AI rather than returning “nothing configured”.
   - Check the console page at mobile/tablet/desktop widths so the chat, plan editor, and dropdowns stay readable and responsive.