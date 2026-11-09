import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useChat } from "../lib/useChat";
import { useChatRooms } from "../lib/queries";
import type { ChatMessage } from "../lib/types";
import { Button, Card, cx, ErrorNote, PageHeader, Spinner } from "../components/ui";
import { Paywall } from "../components/Paywall";

export default function Chat() {
  const { user } = useAuth();
  if (!user?.subscription.entitled) {
    return (
      <>
        <PageHeader title="Trader chat" subtitle="Talk markets with other subscribers." />
        <Paywall title="Chat is for subscribers">Subscribers can join live rooms for crypto, forex, SMC and price action, and trade ideas with other traders.</Paywall>
      </>
    );
  }
  return <Room />;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Room() {
  const rooms = useChatRooms();
  const [params, setParams] = useSearchParams();
  const slug = params.get("room") ?? rooms.data?.[0]?.slug ?? null;
  const chat = useChat(slug);
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const current = rooms.data?.find((r) => r.slug === slug);

  // Keep the view pinned to the newest message unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);
  useEffect(() => { stick.current = true; }, [slug]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (chat.send(draft)) {
      setDraft("");
      stick.current = true;
    }
  };

  if (rooms.isLoading) return <Spinner />;
  if (chat.status === "denied") return <Paywall title="Your subscription is no longer active">Renew to rejoin the conversation.</Paywall>;

  return (
    <>
      <PageHeader title="Trader chat" subtitle="Be civil, no financial advice, and never share account passwords." />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Rooms">
        {rooms.data?.map((r) => (
          <button key={r.slug} role="tab" aria-selected={r.slug === slug} onClick={() => setParams({ room: r.slug })}
            className={cx("shrink-0 rounded-lg border px-3 py-1.5 text-sm", r.slug === slug ? "border-accent bg-accent/5 font-medium" : "border-line hover:bg-surface-2")}>
            # {r.name} <span className="text-ink-2">· {r.slug === slug && chat.status === "open" ? chat.presence.length : r.online} online</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <Card className="flex h-[calc(100vh-17rem)] min-h-[420px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold"># {current?.name ?? slug}</h2>
              <p className="text-xs text-ink-2">{current?.description}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-2" role="status">
              <span className={cx("size-2 rounded-full", chat.status === "open" ? "bg-good" : "bg-warning")} aria-hidden />
              {chat.status === "open" ? "Connected" : chat.status === "missing" ? "Room not found" : "Connecting…"}
            </span>
          </div>

          <div ref={list} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-label="Conversation">
            {chat.hasMore && <div className="mb-3 text-center"><Button variant="ghost" size="sm" onClick={() => { stick.current = false; void chat.loadEarlier(); }}>Load earlier messages</Button></div>}
            {chat.messages.length === 0 && chat.status === "open" && <p className="py-10 text-center text-sm text-ink-2">No messages yet. Say hello.</p>}
            <MessageList messages={chat.messages} meId={chat.meId} />
          </div>

          <form onSubmit={submit} className="border-t border-line p-3">
            {chat.notice && <div className="mb-2"><ErrorNote>{chat.notice}</ErrorNote></div>}
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder={chat.status === "open" ? "Message the room" : "Connecting…"} disabled={chat.status !== "open"} aria-label="Message" autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted disabled:opacity-60" />
              <Button type="submit" disabled={chat.status !== "open" || !draft.trim()} aria-label="Send message"><Send className="size-4" aria-hidden /></Button>
            </div>
          </form>
        </Card>

        <Card className="hidden h-fit p-4 lg:block">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-ink-2" aria-hidden />Online ({chat.presence.length})</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {chat.presence.map((p) => <li key={p.id} className="flex items-center gap-2"><span className="size-2 rounded-full bg-good" aria-hidden />{p.name}{p.id === chat.meId && <span className="text-xs text-ink-2">(you)</span>}</li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}

function MessageList({ messages, meId }: { messages: ChatMessage[]; meId: number | null }) {
  return (
    <ul className="space-y-0.5">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const head = !prev || prev.user_id !== m.user_id || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;
        const mine = m.user_id === meId;
        return (
          <li key={m.id} className={head ? "pt-3" : undefined}>
            {head && (
              <div className="flex items-baseline gap-2 text-xs">
                <span className={cx("text-sm font-semibold", mine && "text-accent")}>{mine ? "You" : m.user_name}</span>
                <time dateTime={m.created_at} className="text-ink-2">{time(m.created_at)}</time>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
          </li>
        );
      })}
    </ul>
  );
}
