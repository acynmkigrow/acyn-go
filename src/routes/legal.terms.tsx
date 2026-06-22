import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "@/components/layout/LegalShell";
import { buildMeta } from "@/components/seo/Seo";

export const Route = createFileRoute("/legal/terms")({
  head: () => buildMeta({
    title: "Terms of Service — ACYN-Go",
    description: "Terms governing your use of the ACYN-Go website and open-source CLI agent.",
    path: "/legal/terms",
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalShell title="Terms of Service" updated="2026-06-22">
      <p>
        These terms govern your use of the ACYN-Go website at <code>go.acyninnovation.com</code> and
        the ACYN-Go open-source CLI agent ("the Software"), maintained by ACYN Innovation
        ("we", "us").
      </p>

      <h2>1. The Software is open source</h2>
      <p>
        ACYN-Go is released under the MIT License. You may use, copy, modify, merge, publish,
        distribute, sublicense and sell copies of the Software subject to that license. See the{" "}
        <a href="/legal/license">MIT License</a> page.
      </p>

      <h2>2. No warranty</h2>
      <p>
        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. You are solely responsible
        for what you instruct the agent to do on your network devices. We recommend dry-runs on lab
        equipment before production rollouts.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        Do not use ACYN-Go to access devices you do not own or are not authorised to administer. Do
        not attempt to abuse, reverse engineer or overload third-party AI provider quotas through
        the agent.
      </p>

      <h2>4. Third-party AI providers</h2>
      <p>
        Your use of Google Gemini or OpenAI through ACYN-Go is also governed by their respective
        terms. We are not party to that agreement.
      </p>

      <h2>5. Changes</h2>
      <p>We may update these terms; the latest version is always available on this page.</p>

      <h2>6. Contact</h2>
      <p>
        Legal: <a href="mailto:legal@acyninnovation.com">legal@acyninnovation.com</a>
      </p>
    </LegalShell>
  );
}
