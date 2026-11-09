import { useCallback, useEffect, useRef, useState } from "react";
import { api, getFreshToken } from "./api";
import type { ChatMessage } from "./types";

export type ChatStatus = "connecting" | "open" | "reconnecting" | "denied" | "missing";
export interface Presence { id: number; name: string }

const PAGE = 50;

/** Merge by id, ascending, without duplicates (history and live frames can overlap after a reconnect). */
export function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export function useChat(room: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [status, setStatus] = useState<ChatStatus>("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!room) return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setMessages([]);
    setPresence([]);
    setHasMore(false);
    setStatus("connecting");

    const loadLatest = async () => {
      try {
        const rows = await api<ChatMessage[]>(`/chat/rooms/${room}/messages`, { query: { limit: PAGE } });
        if (closed) return;
        setMessages((prev) => mergeMessages(prev, rows));
        setHasMore((h) => h || rows.length === PAGE);
      } catch {
        /* the live socket still works; history can be retried by reconnecting */
      }
    };

    const connect = async () => {
      const token = await getFreshToken();
      if (closed) return;
      if (!token) {
        setStatus("denied");
        return;
      }
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/chat/ws/${room}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
      ws.onmessage = (ev) => {
        let m: { type: string; [k: string]: unknown };
        try {
          m = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (m.type === "ready") {
          retry = 0;
          setStatus("open");
          setMeId((m.you as { id: number }).id);
          void loadLatest(); // fill any gap from while we were disconnected
        } else if (m.type === "presence") {
          setPresence(m.users as Presence[]);
        } else if (m.type === "message") {
          setMessages((prev) => mergeMessages(prev, [m.message as ChatMessage]));
        } else if (m.type === "error") {
          if (m.code === "rate_limited") setNotice(String(m.detail));
        }
      };
      ws.onclose = (ev) => {
        if (closed) return;
        if (ev.code === 4403) return setStatus("denied");
        if (ev.code === 4404) return setStatus("missing");
        setStatus("reconnecting");
        const delay = Math.min(1000 * 2 ** retry++, 15000);
        timer = setTimeout(connect, delay);
      };
    };

    void connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [room]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const send = useCallback((content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !content.trim()) return false;
    ws.send(JSON.stringify({ type: "message", content }));
    return true;
  }, []);

  const loadEarlier = useCallback(async () => {
    if (!room || messages.length === 0) return;
    const rows = await api<ChatMessage[]>(`/chat/rooms/${room}/messages`, { query: { limit: PAGE, before_id: messages[0]!.id } });
    setMessages((prev) => mergeMessages(rows, prev));
    setHasMore(rows.length === PAGE);
  }, [room, messages]);

  return { messages, presence, status, notice, hasMore, meId, send, loadEarlier };
}
