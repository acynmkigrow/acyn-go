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
        <code className="block mt-1 text-[11px] text-emerald-300 bg-black/40 rounded px-2 py-1">
          iwr -useb https://go.acyninnovation.com/install.ps1 | iex
        </code>
      ),
    },
    {
      id: "serve",
      title: "Run the agent and connect to your device",
      done: paired,
      body: (
        <>
          <code className="block mt-1 text-[11px] text-emerald-300 bg-black/40 rounded px-2 py-1">
            acyn-go serve
          </code>
          <p className="mt-1 text-[11px] text-white/40">
            Enter device IP, protocol, credentials. The agent prints a 6-digit pair code
            and a clickable pair link.
          </p>
        </>
      ),
    },
    {
      id: "pair",
      title: "Pair this browser",
      done: paired,
      body: (
        <p className="mt-1 text-[11px] text-white/40">
          Paste the 6-digit code into the card on the left — or click the link printed in
          your terminal and it auto-pairs.
        </p>
      ),
    },
    {
      id: "intent",
      title: "Tell the agent what you want",
      done: intentSent,
      body: (
        <p className="mt-1 text-[11px] text-white/40">
          Pick a recipe below or type plain English. Fill any{" "}
          <span className="text-amber-300">&lt;highlighted&gt;</span> fields, then Run.
        </p>
      ),
    },
  ];

  const icons = [Terminal, Terminal, Link2, Wand2];

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
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
                  <Circle className="h-4 w-4 text-white/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm text-white/80">
                  <Icon className="h-3.5 w-3.5 text-white/40" />
                  <span className={s.done ? "line-through text-white/40" : ""}>{s.title}</span>
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

export const RECIPES: { label: string; family: "hg" | "olt" | "switch" | "gpon"; intent: string }[] = [
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
];
