const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

type Family = "hg" | "gpon" | "xpon" | "olt" | "switch" | "mikrotik" | "cisco";

type Turn = { role: "user" | "assistant"; text: string };

type PlanInput = {
  intent: string;
  family: Family;
  device_model?: string;
  recent_output?: string;
  history?: Turn[];
};

type Plan = {
  description: string;
  warning: string;
  commands: string[];
  verify_commands: string[];
  rollback_commands: string[];
  requires_save: boolean;
  destructive: boolean;
};

const FAMILY_HINTS: Record<Family, string> = {
  olt: `Target: Huawei MA5800 / MA5600T OLT.
- Enter sequence: enable -> config
- VLAN create: vlan <id> smart
- Service port: service-port <idx> vlan <vid> gpon 0/<slot>/<port> ont <ontid> gemport <gid> multi-service user-vlan <uvid>
- ONT add: ont add 0/<slot>/<port> <ontid> sn-auth "<SN>" omci ont-lineprofile-id <lp> ont-srvprofile-id <sp> desc "<desc>"
- ONT delete: ont delete 0/<slot>/<port> <ontid>
- Display: display ont info 0/<slot>/<port> all | display ont autofind all
- Always end write batches with: save
- NEVER emit: reset saved-configuration, factory reset, undo vlan all, reboot, format flash
- Slot/port wildcards are forbidden. Always supply explicit 0/<slot>/<port>.`,
  hg: `Target: Huawei HG8245H / HG8546M home gateway.
- Enter sequence: enable -> config
- WLAN: wlan ssid-profile name <p> / wlan security-profile name <p> / wlan vap-profile name <p>, then bind under interface vap-profile
- WAN: wan-srv-profile name <p>, then attach with traffic-table index <n>
- Bridge mode: undo route under wan-ip-connection
- WPA2-PSK: security-policy wpa2-psk, wpa2-psk pass-phrase <ascii>
- End with: save
- NEVER: factory reset, reset-default, reboot (unless user explicitly typed reboot)`,
  gpon: `Target: GPON ONT, bridge or router mode.
- Enter: enable -> config
- VLAN tag uplink: under wan-ip-connection -> vlan <id>
- PPPoE: wan-ip-connection ... mode pppoe pppoe-name <user> pppoe-password <pw>
- DHCP: wan-ip-connection ... mode dhcp
- Always end with: save`,
  xpon: `Target: XPON ONT (XGS-PON capable). Treat the same as GPON profile but commands may live under interface epon if EPON OLT detected. Always confirm via display version before emitting interface-specific commands.`,
  switch: `Target: Huawei S-series switch (S5700/S6700/S5731).
- Enter: system-view
- VLAN create: vlan batch <id-list>
- Access port: interface GigabitEthernet0/0/<x> -> port link-type access -> port default vlan <id>
- Trunk port: interface GigabitEthernet0/0/<x> -> port link-type trunk -> port trunk allow-pass vlan <list>
- LACP: interface Eth-Trunk <N> -> mode lacp-static -> trunkport GigabitEthernet 0/0/<x> to 0/0/<y>
- Save: save  then Y to confirm
- NEVER: clear configuration this, reset saved-configuration, reboot`,
  mikrotik: `Target: MikroTik RouterOS (v6/v7) — CCR, CRS (RouterOS mode), RB, hAP, cAP, wAP, Chateau.
SYNTAX: one statement per line, hierarchical paths starting with '/'. NO 'enable', NO 'config', NO 'save' — RouterOS auto-persists. Set requires_save: false.
- Hardening: /system identity set name=<n>; /ip service set ssh port=<n>; /ip service set telnet,ftp,www,api,api-ssl disabled=yes; /user add name=<u> group=full password="<pw>"; /ip ssh set strong-crypto=yes host-key-type=ed25519 allow-none-crypto=no.
- L2: /interface bridge add name=BR vlan-filtering=yes; /interface bridge port add bridge=BR interface=ether<n> pvid=<vid>; /interface vlan add name=VLAN<id> interface=BR vlan-id=<id>.
- L3/Edge: /ip address add address=<cidr> interface=<if>; /ip route add gateway=<gw>; /ip pool add name=<p> ranges=<a>-<b>; /ip dhcp-server add address-pool=<p> interface=<if> name=<n> disabled=no; /ip dhcp-server network add address=<cidr> dns-server=<dns> gateway=<gw>; /ip firewall nat add chain=srcnat action=masquerade out-interface=<wan>.
- WireGuard server (v7): /interface wireguard add name=wg0 listen-port=<port>; /ip address add interface=wg0 address=<server-cidr>; /interface wireguard peers add interface=wg0 public-key="<peer-pubkey>" allowed-address=<peer-cidr>. Do not require a private-key unless the user supplies one; RouterOS can generate it. Do not require endpoint fields for a server peer unless supplied.
- RADIUS: /radius add service=login,hotspot,ppp address=<ip> secret="<s>"; /user aaa set use-radius=yes; /ip hotspot profile set <p> use-radius=yes.
- SMS (LTE/Chateau): /tool sms send <lte-if> phone-number=<num> message="<text>"; /tool sms inbox print; /interface lte set <if> apn-profiles=<p>.
- PPP secrets: /ppp secret add name=<u> password=<pw> service=pppoe profile=<prof>.
- Queues: /queue simple add name=<n> target=<cidr> max-limit=<up>/<down>.
- Read-only: append 'print' (e.g. '/ip address print').
- FORBIDDEN unless user typed the same verb: /system reset-configuration, /system reboot, /system shutdown, /file remove, /user remove, /interface remove, /system routerboard reset-configuration, unfiltered 'remove [find]'.`,
  cisco: `Target: Cisco IOS / IOS-XE / NX-OS (Catalyst, ISR, ASR, Nexus). Confirm with 'show version' if unsure.
- Mode ladder: user '>' -> enable -> '#' -> configure terminal -> '(config)#' -> end.
- VLAN: vlan <id> / name <n>.
- Access port: interface Gi0/<x> / switchport mode access / switchport access vlan <id>.
- Trunk port: interface Gi0/<x> / switchport trunk encapsulation dot1q / switchport mode trunk / switchport trunk allowed vlan <list>.
- L3 SVI: interface vlan <id> / ip address <ip> <mask> / no shutdown.
- Static route: ip route <net> <mask> <gw>.
- ACL: ip access-list extended <name> / permit|deny ... / interface <if> / ip access-group <name> in|out.
- Save: 'write memory' (or 'copy running-config startup-config').
- Read-only: 'show running-config', 'show ip interface brief', 'show vlan brief'.
- FORBIDDEN unless the user typed the same verb: reload, erase startup-config, write erase, delete /force, format flash:, no vlan on production.
- Never invent interface names, IPs, ACLs. If missing, return commands:[] and ask in warning.`,
};

const SYSTEM_PROMPT = `You are ACYN-Go, an expert multi-vendor network CLI assistant (Huawei carrier/home, MikroTik RouterOS, Cisco IOS/IOS-XE/NX-OS).
The user describes intent in plain English. Respond with ONLY a single JSON object matching this schema:

{
  "description": "one-line summary",
  "warning": "safety note or empty string",
  "commands": ["apply cmd1", "apply cmd2"],
  "verify_commands": ["read-only show/display/print cmds that prove the apply worked"],
  "rollback_commands": ["commands that undo 'commands' in reverse order — empty array if not safely reversible"],
  "requires_save": true | false,
  "destructive": true | false
}

Hard rules:
- Emit commands in the exact order the device expects them.
- Include the vendor save command at the end of every write batch and set requires_save: true (Huawei: 'save'; Cisco: 'write memory'; MikroTik auto-persists so requires_save: false).
- verify_commands MUST be read-only (display/show/print) and prove the intent applied. Always include at least one when commands is non-empty.
- rollback_commands undo 'commands' in reverse order using the vendor's 'undo'/'no'/'remove' equivalents. If the change cannot be safely reversed (e.g. firmware, factory reset), return [] and note it in warning.
- Read-only requests: commands: [], verify_commands: the user's requested show/display/print, rollback_commands: [], requires_save: false, destructive: false.
- Use the conversation history to resolve pronouns and follow-ups ("now add another peer", "remove that VLAN") — do not restart from scratch.
- Never invent slot/port/IP/SN/MAC; if missing, return commands: [] and ask for it in warning.
- Forbidden unless the user explicitly typed the same destructive verb: reset saved-configuration, factory reset, undo vlan all, clear configuration this, format flash, reboot, erase.
- If you detect a destructive intent, set destructive: true and write a clear warning.
- Never use markdown, code fences, or prose outside the JSON object.`;

const DESTRUCTIVE_PATTERNS = [
  /\breset\s+saved-configuration\b/i,
  /\bfactory\s+reset\b/i,
  /\bundo\s+vlan\s+all\b/i,
  /\bclear\s+configuration\s+this\b/i,
  /\bformat\s+flash\b/i,
  /\breboot\b/i,
  /\berase\b/i,
  /\/system\s+reset-configuration\b/i,
  /\/system\s+reboot\b/i,
  /\/system\s+shutdown\b/i,
  /\/system\s+routerboard\s+reset-configuration\b/i,
  /\/file\s+remove\b/i,
  /\/user\s+remove\b/i,
  /\/interface\s+remove\b/i,
  /\berase\s+startup-config\b/i,
  /\bwrite\s+erase\b/i,
  /\breload\b/i,
  /\bdelete\s+\/force\b/i,
  /\bformat\s+flash:/i,
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function readSecret(name: "GEMINI_API_KEY" | "LOVABLE_API_KEY") {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^export\s+/i, "")
    .replace(new RegExp(`^${name}\\s*=\\s*`, "i"), "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function parseInput(raw: unknown): PlanInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid request body.");
  const input = raw as Record<string, unknown>;
  const intent = typeof input.intent === "string" ? input.intent.trim() : "";
  const family = input.family;
  const families = new Set(["hg", "gpon", "xpon", "olt", "switch", "mikrotik", "cisco"]);
  if (!intent || intent.length > 2000) throw new Error("Intent is required.");
  if (typeof family !== "string" || !families.has(family)) throw new Error("Unsupported device family.");

  const history = Array.isArray(input.history)
    ? input.history.slice(-12).flatMap((turn): Turn[] => {
        if (!turn || typeof turn !== "object") return [];
        const role = (turn as Record<string, unknown>).role;
        const text = (turn as Record<string, unknown>).text;
        if ((role !== "user" && role !== "assistant") || typeof text !== "string") return [];
        return [{ role, text: text.slice(0, 2000) }];
      })
    : undefined;

  return {
    intent,
    family: family as Family,
    device_model: typeof input.device_model === "string" ? input.device_model.slice(0, 120) : undefined,
    recent_output: typeof input.recent_output === "string" ? input.recent_output.slice(0, 4000) : undefined,
    history,
  };
}

function buildPrompt(family: Family) {
  return `${SYSTEM_PROMPT}\n\n${FAMILY_HINTS[family]}`;
}

function buildUserPrompt(data: PlanInput) {
  const history = (data.history ?? [])
    .slice(-8)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n");
  return [
    `Device family: ${data.family}${data.device_model ? ` (${data.device_model})` : ""}`,
    history ? `Conversation so far:\n${history}` : "",
    data.recent_output ? `Recent device output:\n${data.recent_output.slice(-2000)}` : "",
    `Latest user request: ${data.intent}`,
    `Return JSON with: description, warning, commands (apply), verify_commands (read-only checks like 'show'/'display'/'print' to confirm config), rollback_commands (commands that undo 'commands' when possible; empty array if not safely reversible), requires_save, destructive.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizePlan(raw: unknown): Plan {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    description: typeof value.description === "string" ? value.description : "Prepared configuration plan.",
    warning: typeof value.warning === "string" ? value.warning : "",
    commands: Array.isArray(value.commands) ? value.commands.filter((x): x is string => typeof x === "string") : [],
    verify_commands: Array.isArray(value.verify_commands)
      ? value.verify_commands.filter((x): x is string => typeof x === "string")
      : [],
    rollback_commands: Array.isArray(value.rollback_commands)
      ? value.rollback_commands.filter((x): x is string => typeof x === "string")
      : [],
    requires_save: Boolean(value.requires_save),
    destructive: Boolean(value.destructive),
  };
}

function validateCommands(commands: string[], intent: string): { ok: boolean; reason?: string } {
  for (const cmd of commands) {
    const clean = cmd.trim();
    if (!clean) continue;
    if (/[`*]{3,}|```/.test(clean)) return { ok: false, reason: "Command contains markdown formatting." };
    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(clean) && !pattern.test(intent)) {
        return { ok: false, reason: `Refusing destructive command "${clean}" — not requested explicitly.` };
      }
    }
    if (/\b0\/\*\/\*/.test(clean) || /\ball\s+all\b/i.test(clean)) {
      return { ok: false, reason: `Wildcard slot/port in "${clean}".` };
    }
    if (/\bremove\s+\[\s*find\s*\]\s*$/i.test(clean)) {
      return { ok: false, reason: `Unfiltered 'remove [find]' in "${clean}" — add a where clause.` };
    }
  }
  return { ok: true };
}

function postProcess(plan: Plan, intent: string, family: Family): Plan {
  const check = validateCommands([...plan.commands, ...plan.rollback_commands], intent);
  if (!check.ok) {
    return {
      ...plan,
      commands: [],
      rollback_commands: [],
      warning: `${plan.warning ? `${plan.warning} ` : ""}Blocked by safety validator: ${check.reason}`,
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

function parseJsonFromText(text: string) {
  return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
}

function providerMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key not valid|INVALID_ARGUMENT|403|401/i.test(msg)) return "credentials rejected";
  if (/429|rate/i.test(msg)) return "rate limit";
  if (/402|credit|billing/i.test(msg)) return "out of credits";
  return msg.slice(0, 200);
}

async function verifySignedInUser(authHeader: string) {
  if (!authHeader.startsWith("Bearer ")) return false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://mrthznysxanbwzyawzyd.supabase.co";
  const supabaseKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? reqPublishableKeyFallback;
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, authorization: authHeader },
  });
  return resp.ok;
}

async function planWithGemini(system: string, user: string, apiKey: string): Promise<Plan> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return normalizePlan(parseJsonFromText(raw));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function planWithLovable(system: string, user: string, apiKey: string): Promise<Plan> {
  const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`Lovable ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json.choices?.[0]?.message?.content ?? "";
      return normalizePlan(parseJsonFromText(raw));
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/402|429/.test(msg)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const signedIn = await verifySignedInUser(req.headers.get("authorization") ?? "");
    if (!signedIn) return json({ error: "Sign in before using the AI console." }, 401);

    const data = parseInput(await req.json());
    const system = buildPrompt(data.family);
    const user = buildUserPrompt(data);
    const geminiKey = readSecret("GEMINI_API_KEY");
    const lovableKey = readSecret("LOVABLE_API_KEY");
    const errors: string[] = [];

    if (geminiKey) {
      try {
        return json({ plan: postProcess(await planWithGemini(system, user, geminiKey), data.intent, data.family), provider: "gemini-edge" });
      } catch (err) {
        console.error("[ai-plan] gemini failed", err);
        errors.push(`Gemini: ${providerMessage(err)}`);
      }
    }

    if (lovableKey) {
      try {
        return json({ plan: postProcess(await planWithLovable(system, user, lovableKey), data.intent, data.family), provider: "lovable-edge" });
      } catch (err) {
        console.error("[ai-plan] lovable failed", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (/402/.test(msg)) return json({ error: "AI service is over its credit limit right now. Please try again later." }, 402);
        if (/429/.test(msg)) return json({ error: "AI service is rate-limited. Wait a few seconds and try again." }, 429);
        errors.push(`Lovable: ${providerMessage(err)}`);
      }
    }

    if (!geminiKey && !lovableKey) return json({ error: "AI provider secrets are not configured." }, 503);
    return json({ error: `AI service couldn't generate a plan (${errors.join(" | ")}). Try rewording your request.` }, 502);
  } catch (err) {
    console.error("[ai-plan] failed", err);
    return json({ error: err instanceof Error ? err.message : "AI planner failed." }, 500);
  }
});