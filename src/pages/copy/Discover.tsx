import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { movePct, recordWarnings } from "../../lib/copy";
import { duration, percent, ratio } from "../../lib/format";
import { useLeaders } from "../../lib/queries";
import type { LeaderCard } from "../../lib/types";
import { Card, cx, EmptyState, ErrorNote, PageHeader, Segmented, Spinner } from "../../components/ui";
import { CopyTabs, RiskNote } from "../../components/copy";

type Sort = "followers" | "return" | "drawdown" | "win";
const SORTS: { value: Sort; label: string }[] = [
  { value: "followers", label: "Most followed" }, { value: "return", label: "Highest return" },
  { value: "drawdown", label: "Smallest drawdown" }, { value: "win", label: "Win rate" },
];
const ORDER: Record<Sort, (a: LeaderCard, b: LeaderCard) => number> = {
  followers: (a, b) => b.followers - a.followers || (b.stats.return_pct ?? -1e9) - (a.stats.return_pct ?? -1e9),
  return: (a, b) => (b.stats.return_pct ?? -1e9) - (a.stats.return_pct ?? -1e9),
  drawdown: (a, b) => a.stats.max_drawdown_pct - b.stats.max_drawdown_pct,
  win: (a, b) => b.stats.win_rate - a.stats.win_rate,
};

export default function Discover() {
  const leaders = useLeaders();
  const [sort, setSort] = useState<Sort>("followers");
  const rows = useMemo(() => [...(leaders.data ?? [])].sort(ORDER[sort]), [leaders.data, sort]);

  return (
    <>
      <PageHeader title="Copy trading" subtitle="Follow traders with a record taken straight from their broker. Their new trades reach you as tickets, sized for your account." />
      <CopyTabs />
      <Card className="mb-6 p-4">
        <ol className="grid gap-4 text-sm sm:grid-cols-3">
          {[
            ["1. Pick a trader", "Every record is read from the trader's own MT5 account with a read-only login. Nobody can edit it."],
            ["2. We size each trade", "When they open a trade, you get a ticket with the lot size for your balance and your limits."],
            ["3. You place the order", "TMS never trades for you. You place it in MT5 yourself, so you decide every time."],
          ].map(([title, text]) => (
            <li key={title}><h2 className="font-semibold">{title}</h2><p className="mt-1 text-ink-2">{text}</p></li>
          ))}
        </ol>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Traders sharing their trades</h2>
        <Segmented label="Sort traders" value={sort} onChange={(v) => setSort(v)} options={SORTS} />
      </div>

      {leaders.isLoading && <Spinner label="Loading traders" />}
      {leaders.isError && <ErrorNote>Could not load traders. Please try again.</ErrorNote>}
      {leaders.data?.length === 0 && (
        <Card>
          <EmptyState icon={<Users className="size-8" aria-hidden />} title="No one is sharing trades yet"
            action={<Link to="/copy/share" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Share your trades</Link>}>
            Traders appear here once they connect an account with at least 20 closed trades and choose to share.
          </EmptyState>
        </Card>
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((l) => <li key={l.id} className="min-w-0"><LeaderTile leader={l} /></li>)}
      </ul>
      <div className="mt-8"><RiskNote>Past results do not predict future ones, and a short or thin record says little. Copying can lose money. This is not financial advice.</RiskNote></div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className={cx("text-base font-semibold", tone === "pos" && "text-pos-text", tone === "neg" && "text-neg-text")} style={{ fontVariantNumeric: "tabular-nums" }}>{value}</dd>
    </div>
  );
}

function LeaderTile({ leader: l }: { leader: LeaderCard }) {
  const s = l.stats;
  const warnings = recordWarnings(s);
  return (
    <Link to={`/copy/leaders/${l.id}`} className="block h-full rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)] hover:border-accent/60" aria-label={`${l.display_name}, ${l.followers} followers. Open profile.`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-semibold">{l.display_name}</h3>
        <span className="flex shrink-0 gap-1.5 text-xs font-medium">
          {l.is_me && <span className="rounded-md bg-surface-2 px-1.5 py-0.5">You</span>}
          {l.following && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-accent">Following</span>}
        </span>
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2"><Users className="size-3.5" aria-hidden />{l.followers} follower{l.followers === 1 ? "" : "s"}</p>
      {l.bio && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{l.bio}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <Metric label="Return" value={s.return_pct === null ? "—" : movePct(s.return_pct)} tone={s.return_pct === null ? undefined : s.return_pct >= 0 ? "pos" : "neg"} />
        <Metric label="Win rate" value={percent(s.win_rate, 0)} />
        <Metric label="Profit factor" value={ratio(s.profit_factor)} />
        <Metric label="Max drawdown" value={percent(s.max_drawdown_pct, 0)} />
      </dl>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-2"><ShieldCheck className="size-3.5 text-accent" aria-hidden />{s.trades} trades over {s.track_days} days · holds about {duration(s.avg_hold_seconds)}</p>
      {s.top_symbols.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1.5">{s.top_symbols.map((t) => <span key={t.symbol} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs">{t.symbol}</span>)}</p>
      )}
      {warnings.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium"><TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />{warnings[0]}{warnings.length > 1 && ` (+${warnings.length - 1} more)`}</p>
      )}
    </Link>
  );
}
