import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentInfo } from "./PairingCard";
import type { Family } from "@/lib/huawei-prompts";

export type ExecMessage =
  | { type: "device"; vendor: string; model: string; family: AgentInfo["family"]; prompt: string }
  | { type: "output"; id: string; line: string; stream: "stdout" | "stderr" }
  | { type: "done"; id: string; ok: boolean; durationMs: number };

export type SocketStatus = "idle" | "pairing" | "connected" | "error";

export type DiscoveredDevice = {
  ip: string;
  openPorts: number[];
  vendor: "huawei" | "unknown" | string;
  family: Family | "";
  banner: string;
  suggested: { protocol: "ssh" | "telnet" | string; port: number; username: string };
};

export type ConnectCreds = {
  ip: string;
  port: number;
  protocol: "ssh" | "telnet";
  username: string;
  password: string;
  family: Family;
  sshLegacy?: boolean;
};

export function useAgentSocket(onMessage: (m: ExecMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const endpointRef = useRef<{ host: string; port: number } | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [device, setDevice] = useState<AgentInfo | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const pair = useCallback(async (host: string, port: number, code: string) => {
    setStatus("pairing");
    try {
      const resp = await fetch(`http://${host}:${port}/pair`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!resp.ok) throw new Error("pair " + resp.status);
      const { token } = (await resp.json()) as { token: string };
      tokenRef.current = token;
      endpointRef.current = { host, port };

      const ws = new WebSocket(`ws://${host}:${port}/session?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as ExecMessage;
          if (msg.type === "device") {
            setDevice({ vendor: msg.vendor, model: msg.model, family: msg.family, prompt: msg.prompt });
          }
          onMessageRef.current(msg);
        } catch {
          /* ignore */
        }
      };
      ws.onopen = () => setStatus("connected");
      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        setStatus("idle");
        setDevice(null);
        wsRef.current = null;
        tokenRef.current = null;
      };
    } catch {
      setStatus("error");
    }
  }, []);

  const exec = useCallback((id: string, commands: string[], save: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "exec", id, commands, save }));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  const discover = useCallback(async (): Promise<DiscoveredDevice[]> => {
    const ep = endpointRef.current;
    const token = tokenRef.current;
    if (!ep || !token) throw new Error("Pair the agent first.");
    const resp = await fetch(
      `http://${ep.host}:${ep.port}/discover?token=${encodeURIComponent(token)}`,
    );
    if (!resp.ok) throw new Error("discover " + resp.status);
    const data = (await resp.json()) as { devices: DiscoveredDevice[] };
    return data.devices ?? [];
  }, []);

  const connectDevice = useCallback(
    async (creds: ConnectCreds): Promise<{ ok: boolean; error?: string }> => {
      const ep = endpointRef.current;
      const token = tokenRef.current;
      if (!ep || !token) return { ok: false, error: "Pair the agent first." };
      const resp = await fetch(
        `http://${ep.host}:${ep.port}/connect?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(creds),
        },
      );
      const body = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!resp.ok || !body.ok) {
        return { ok: false, error: body.error || `connect ${resp.status}` };
      }
      return { ok: true };
    },
    [],
  );

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, device, pair, exec, disconnect, discover, connectDevice };
}
