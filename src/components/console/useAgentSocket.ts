import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentInfo } from "./PairingCard";

export type ExecMessage =
  | { type: "device"; vendor: string; model: string; family: AgentInfo["family"]; prompt: string }
  | { type: "output"; id: string; line: string; stream: "stdout" | "stderr" }
  | { type: "done"; id: string; ok: boolean; durationMs: number };

export type SocketStatus = "idle" | "pairing" | "connected" | "error";

export function useAgentSocket(onMessage: (m: ExecMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
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

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, device, pair, exec, disconnect };
}
