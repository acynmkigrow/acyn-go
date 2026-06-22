import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code/CodeBlock";

export const Route = createFileRoute("/release")({
  head: () => ({
    meta: [
      { title: "Release Guide · ACYN-Go" },
      { name: "description", content: "Cut a new ACYN-Go release on GitHub with GoReleaser, ship Windows/Linux/macOS binaries, and roll out via the install.ps1 one-liner." },
      { property: "og:title", content: "ACYN-Go Release Guide" },
      { property: "og:description", content: "Tag, push, verify — the full release workflow for the ACYN-Go agent." },
    ],
  }),
  component: ReleasePage,
});

function ReleasePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-headings:font-display">
      <h1>Releasing ACYN-Go</h1>
      <p className="lead text-white/60">
        The agent ships as a single Go binary per OS, cut by GoReleaser on every <code>v*</code> tag. The web installer always pulls <code>/releases/latest</code>, so users get the new build the moment you mark it Latest on GitHub.
      </p>

      <h2>1 — Prep the working tree</h2>
      <ul>
        <li>Update <code>CHANGELOG.md</code>.</li>
        <li>If you changed defaults or flags, bump examples in <code>README.md</code> and <code>/guide</code>.</li>
        <li>Run <code>go test ./...</code> and <code>go vet ./...</code> from <code>agent/</code>.</li>
      </ul>

      <h2>2 — Dry-run locally</h2>
      <p>Catches GoReleaser config errors before the tag goes public.</p>
      <CodeBlock language="bash" code={`cd agent
goreleaser release --snapshot --clean
# Inspect dist/ — should contain acyn-go_*_windows_amd64.zip etc.`} />

      <h2>3 — Tag and push</h2>
      <CodeBlock language="bash" code={`git tag -a v1.2.0 -m "ACYN-Go v1.2.0"
git push origin v1.2.0`} />
      <p>That push triggers <code>.github/workflows/release.yml</code>, which runs GoReleaser with the <code>GITHUB_TOKEN</code> already scoped for releases.</p>

      <h2>4 — Watch CI</h2>
      <p>Visit <code>https://github.com/acyninnovation/acyn-go/actions</code>. The job should finish in 2–4 minutes and produce a draft release with:</p>
      <ul>
        <li><code>acyn-go_&lt;version&gt;_windows_amd64.zip</code></li>
        <li><code>acyn-go_&lt;version&gt;_linux_amd64.tar.gz</code></li>
        <li><code>acyn-go_&lt;version&gt;_darwin_arm64.tar.gz</code></li>
        <li><code>checksums.txt</code></li>
      </ul>

      <h2>5 — Verify the Windows artifact</h2>
      <CodeBlock language="powershell" code={`# Download the zip from the GitHub Release page, then:
Expand-Archive .\\acyn-go_v1.2.0_windows_amd64.zip -DestinationPath .\\acyn-go
.\\acyn-go\\acyn-go.exe --version
# Should print: acyn-go v1.2.0`} />

      <h2>6 — Mark as Latest</h2>
      <p>On the GitHub Releases page, edit the draft, tick <em>Set as the latest release</em>, and publish.</p>
      <p>From this moment forward, the one-liner installer picks up the new version:</p>
      <CodeBlock language="powershell" code={`iwr -useb https://go.acyninnovation.com/install.ps1 | iex`} />

      <h2>7 — Hotfix flow</h2>
      <CodeBlock language="bash" code={`git checkout -b release/v1.2.x v1.2.0
git cherry-pick <sha>
git tag -a v1.2.1 -m "Hotfix"
git push origin release/v1.2.x v1.2.1`} />

      <h2>GitHub repository setup (one-time)</h2>
      <ol>
        <li>Create an empty repo at <code>github.com/acyninnovation/acyn-go</code>.</li>
        <li>Push the <code>agent/</code> directory of this project as its own repo root (e.g. <code>git subtree push --prefix=agent origin main</code>).</li>
        <li>In <strong>Settings → Actions → General</strong>, enable <em>Read and write permissions</em> for <code>GITHUB_TOKEN</code>.</li>
        <li>Add a custom 404 if you want — releases work without it.</li>
      </ol>

      <h2>Files that govern the release</h2>
      <ul>
        <li><code>agent/.github/workflows/release.yml</code> — CI trigger on <code>v*</code> tags.</li>
        <li><code>agent/.goreleaser.yaml</code> — build matrix and archive naming. Must match what <code>public/install.ps1</code> downloads.</li>
        <li><code>public/install.ps1</code> — Windows one-liner. Updates archive name if you change the GoReleaser template.</li>
      </ul>
    </article>
  );
}
