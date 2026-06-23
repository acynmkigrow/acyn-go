import { useEffect, useRef, useState } from "react";
import { Search, Loader2, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import type { ConnectCreds, DiscoveredDevice } from "./useAgentSocket";
import type { Family } from "@/lib/huawei-prompts";

const LAST_DEVICE_KEY = "acyn-go.lastDevice.v1";

type LastDevice = { ip: string; family: Family; username: string; protocol: "ssh" | "telnet" };

function loadLastDevice(): LastDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_DEVICE_KEY);
    return raw ? (JSON.parse(raw) as LastDevice) : null;
  } catch {
    return null;
  }
}

function saveLastDevice(d: LastDevice) {
  try {
    window.localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function vendorBadgeClass(d: DiscoveredDevice) {
  if (d.family === "swos") return "text-amber-400/90";
  switch (d.vendor) {
    case "huawei":
      return "text-red-400/90";
    case "mikrotik":
      return "text-orange-400/90";
    case "cisco":
      return "text-blue-400/90";
    default:
      return "text-white/40";
  }
}

function vendorLabel(d: DiscoveredDevice) {
  if (d.family === "swos") return "MikroTik · SwOS (CLI not supported — web UI only)";
  if (d.vendor === "huawei") return `Huawei${d.family ? " · " + d.family.toUpperCase() : ""}`;
  if (d.vendor === "mikrotik") return "MikroTik · RouterOS";
  if (d.vendor === "cisco") return "Cisco · IOS/IOS-XE/NX-OS";
  return "unknown";
}

export function DiscoverPanel({
  onDiscover,
  onConnect,
  autoScan,
}: {
  onDiscover: () => Promise<DiscoveredDevice[]>;
  onConnect: (creds: ConnectCreds) => Promise<{ ok: boolean; error?: string }>;
  autoScan?: boolean;
}) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[] | null>(null);
  const [picked, setPicked] = useState<DiscoveredDevice | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const autoFired = useRef(false);

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

  useEffect(() => {
    if (autoScan && !autoFired.current) {
      autoFired.current = true;
      void scan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan]);

  return (
    <div className="rounded-md border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Devices on LAN</div>
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          {scanning ? "Scanning…" : devices ? "Rescan" : "Find devices"}
        </button>
      </div>

      {scanning && !devices && (
        <p className="text-xs text-muted-foreground">Scanning your LAN for Huawei, MikroTik, and Cisco devices…</p>
      )}

      {!scanning && !devices && (
        <p className="text-xs text-muted-foreground">
          Click <span className="text-primary">Find devices</span> to scan your local network. ~8 seconds.
        </p>
      )}

      {devices && devices.length > 0 && (
        <ul className="space-y-1.5">
          {devices.map((d) => (
            <li key={d.ip}>
              <button
                onClick={() => setPicked(d)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/50"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="truncate font-mono text-sm text-foreground">{d.ip}</span>
                  <span className="text-[10px] text-muted-foreground">{d.openPorts.join(" · ")}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <Wifi className="h-3 w-3 text-muted-foreground" />
                  <span className={vendorBadgeClass(d)}>{vendorLabel(d)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setManualOpen(true)}
        className="mt-3 text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        Connect manually by IP →
      </button>

      {picked && (
        <CredsDialog
          device={picked}
          onClose={() => setPicked(null)}
          onSubmit={async (creds) => {
            const res = await onConnect(creds);
            if (res.ok) {
              toast.success(`Connected to ${creds.ip}`);
              saveLastDevice({ ip: creds.ip, family: creds.family, username: creds.username, protocol: creds.protocol });
              setPicked(null);
            } else {
              toast.error(res.error || "Connect failed");
            }
            return res;
          }}
        />
      )}

      {manualOpen && (
        <CredsDialog
          device={null}
          onClose={() => setManualOpen(false)}
          onSubmit={async (creds) => {
            const res = await onConnect(creds);
            if (res.ok) {
              toast.success(`Connected to ${creds.ip}`);
              saveLastDevice({ ip: creds.ip, family: creds.family, username: creds.username, protocol: creds.protocol });
              setManualOpen(false);
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
  device: DiscoveredDevice | null;
  onClose: () => void;
  onSubmit: (creds: ConnectCreds) => Promise<{ ok: boolean; error?: string }>;
}) {
  const families: Family[] = ["hg", "gpon", "xpon", "olt", "switch", "mikrotik", "cisco"];
  const last = loadLastDevice();

  const initialProtocol: "ssh" | "telnet" = device
    ? ((device.suggested.protocol === "ssh" || device.suggested.protocol === "telnet"
        ? device.suggested.protocol
        : device.openPorts.includes(22)
        ? "ssh"
        : "telnet") as "ssh" | "telnet")
    : last?.protocol ?? "ssh";

  const [ip, setIp] = useState(device?.ip ?? last?.ip ?? "");
  const [protocol, setProtocol] = useState<"ssh" | "telnet">(initialProtocol);
  const [port, setPort] = useState(device?.suggested.port || (initialProtocol === "ssh" ? 22 : 23));
  const [username, setUsername] = useState(device?.suggested.username ?? last?.username ?? "admin");
  const [password, setPassword] = useState("admin");
  const [family, setFamily] = useState<Family>(
    ((device?.family && device.family !== "swos" ? device.family : last?.family) ?? "hg") as Family,
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-md border border-border bg-card p-4 shadow-2xl sm:p-6">
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Connect to</div>
            <div className="truncate font-mono text-lg text-foreground">{device ? device.ip : "manual"}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ip) {
              toast.error("Enter an IP.");
              return;
            }
            setBusy(true);
            await onSubmit({ ip, port, protocol, username, password, family });
            setBusy(false);
          }}
          className="space-y-3"
        >
          {!device && (
            <label className="block text-xs text-muted-foreground">
              IP
              <input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.1"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Protocol
              <select
                value={protocol}
                onChange={(e) => {
                  const p = e.target.value as "ssh" | "telnet";
                  setProtocol(p);
                  setPort(p === "ssh" ? 22 : 23);
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Port
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 22)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground outline-none focus:border-primary"
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
