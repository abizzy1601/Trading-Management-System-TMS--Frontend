import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Pause, Play, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { sizingSummary } from "../../lib/copy";
import { dateTime } from "../../lib/format";
import { useFollows, useTickets } from "../../lib/queries";
import type { Follow, FollowSettings } from "../../lib/types";
import { Button, Card, cx, EmptyState, ErrorNote, Notice, PageHeader, Spinner } from "../../components/ui";
import { CopyTabs, FeedDelayNote, FollowSettingsFields, RiskNote, settingsValid, TicketCard } from "../../components/copy";

export default function Following() {
  const follows = useFollows();
  const action = useTickets("action");
  const history = useTickets("all");
  const waiting = action.data ?? [];
  const waitingIds = new Set(waiting.map((t) => t.id));
  const past = (history.data ?? []).filter((t) => !waitingIds.has(t.id)).slice(0, 20);

  return (
    <>
      <PageHeader title="Copy trading" subtitle="Trades from the traders you follow, sized for your account. You place every order yourself." />
      <CopyTabs />
      <div className="space-y-8">
        <section aria-labelledby="waiting-h">
          <h2 id="waiting-h" className="mb-3 flex items-center gap-2 text-base font-semibold">
            Waiting for you{waiting.length > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">{waiting.length}</span>}
          </h2>
          {action.isLoading && <Spinner />}
          {!action.isLoading && waiting.length === 0 && (
            <Card><EmptyState icon={<BellRing className="size-8" aria-hidden />} title="Nothing waiting">
              When a trader you follow opens, changes or closes a trade, it appears here. Their accounts are checked about every minute.
            </EmptyState></Card>
          )}
          <ul className="grid gap-3 lg:grid-cols-2">{waiting.map((t) => <li key={t.id} className="min-w-0"><TicketCard ticket={t} /></li>)}</ul>
        </section>

        <section aria-labelledby="following-h">
          <h2 id="following-h" className="mb-3 text-base font-semibold">Traders you follow</h2>
          {follows.isLoading && <Spinner />}
          {follows.data?.length === 0 && (
            <Card><EmptyState icon={<Users className="size-8" aria-hidden />} title="You are not following anyone"
              action={<Link to="/copy" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Find a trader</Link>}>
              Pick a trader with a record you trust, set how big their trades should be for you, and their new trades arrive here.
            </EmptyState></Card>
          )}
          <ul className="grid gap-3 lg:grid-cols-2">{follows.data?.map((f) => <li key={f.id} className="min-w-0"><FollowCard follow={f} /></li>)}</ul>
        </section>

        {past.length > 0 && (
          <section aria-labelledby="history-h">
            <h2 id="history-h" className="mb-3 text-base font-semibold">Earlier tickets</h2>
            <ul className="grid gap-3 lg:grid-cols-2">{past.map((t) => <li key={t.id} className="min-w-0"><TicketCard ticket={t} compact /></li>)}</ul>
          </section>
        )}
        <RiskNote>Tickets arrive after the trader has traded, so your price will be different and may be worse. TMS does not place trades for you and cannot guarantee a ticket arrives in time. This is not financial advice.</RiskNote>
      </div>
    </>
  );
}

function FollowCard({ follow: f }: { follow: Follow }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FollowSettings>(f);
  const refresh = () => {
    for (const key of ["copy-follows", "copy-leaders", "copy-tickets", "copy-pending", "copy-leader"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const patch = useMutation({ mutationFn: (body: Partial<FollowSettings> & { status?: "active" | "paused" }) => api<Follow>(`/copy/follows/${f.id}`, { method: "PATCH", body }), onSuccess: () => { refresh(); setEditing(false); } });
  const stop = useMutation({ mutationFn: () => api(`/copy/follows/${f.id}`, { method: "DELETE" }), onSuccess: refresh });
  const error = [patch.error, stop.error].find((e): e is ApiError => e instanceof ApiError);
  const paused = f.status === "paused";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold"><Link to={`/copy/leaders/${f.leader_id}`} className="hover:underline">{f.leader_name}</Link></h3>
          <p className="text-xs text-ink-2">Sized for {f.account_label} · since {dateTime(f.started_at)}</p>
        </div>
        <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-xs font-medium", paused || f.blocked ? "bg-surface-2 text-ink-2" : "bg-accent/10 text-accent")}>
          {paused ? "Paused" : f.blocked ? "Not receiving" : "Active"}
        </span>
      </div>
      <p className="mt-3 text-sm">{sizingSummary(f)}</p>
      <p className="mt-1 text-xs text-ink-2">Up to {f.max_open_copies} open at once · stop after a {f.daily_loss_stop_pct}% daily loss · email {f.notify_email ? "on" : "off"}</p>
      {f.blocked && <div className="mt-3"><Notice tone="warning">{f.blocked}</Notice></div>}
      {!f.blocked && f.feed_delayed && !paused && <div className="mt-3"><FeedDelayNote /></div>}
      {error && <div className="mt-3"><ErrorNote>{error.message}</ErrorNote></div>}

      {editing && (
        <form className="mt-4 space-y-4 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); patch.mutate(draft); }}>
          <FollowSettingsFields value={draft} onChange={setDraft} leaderId={f.leader_id} accountId={f.account_id} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={patch.isPending} disabled={!settingsValid(draft)}>Save settings</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(f); }}>Cancel</Button>
          </div>
        </form>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
        {!editing && <Button size="sm" variant="secondary" onClick={() => { setDraft(f); setEditing(true); }}>Edit settings</Button>}
        <Button size="sm" variant="secondary" loading={patch.isPending && !editing} onClick={() => patch.mutate({ status: paused ? "active" : "paused" })}>
          {paused ? <><Play className="size-4" aria-hidden />Resume</> : <><Pause className="size-4" aria-hidden />Pause</>}
        </Button>
        <Button size="sm" variant="danger" loading={stop.isPending} onClick={() => { if (window.confirm(`Stop following ${f.leader_name}? Tickets you have not answered are cleared. You will still hear when a trade you took is closed.`)) stop.mutate(); }}>Stop following</Button>
      </div>
    </Card>
  );
}
