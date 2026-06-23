import { CheckCircle2, Circle, Terminal, Link2, Wand2 } from "lucide-react";

type Step = { id: string; title: string; body: React.ReactNode; done: boolean };

export function Wizard({
  installed,
  paired,
  intentSent,
}: {
  installed: boolean;
  paired: boolean;
  intentSent: boolean;
}) {
  const steps: Step[] = [
    {
      id: "install",
      title: "Install the agent on the Windows machine that reaches the device",
      done: installed,
      body: (
        <code className="mt-1 block overflow-x-auto rounded bg-background px-2 py-1 text-[11px] text-accent">
          iwr -useb https://go.acyninnovation.com/install.ps1 | iex
        </code>
      ),
    },
    {
      id: "serve",
      title: "Run the agent",
      done: paired,
      body: (
        <>
          <code className="mt-1 block overflow-x-auto rounded bg-background px-2 py-1 text-[11px] text-accent">
            acyn-go serve
          </code>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Your browser opens automatically and pairs in one click — no codes to type. Add{" "}
            <code className="text-foreground/80">--cli</code> for the legacy interactive prompts.
          </p>
        </>
      ),
    },
    {
      id: "pair",
      title: "Pick your device",
      done: paired,
      body: (
        <p className="mt-1 text-[11px] text-muted-foreground">
          The console scans your LAN for Huawei, MikroTik, and Cisco devices. Click one, enter
          credentials, and you're connected.
        </p>
      ),
    },
    {
      id: "intent",
      title: "Tell the agent what you want",
      done: intentSent,
      body: (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pick a recipe below or type plain English. Fill any{" "}
          <span className="text-amber-300">&lt;highlighted&gt;</span> fields, then Run.
        </p>
      ),
    },
  ];

  const icons = [Terminal, Terminal, Link2, Wand2];

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-primary/80 mb-3">Getting started</div>
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const Icon = icons[i];
          return (
            <li key={s.id} className="flex gap-3">
              <div className="mt-0.5">
                {s.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground/90">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                </div>
                {!s.done && s.body}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const RECIPES: { label: string; family: "hg" | "olt" | "switch" | "gpon" | "mikrotik" | "cisco"; intent: string }[] = [
  {
    label: "Change Wi-Fi password",
    family: "hg",
    intent: "Change the 2.4GHz Wi-Fi password to <new-password> on the default SSID, keep SSID unchanged.",
  },
  {
    label: "Rename Wi-Fi SSID",
    family: "hg",
    intent: "Rename the primary SSID to <new-ssid> and keep the existing WPA2 password.",
  },
  {
    label: "Provision new ONU",
    family: "olt",
    intent:
      "Add a new ONT on port 0/<slot>/<port> with serial number <SN>, line profile <lp>, service profile <sp>, description \"<desc>\", and bind service-port to VLAN <vid>.",
  },
  {
    label: "Create management VLAN",
    family: "switch",
    intent: "Create VLAN <id> as a management VLAN and tag it on uplink port GigabitEthernet0/0/<port>.",
  },
  {
    label: "Show ONU autofind",
    family: "olt",
    intent: "Show all unprovisioned ONUs the OLT has discovered.",
  },
  {
    label: "Set PPPoE on WAN",
    family: "gpon",
    intent: "Configure WAN as PPPoE with username <pppoe-user> and password <pppoe-pass>, VLAN <vid>.",
  },
  {
    label: "Harden MikroTik SSH",
    family: "mikrotik",
    intent:
      "Harden the router: rename identity to <name>, move SSH to port <port>, disable telnet/ftp/www/api/api-ssl, enable strong-crypto with ed25519 host key, and add admin user <user> with password <password>.",
  },
  {
    label: "MikroTik WireGuard server",
    family: "mikrotik",
    intent:
      "Set up a WireGuard server on interface wg0 listening on UDP <port>, address <server-cidr>, add one peer with public key <peer-pubkey> and allowed-address <peer-cidr>.",
  },
  {
    label: "MikroTik LAN bridge + DHCP + NAT",
    family: "mikrotik",
    intent:
      "Create a LAN bridge with ether2..ether5, assign <lan-cidr> on the bridge, run a DHCP server with pool <pool-start>-<pool-end> and DNS 1.1.1.1, and masquerade out <wan-if>.",
  },
  {
    label: "Cisco access port + VLAN",
    family: "cisco",
    intent:
      "On switch interface GigabitEthernet0/<port>, set it as an access port on VLAN <vid>, name the VLAN \"<name>\", and save.",
  },
  {
    label: "Cisco trunk uplink",
    family: "cisco",
    intent:
      "Configure GigabitEthernet0/<port> as a dot1q trunk allowing VLANs <vid-list>, and save.",
  },
];
