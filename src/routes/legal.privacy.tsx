import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "@/components/layout/LegalShell";
import { buildMeta } from "@/components/seo/Seo";

export const Route = createFileRoute("/legal/privacy")({
  head: () => buildMeta({
    title: "Privacy Policy — ACYN-Go",
    description: "How ACYN Innovation handles data for the ACYN-Go website and CLI agent.",
    path: "/legal/privacy",
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="2026-06-22">
      <p>
        This page is maintained by ACYN Innovation to answer common privacy questions about the
        ACYN-Go website (<code>go.acyninnovation.com</code>) and the ACYN-Go CLI agent.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Website:</strong> standard server logs (IP address, user agent, timestamp, path) retained for up to 30 days for security and abuse prevention.</li>
        <li><strong>CLI agent:</strong> nothing. ACYN-Go runs entirely on your machine. No telemetry, analytics, crash reports or usage data is transmitted to ACYN Innovation.</li>
      </ul>

      <h2>2. Credentials & API keys</h2>
      <p>
        Device credentials you type into the agent and AI API keys (Gemini / OpenAI) are stored
        locally as user environment variables and session-scoped memory. They never leave your
        machine except for the direct, encrypted call to your chosen AI provider.
      </p>

      <h2>3. Third parties</h2>
      <p>
        When you use ACYN-Go you choose an AI provider (Google Gemini or OpenAI). Your plain-English
        instructions are sent to that provider over HTTPS. Refer to their respective privacy policies
        for how they handle that data. ACYN Innovation is not a data processor for those calls.
      </p>

      <h2>4. Cookies</h2>
      <p>The marketing site uses no analytics, advertising or tracking cookies.</p>

      <h2>5. Your rights</h2>
      <p>
        For privacy requests, email <a href="mailto:legal@acyninnovation.com">legal@acyninnovation.com</a>.
        We respond within 30 days.
      </p>

      <h2>6. Contact</h2>
      <p>
        ACYN Innovation · <a href="mailto:info@acyninnovation.com">info@acyninnovation.com</a>
      </p>
    </LegalShell>
  );
}
