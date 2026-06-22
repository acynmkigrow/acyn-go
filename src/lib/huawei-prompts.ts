// Shared between server fn and client validators. No server-only imports here.

export type Family = "hg" | "gpon" | "xpon" | "olt" | "switch";

export const FAMILY_HINTS: Record<Family, string> = {
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
};

export const SYSTEM_PROMPT = `You are ACYN-Go, an expert Huawei carrier and home-network CLI assistant.
The user describes intent in plain English. Respond with ONLY a single JSON object matching this schema:

{
  "description": "one-line summary",
  "warning": "safety note or empty string",
  "commands": ["cmd1", "cmd2", "..."],
  "requires_save": true | false,
  "destructive": true | false
}

Hard rules:
- Emit commands in the exact order the device expects them.
- Include the vendor save command at the end of every write batch and set requires_save: true.
- Read-only requests: requires_save: false, destructive: false.
- Never invent slot/port/IP/SN/MAC; if missing, return commands: [] and ask for it in warning.
- Forbidden unless the user explicitly typed the same destructive verb: reset saved-configuration, factory reset, undo vlan all, clear configuration this, format flash, reboot, erase.
- If you detect a destructive intent, set destructive: true and write a clear warning.
- Never use markdown, code fences, or prose outside the JSON object.`;

export function buildPrompt(family: Family): string {
  return `${SYSTEM_PROMPT}\n\n${FAMILY_HINTS[family]}`;
}

const DESTRUCTIVE_PATTERNS = [
  /\breset\s+saved-configuration\b/i,
  /\bfactory\s+reset\b/i,
  /\bundo\s+vlan\s+all\b/i,
  /\bclear\s+configuration\s+this\b/i,
  /\bformat\s+flash\b/i,
  /\breboot\b/i,
  /\berase\b/i,
];

export function validateCommands(commands: string[], intent: string): { ok: boolean; reason?: string } {
  for (const cmd of commands) {
    const clean = cmd.trim();
    if (!clean) continue;
    if (/[`*]{3,}|```/.test(clean)) return { ok: false, reason: "Command contains markdown formatting." };
    for (const pat of DESTRUCTIVE_PATTERNS) {
      if (pat.test(clean) && !pat.test(intent)) {
        return { ok: false, reason: `Refusing destructive command "${clean}" — not requested explicitly.` };
      }
    }
    // wildcard slot guard
    if (/\b0\/\*\/\*/.test(clean) || /\ball\s+all\b/i.test(clean)) {
      return { ok: false, reason: `Wildcard slot/port in "${clean}".` };
    }
  }
  return { ok: true };
}
