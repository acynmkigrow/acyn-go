import { useState } from "react";
import { Search, Loader2, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import type { ConnectCreds, DiscoveredDevice } from "./useAgentSocket";
import type { Family } from "@/lib/huawei-prompts";

export function DiscoverPanel({
  onDiscover,
  onConnect,
}: {
  onDiscover: () => Promise<DiscoveredDevice[]>;
  onConnect: (creds: ConnectCreds) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[] | null>(null);
  const [picked, setPicked] = useState<DiscoveredDevice | null>(null);

  async function scan() {
    setScanning(true);
    try {
      const list = await onDiscover();
      setDevices(list);
      if (list.length === 0) toast.info("No devices found on the LAN.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-white/40">Devices on LAN</div>
        <button
          onClick={scan}
          disabled={scanning}
          className="text-xs inline-flex items-center gap-1.5 rounded-md bg-white/5 hover:bg-white/10 px-2.5 py-1 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {scanning ? "Scanning…" : devices ? "Rescan" : "Find devices"}
        </button>
      </div>

      {!devices && !scanning && (
        <p className="text-xs text-white/40">
          Click <span className="text-primary">Find devices</span> to scan your local network for
          Huawei routers, ONTs, OLTs and switches. ~8 seconds.
        </p>
      )}

      {devices && devices.length > 0 && (
        <ul className="space-y-1.5">
          {devices.map((d) => (
            <li key={d.ip}>
              <button
                onClick={() => setPicked(d)}
                className="w-full text-left rounded-md border border-white/5 bg-black/30 hover:border-primary/40 hover:bg-white/[0.04] transition px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-white/90">{d.ip}</span>
                  <span className="text-[10px] text-white/40">
                    {d.openPorts.join(" · ")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <Wifi className="h-3 w-3 text-white/40" />
                  <span
                    className={
                      d.family === "swos"
                        ? "text-amber-400/90"
                        : d.vendor === "huawei"
                        ? "text-emerald-400/90"
                        : d.vendor === "mikrotik"
                        ? "text-orange-400/90"
                        : "text-white/40"
                    }
                  >
                    {d.family === "swos"
                      ? "MikroTik · SwOS (CLI not supported — web UI only)"
                      : d.vendor === "huawei"
                      ? `Huawei${d.family ? " · " + d.family.toUpperCase() : ""}`
                      : d.vendor === "mikrotik"
                      ? "MikroTik · RouterOS"
                      : "unknown"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <CredsDialog
          device={picked}
          onClose={() => setPicked(null)}
          onSubmit={async (creds) => {
            const res = await onConnect(creds);
            if (res.ok) {
              toast.success(`Connected to ${creds.ip}`);
              setPicked(null);
            } else {
              toast.error(res.error || "Connect failed");
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function CredsDialog({
  device,
  onClose,
  onSubmit,
}: {
  device: DiscoveredDevice;
  onClose: () => void;
  onSubmit: (creds: ConnectCreds) => Promise<{ ok: boolean; error?: string }>;
}) {
  const families: Family[] = ["hg", "gpon", "xpon", "olt", "switch", "mikrotik"];
  const [protocol, setProtocol] = useState<"ssh" | "telnet">(
    (device.suggested.protocol === "ssh" || device.suggested.protocol === "telnet"
      ? device.suggested.protocol
      : device.openPorts.includes(22)
      ? "ssh"
      : "telnet") as "ssh" | "telnet",
  );
  const [port, setPort] = useState(device.suggested.port || (protocol === "ssh" ? 22 : 23));
  const [username, setUsername] = useState(device.suggested.username || "admin");
  const [password, setPassword] = useState("admin");
  const [family, setFamily] = useState<Family>(
    (device.family || "hg") as Family,
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40">Connect to</div>
            <div className="font-mono text-lg">{device.ip}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onSubmit({ ip: device.ip, port, protocol, username, password, family });
            setBusy(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/60">
              Protocol
              <select
                value={protocol}
                onChange={(e) => {
                  const p = e.target.value as "ssh" | "telnet";
                  setProtocol(p);
                  setPort(p === "ssh" ? 22 : 23);
                }}
                className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-sm outline-none focus:border-primary"
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
            </label>
            <label className="text-xs text-white/60">
              Port
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-sm font-mono outline-none focus:border-primary"
              />
            </label>
          </div>
          <label className="block text-xs text-white/60">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs text-white/60">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm font-mono outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs text-white/60">
            Device family
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value as Family)}
              className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-2 py-2 text-sm outline-none focus:border-primary"
            >
              {families.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
          <p className="text-[10px] text-white/30 text-center">
            Credentials stay on your machine. Never sent to ACYN servers.
          </p>
        </form>
      </div>
    </div>
  );
}
