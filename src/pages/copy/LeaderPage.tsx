import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleX, TriangleAlert, Users } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { DEFAULT_SETTINGS, movePct, recordWarnings } from "../../lib/copy";
import { dateTime, duration, percent, ratio, shortDate } from "../../lib/format";
import { useAccounts, useFollows, useLeader } from "../../lib/queries";
import type { Follow, LeaderDetail } from "../../lib/types";
import { Button, Card, EmptyState, ErrorNote, Field, Notice, PageHeader, Select, SideBadge, Spinner, StatTile } from "../../components/ui";
import { ChartCard } from "../../components/charts/ChartCard";
import { LineAreaChart } from "../../components/charts/LineAreaChart";
import { FollowSettingsFields, RiskNote, settingsValid } from "../../components/copy";

export default function LeaderPage() {
  const id = Number(useParams().id);
  const { data, isLoading, error } = useLeader(id);
  if (isLoading) return <Spinner label="Loading trader" />;
  if (error || !data) {
    return (
      <Card><EmptyState title="Trader not found" action={<Link to="/copy" className="text-accent underline">Back to all traders</Link>}>
        They may have stopped sharing their trades.
      </EmptyState></Card>
    );
  }
  return <Profile leader={data} />;
}

function Profile({ leader: l }: { leader: LeaderDetail }) {
  const s = l.stats;
  const warnings = recordWarnings(s);
  const points = l.curve.map((p) => ({ x: new Date(p.time).getTime(), y: p.pct }));
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  return (
    <>
      <Link to="/copy" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />All traders</Link>
      <PageHeader
        title={l.display_name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{l.followers} follower{l.followers === 1 ? "" : "s"}</span>{l.bio && <span>{l.bio}</span>}</span>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {warnings.length > 0 && (
            <Notice tone="warning">
              <ul className="space-y-1">{warnings.map((w) => <li key={w} className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{w}</li>)}</ul>
            </Notice>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Return" value={s.return_pct === null ? "—" : signed(s.return_pct)} tone={s.return_pct === null ? undefined : s.return_pct >= 0 ? "pos" : "neg"} hint="On the starting balance" />
            <StatTile label="Win rate" value={percent(s.win_rate)} hint={`${s.trades} closed trades`} />
            <StatTile label="Profit factor" value={ratio(s.profit_factor)} hint="Gross profit ÷ gross loss" />
            <StatTile label="Max drawdown" value={percent(s.max_drawdown_pct)} hint="Biggest fall from a peak" />
            <StatTile label="Trades per week" value={String(s.trades_per_week)} hint={`Over ${s.track_days} days`} />
            <StatTile label="Typical hold" value={duration(s.avg_hold_seconds)} hint={s.top_symbols.map((t) => t.symbol).join(", ") || undefined} />
          </div>

          <ChartCard
            title="Growth"
            subtitle="Cumulative result as a percentage of the starting balance, after each closed trade"
            table={{ columns: ["Closed (UTC)", "Growth"], rows: [...l.curve].reverse().map((p) => [p.time.slice(0, 16).replace("T", " "), signed(p.pct)]) }}
            chart={<LineAreaChart data={points} seriesLabel="Growth" ariaLabel={`Growth of ${l.display_name}'s account`} formatY={signed} formatX={(ms) => shortDate(new Date(ms).toISOString())} reference={{ value: 0, label: "Start" }} />}
            footnote="Simple return. Deposits and withdrawals are not adjusted for, so a large late deposit would flatter this."
          />

          <Card>
            <h2 className="border-b border-line px-4 py-3 text-base font-semibold">Latest closed trades</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">The trader's most recent closed trades</caption>
                <thead className="text-xs text-ink-2"><tr>{["Symbol", "Side", "Closed (UTC)", "Held", "Price move", "Result"].map((c, i) => <th key={c} scope="col" className={`px-4 py-2 font-medium ${i >= 3 ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
                <tbody>
                  {l.recent_trades.map((t, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-4 py-2 font-medium">{t.symbol}</td>
                      <td className="px-4 py-2"><SideBadge side={t.side} /></td>
                      <td className="px-4 py-2 text-ink-2">{dateTime(t.closed)}</td>
                      <td className="px-4 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{duration(t.hold_seconds)}</td>
                      <td className={`px-4 py-2 text-right ${t.move_pct > 0 ? "text-pos-text" : t.move_pct < 0 ? "text-neg-text" : ""}`} style={{ fontVariantNumeric: "tabular-nums" }}>{movePct(t.move_pct)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center gap-1">{t.result === "win" ? <CheckCircle2 className="size-4 text-pos" aria-hidden /> : t.result === "loss" ? <CircleX className="size-4 text-neg" aria-hidden /> : null}{t.result === "win" ? "Win" : t.result === "loss" ? "Loss" : "Flat"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-3 text-xs text-ink-2">Lot sizes and money amounts are private. The trader's open trades are shown only to followers.</p>
          </Card>
          <RiskNote>{l.risk_text}</RiskNote>
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start"><FollowPanel leader={l} /></div>
      </div>
    </>
  );
}

function FollowPanel({ leader }: { leader: LeaderDetail }) {
  const { user } = useAuth();
  const accounts = useAccounts();
  const follows = useFollows();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usable = (accounts.data ?? []).filter((a) => a.status === "connected" && a.balance !== null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [understood, setUnderstood] = useState(false);
  const chosen = accountId ?? usable[0]?.id ?? null;
  const sub = user!.subscription;
  const used = follows.data?.length ?? 0;

  const create = useMutation({
    mutationFn: () => api<Follow>("/copy/follows", { method: "POST", body: { leader_id: leader.id, account_id: chosen, ...settings, acknowledge_risk: understood } }),
    onSuccess: async () => {
      for (const key of ["copy-follows", "copy-leaders", "copy-leader"]) await queryClient.invalidateQueries({ queryKey: [key] });
      navigate("/copy/following");
    },
  });

  if (leader.is_me) return <Card className="p-5 text-sm text-ink-2">This is how your profile looks to others. You cannot follow yourself.</Card>;
  if (leader.following) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">You follow {leader.display_name}</h2>
        <p className="mt-1 text-sm text-ink-2">New trades arrive as tickets. Change your sizing or stop following from your list.</p>
        <Link to="/copy/following" className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Open my copying</Link>
      </Card>
    );
  }
  if (!sub.entitled) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">Copying is part of a plan</h2>
        <p className="mt-1 text-sm text-ink-2">Browsing traders and their records is free. To receive their trades as tickets sized for your account, choose a plan.</p>
        <Link to="/billing" className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">See plans</Link>
      </Card>
    );
  }
  if (usable.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">Connect an account first</h2>
        <p className="mt-1 text-sm text-ink-2">Trades are sized to your account balance, so TMS needs a connected MT5 account.</p>
        <Link to="/accounts" className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Connect MT5</Link>
      </Card>
    );
  }
  if (used >= sub.max_leaders) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">You are following {used} of {sub.max_leaders}</h2>
        <p className="mt-1 text-sm text-ink-2">Your <span className="capitalize">{sub.plan}</span> plan covers {sub.max_leaders} trader{sub.max_leaders === 1 ? "" : "s"}. Stop following one, or move to a bigger plan.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/copy/following" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-surface-2">Manage</Link>
          <Link to="/billing" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">See plans</Link>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Follow {leader.display_name}</h2>
      <p className="mt-1 text-sm text-ink-2">Only trades opened after you follow are offered. Nothing already open is copied.</p>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        {usable.length > 1 && (
          <Field label="Size trades for">
            <Select className="w-full" value={chosen ?? ""} onChange={(e) => setAccountId(Number(e.target.value))}>
              {usable.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
        )}
        <FollowSettingsFields value={settings} onChange={setSettings} leaderId={leader.id} accountId={chosen} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand I can lose money copying this trader, and that I place every order myself.</span>
        </label>
        {create.error instanceof ApiError && <ErrorNote>{create.error.message}</ErrorNote>}
        <Button type="submit" className="w-full" loading={create.isPending} disabled={!understood || !settingsValid(settings) || chosen === null}>Start following</Button>
      </form>
    </Card>
  );
}
