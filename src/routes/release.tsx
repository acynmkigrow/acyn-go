import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code/CodeBlock";

export const Route = createFileRoute("/release")({
  head: () => ({
    meta: [
      { title: "Release & Deploy Guide · ACYN-Go" },
      { name: "description", content: "Step-by-step GitHub setup, GoReleaser tagging, and Vercel hosting for go.acyninnovation.com — works on any GitHub account." },
      { property: "og:title", content: "ACYN-Go Release & Deploy Guide" },
      { property: "og:description", content: "Tag, push, host. The full release + Vercel workflow for ACYN-Go." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ACYN-Go Release & Deploy Guide" },
      { name: "twitter:description", content: "Step-by-step GitHub + Vercel deployment for ACYN-Go." },
    ],
  }),
  component: ReleasePage,
});

function ReleasePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-headings:font-display">
      <h1>Releasing & Deploying ACYN-Go</h1>
      <p className="lead text-white/60">
        These steps work for <strong>any GitHub account or org</strong> — substitute <code>&lt;your-user&gt;/&lt;your-repo&gt;</code>
        wherever you see it. The agent ships as a single Go binary per OS, cut by GoReleaser on every <code>v*</code> tag.
        The web installer always pulls the latest release, so users get the new build the moment you mark it Latest on GitHub.
      </p>

      <h2>Part A — One-time GitHub setup</h2>

      <h3>A1. Create the GitHub repository</h3>
      <ol>
        <li>Open <a href="https://github.com/new" target="_blank" rel="noreferrer"><code>https://github.com/new</code></a> in a new tab.</li>
        <li><strong>Owner</strong> dropdown → choose your personal account or an organization you admin.</li>
        <li><strong>Repository name</strong> → e.g. <code>acyn-go</code> (any name works; just keep it consistent with the installer URL).</li>
        <li><strong>Description</strong> (optional) → "AI-powered Huawei device configuration agent".</li>
        <li><strong>Public</strong> is required if you want the one-line installer to work without credentials. (Private works too, but users would need a Personal Access Token.)</li>
        <li>Leave <strong>Add a README</strong>, <strong>.gitignore</strong>, and <strong>license</strong> all <em>unchecked</em> — the agent folder already has them.</li>
        <li>Click the green <strong>Create repository</strong> button.</li>
      </ol>

      <h3>A2. Push the <code>agent/</code> folder as the repo root</h3>
      <p>The agent code lives in the <code>agent/</code> subdirectory of this Lovable project. Pick whichever path matches your setup.</p>

      <p><strong>Path 1 — you already cloned this Lovable project from GitHub:</strong></p>
      <CodeBlock language="bash" code={`cd <lovable-project>
git subtree push --prefix=agent https://github.com/<your-user>/<your-repo>.git main`} />

      <p><strong>Path 2 — push directly from the agent folder:</strong></p>
      <CodeBlock language="bash" code={`cd agent
git init -b main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git add .
git commit -m "Initial ACYN-Go release"
git push -u origin main`} />

      <p>Refresh the GitHub repo page — you should now see <code>main.go</code>, <code>internal/</code>, <code>.github/</code>, <code>.goreleaser.yaml</code>, etc. at the root.</p>

      <h3>A3. Give Actions permission to publish releases</h3>
      <p>Without this, GoReleaser fails with <code>403 Resource not accessible by integration</code>.</p>
      <ol>
        <li>On your repo page, click <strong>Settings</strong> in the top navigation bar (far right, after <em>Insights</em>).</li>
        <li>In the left sidebar scroll to the <strong>Code and automation</strong> section and click <strong>Actions</strong> → <strong>General</strong>.</li>
        <li>Scroll the page down to <strong>Workflow permissions</strong>.</li>
        <li>Select the radio button labelled <strong>Read and write permissions</strong>.</li>
        <li>Tick the checkbox <strong>Allow GitHub Actions to create and approve pull requests</strong>.</li>
        <li>Click the <strong>Save</strong> button directly below those options.</li>
      </ol>

      <h3>A4. (Optional) Point install.ps1 at your fork</h3>
      <p>The installer defaults to <code>acynmkigrow/acyn-go</code>. To install from a different fork, set the <code>ACYN_REPO</code> env var before running the one-liner:</p>
      <CodeBlock language="powershell" code={`$env:ACYN_REPO = "<your-user>/<your-repo>"
iwr -useb https://go.acyninnovation.com/install.ps1 | iex`} />

      <h2>Part B — Cut a release</h2>

      <h3>1 — Prep the working tree</h3>
      <ul>
        <li>Update <code>CHANGELOG.md</code>.</li>
        <li>If you changed defaults or flags, bump examples in <code>README.md</code> and <code>/guide</code>.</li>
        <li>Run <code>go test ./...</code> and <code>go vet ./...</code> from <code>agent/</code>.</li>
      </ul>

      <h3>2 — Dry-run locally</h3>
      <p>Catches GoReleaser config errors before the tag goes public.</p>
      <CodeBlock language="bash" code={`cd agent
goreleaser release --snapshot --clean
# Inspect dist/ — should contain acyn-go_*_windows_amd64.zip etc.`} />

      <h3>3 — Tag and push</h3>
      <CodeBlock language="bash" code={`git tag -a v1.2.0 -m "ACYN-Go v1.2.0"
git push origin v1.2.0`} />
      <p>That push triggers <code>.github/workflows/release.yml</code>, which runs GoReleaser with the <code>GITHUB_TOKEN</code> already scoped for releases.</p>

      <h3>4 — Watch CI</h3>
      <p>Go to <code>https://github.com/&lt;your-user&gt;/&lt;your-repo&gt;/actions</code>. The job should finish in 2–4 minutes and produce a draft release with:</p>
      <ul>
        <li><code>acyn-go_&lt;version&gt;_windows_amd64.zip</code></li>
        <li><code>acyn-go_&lt;version&gt;_linux_amd64.tar.gz</code></li>
        <li><code>acyn-go_&lt;version&gt;_darwin_arm64.tar.gz</code></li>
        <li><code>checksums.txt</code></li>
      </ul>

      <h3>5 — Verify the Windows artifact</h3>
      <CodeBlock language="powershell" code={`# Download the zip from the GitHub Release page, then:
Expand-Archive .\\acyn-go_v1.2.0_windows_amd64.zip -DestinationPath .\\acyn-go
.\\acyn-go\\acyn-go.exe --version
# Should print: acyn-go v1.2.0`} />

      <h3>6 — Mark as Latest</h3>
      <p>On the GitHub Releases page, edit the draft, tick <em>Set as the latest release</em>, and publish. From this moment the one-liner installer picks up the new version.</p>

      <h3>7 — Hotfix flow</h3>
      <CodeBlock language="bash" code={`git checkout -b release/v1.2.x v1.2.0
git cherry-pick <sha>
git tag -a v1.2.1 -m "Hotfix"
git push origin release/v1.2.x v1.2.1`} />

      <h2>Part C — Host the docs site on Vercel (go.acyninnovation.com)</h2>
      <p>
        This project ships a <code>vercel.json</code> that switches the Nitro build target to Vercel via the
        <code> NITRO_PRESET=vercel</code> env var. Lovable's own preview/published URL is unaffected because Lovable
        doesn't set that env var — it stays on Cloudflare.
      </p>

      <h3>C1. Connect this Lovable project to GitHub</h3>
      <ol>
        <li>In the Lovable editor click the <strong>+</strong> menu (bottom-left of the chat) → <strong>GitHub</strong> → <strong>Connect project</strong>.</li>
        <li>Authorize the Lovable GitHub App if prompted.</li>
        <li>Pick the owner and click <strong>Create Repository</strong>. Lovable mirrors the project into a new repo.</li>
      </ol>

      <h3>C2. Import the repo on Vercel</h3>
      <ol>
        <li>Open <a href="https://vercel.com/new" target="_blank" rel="noreferrer"><code>https://vercel.com/new</code></a>.</li>
        <li>If this is your first time, click <strong>Continue with GitHub</strong> and grant Vercel access to the repo.</li>
        <li>Find the repo in the list and click <strong>Import</strong>.</li>
        <li><strong>Framework Preset</strong> → leave as <strong>Other</strong>. (<code>vercel.json</code> overrides everything.)</li>
        <li><strong>Root Directory</strong> → leave as <code>./</code>.</li>
        <li><strong>Build &amp; Output Settings</strong> → leave collapsed; <code>vercel.json</code> sets <code>bun install</code>, <code>bun run build</code>, and output dir <code>.output/public</code>.</li>
        <li><strong>Environment Variables</strong> → add any runtime keys the app needs (Supabase URL, anon key, Lovable Cloud secrets). Don't include build secrets here — only runtime ones.</li>
        <li>Click <strong>Deploy</strong>. First build takes ~2 minutes.</li>
      </ol>

      <h3>C3. Attach the custom domain</h3>
      <ol>
        <li>On the Vercel project page, click <strong>Settings</strong> (top tab) → <strong>Domains</strong> (left sidebar).</li>
        <li>Type <code>go.acyninnovation.com</code> into the input box, click <strong>Add</strong>.</li>
        <li>Pick <strong>Add a CNAME record</strong> when Vercel asks.</li>
        <li>In your DNS provider (Cloudflare / Namecheap / Route53), add the record Vercel shows. It's almost always:
          <CodeBlock language="text" code={`Type:  CNAME
Host:  go
Value: cname.vercel-dns.com
TTL:   Auto`} />
        </li>
        <li>If your DNS is on Cloudflare, set the proxy status to <strong>DNS only</strong> (grey cloud) so Vercel can issue the SSL cert.</li>
        <li>Wait 1–10 minutes. Vercel auto-provisions Let's Encrypt; the domain status flips to <strong>Valid Configuration</strong> when ready.</li>
      </ol>

      <h3>C4. Troubleshooting</h3>
      <ul>
        <li><strong>500 on every page after deploy</strong> → confirm <code>NITRO_PRESET=vercel</code> is set under <em>Settings → Environment Variables</em> and that the latest deploy was rebuilt after adding it.</li>
        <li><strong>Build fails on <code>bun: command not found</code></strong> → Vercel auto-detects bun from <code>bun.lock</code>; if it doesn't, edit <code>vercel.json</code> to use <code>npm install</code> / <code>npm run build</code>.</li>
        <li><strong>Domain stuck on "Invalid Configuration"</strong> → CNAME hasn't propagated yet, or Cloudflare proxy is still orange-clouded. Use <code>dig go.acyninnovation.com CNAME</code> to verify.</li>
        <li><strong>SSR works in dev but 404s on refresh in prod</strong> → don't add a <code>rewrites</code> block to <code>vercel.json</code>; the Nitro Vercel preset already handles routing.</li>
      </ul>

      <h2>Files that govern the release &amp; deploy</h2>
      <ul>
        <li><code>agent/.github/workflows/release.yml</code> — CI trigger on <code>v*</code> tags.</li>
        <li><code>agent/.goreleaser.yaml</code> — build matrix and archive naming. Owner/name auto-detected from <code>git remote origin</code>, so forks just work.</li>
        <li><code>public/install.ps1</code> — Windows one-liner. Defaults to <code>acyninnovation/acyn-go</code>; override with <code>$env:ACYN_REPO</code>.</li>
        <li><code>vercel.json</code> — Vercel build config; sets <code>NITRO_PRESET=vercel</code> only when building on Vercel.</li>
      </ul>
    </article>
  );
}
