import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleX, Copy, PencilLine, TriangleAlert } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { answerLabel, lotsText, movePct, NEEDS_LABEL } from "../lib/copy";
import { price, timeAgo } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { usePendingTickets, useSizingPreview } from "../lib/queries";
import type { FollowSettings, Ticket } from "../lib/types";
import { Button, Card, cx, ErrorNote, Field, Input, Notice, Segmented, SideBadge } from "./ui";

// ------------------------------------------------------------------ navigation between the copy-trading pages
export function CopyTabs() {
  const { data: pending = 0 } = usePendingTickets();
  const tabs = [
    { to: "/copy", label: "Discover traders", end: true },
    { to: "/copy/following", label: "My copying", badge: pending },
    { to: "/copy/share", label: "Share my trades" },
  ];
  return (
    <nav aria-label="Copy trading" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cx("-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium", isActive ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink")
          }
        >
          {t.label}
          {!!t.badge && t.badge > 0 && (
            <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold text-on-accent" aria-label={`${t.badge} waiting for you`}>{t.badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function RiskNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

// ------------------------------------------------------------------ how a follower sizes and limits copies
function NumberField({ label, hint, value, onChange, min, max, step }: { label: string; hint?: ReactNode; value: number; onChange(v: number): void; min: number; max: number; step: number }) {
  const bad = !Number.isFinite(value) || value < min || value > max;
  return (
    <Field label={label} hint={bad ? <span className="text-neg-text">Enter a number from {min} to {max}.</span> : hint}>
      <Input
        type="number" inputMode="decimal" min={min} max={max} step={step} aria-invalid={bad}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      />
    </Field>
  );
}

export function settingsValid(s: FollowSettings): boolean {
  const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  const valueOk = s.size_mode === "proportional" ? inRange(s.size_value, 0.1, 5) : inRange(s.size_value, 0.01, 100);
  return valueOk && inRange(s.max_lots, 0.01, 100) && inRange(s.max_open_copies, 1, 20) && inRange(s.daily_loss_stop_pct, 0.5, 20);
}

export function FollowSettingsFields({ value, onChange, leaderId, accountId }: { value: FollowSettings; onChange(v: FollowSettings): void; leaderId?: number; accountId: number | null }) {
  const set = <K extends keyof FollowSettings>(k: K, v: FollowSettings[K]) => onChange({ ...value, [k]: v });
  const proportional = value.size_mode === "proportional";
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium">How big should copied trades be?</span>
        <Segmented
          label="Sizing"
          value={value.size_mode}
          onChange={(m) => onChange({ ...value, size_mode: m, size_value: m === "fixed" ? 0.1 : 1 })}
          options={[{ value: "proportional", label: "Match my balance" }, { value: "fixed", label: "Fixed lots" }]}
        />
      </div>
      {proportional ? (
        <NumberField label="Risk multiplier" min={0.1} max={5} step={0.1} value={value.size_value} onChange={(v) => set("size_value", v)}
          hint="1 takes the same share of your balance the trader takes of theirs. 0.5 takes half as much." />
      ) : (
        <NumberField label="Lots per trade" min={0.01} max={100} step={0.01} value={value.size_value} onChange={(v) => set("size_value", v)}
          hint="Every copied trade uses this size, whatever the trader does." />
      )}
      <NumberField label="Largest trade (lots)" min={0.01} max={100} step={0.01} value={value.max_lots} onChange={(v) => set("max_lots", v)}
        hint="A hard ceiling. A trade that would be bigger is cut down to this." />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Open copies at once" min={1} max={20} step={1} value={value.max_open_copies} onChange={(v) => set("max_open_copies", v)}
          hint="Past this, new trades are skipped." />
        <NumberField label="Daily loss stop (%)" min={0.5} max={20} step={0.5} value={value.daily_loss_stop_pct} onChange={(v) => set("daily_loss_stop_pct", v)}
          hint="No new copies after you lose this much in a day." />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={value.notify_email} onChange={(e) => set("notify_email", e.target.checked)} />
        <span>Email me when this trader opens a trade<span className="block text-xs text-ink-2">Only if email is set up on the server.</span></span>
      </label>
      {leaderId !== undefined && <SizingPreviewLine leaderId={leaderId} accountId={accountId} settings={value} />}
    </div>
  );
}

function SizingPreviewLine({ leaderId, accountId, settings }: { leaderId: number; accountId: number | null; settings: FollowSettings }) {
  const debounced = useDebounced(settings, 400);
  const { data } = useSizingPreview(leaderId, accountId, debounced);
  if (!data) return null;
  if (data.problem) return <ErrorNote>{data.problem}</ErrorNote>;
  if (data.typical_lots === null) {
    return <Notice tone="warning">At these settings every one of this trader's recent trades would be too small to copy. Raise the multiplier or use fixed lots.</Notice>;
  }
  return (
    <div className="rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
      <p>
        <strong>Typical trade for you: {lotsText(data.typical_lots)}</strong>, largest {lotsText(data.largest_lots ?? data.typical_lots)}.
      </p>
      <p className="mt-0.5 text-xs text-ink-2">
        Based on this trader's last {data.sample} trades at these settings.
        {!!data.skipped_pct && data.skipped_pct > 0 && ` About ${data.skipped_pct}% would be skipped as too small to place.`}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ a ticket
const NEEDS_ICON = { copy: Copy, update: PencilLine, close: CircleX } as const;

export function TicketCard({ ticket: t, compact = false }: { ticket: Ticket; compact?: boolean }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of ["copy-tickets", "copy-pending", "copy-follows"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
  const respond = useMutation({ mutationFn: (response: "taken" | "declined") => api(`/copy/tickets/${t.id}/respond`, { method: "POST", body: { response } }), onSuccess: refresh });
  const ack = useMutation({ mutationFn: () => api(`/copy/tickets/${t.id}/ack`, { method: "POST" }), onSuccess: refresh });
  const error = [respond.error, ack.error].find((e): e is ApiError => e instanceof ApiError);
  const Icon = t.needs ? NEEDS_ICON[t.needs] : null;
  const symbolDiffers = t.symbol !== t.display_symbol;

  return (
    <article className={cx("rounded-xl border bg-surface p-4", t.needs ? "border-accent/60" : "border-line")} aria-label={`${t.side} ${t.display_symbol} from ${t.leader_name}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        {t.needs && Icon && (
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-ink">
            <Icon className="size-4 text-accent" aria-hidden />{NEEDS_LABEL[t.needs]}
          </span>
        )}
        <span>{t.leader_name}</span>
        <span className="ml-auto">{timeAgo(t.created_at)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SideBadge side={t.side} />
        <span className="text-xl font-semibold tracking-tight">{t.display_symbol}</span>
        {t.volume !== null && <span className="text-xl font-semibold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{lotsText(t.volume)}</span>}
      </div>
      {symbolDiffers && <p className="mt-1 text-xs text-ink-2">The trader's broker calls this {t.symbol}. Use your own broker's name for it.</p>}

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        {([["Trader's entry", price(t.entry_price)], ["Stop loss", t.stop_loss !== null ? price(t.stop_loss) : "None set"], ["Take profit", t.take_profit !== null ? price(t.take_profit) : "None set"]] as const).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-ink-2">{k}</dt>
            <dd className="truncate font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd>
          </div>
        ))}
      </dl>
      {t.stop_loss === null && t.state === "open" && <p className="mt-2 text-xs text-ink-2">The trader set no stop loss. Decide your own before you place this.</p>}

      {t.change_note && t.state !== "skipped" && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"><strong>{t.state === "leader_closed" ? "Note: " : "Changed: "}</strong>{t.change_note}</p>
      )}
      {t.state === "leader_closed" && (
        <p className="mt-2 text-sm text-ink-2">
          Closed {timeAgo(t.leader_closed_at)}.
          {t.result_pct !== null && <> Price moved <strong className={t.result_pct >= 0 ? "text-pos-text" : "text-neg-text"}>{movePct(t.result_pct)}</strong> in the trader's favour.</>}
        </p>
      )}
      {t.state === "skipped" && <p className="mt-3 text-sm text-ink-2"><strong className="text-ink">Not offered.</strong> {t.skip_reason}</p>}

      {!compact && t.needs === "copy" && (
        <p className="mt-3 text-xs text-ink-2">The trader opened this {timeAgo(t.leader_opened_at)}. Check the live price before you place it: yours will differ from {price(t.entry_price)}.</p>
      )}
      {!compact && error && <div className="mt-3"><ErrorNote>{error.message}</ErrorNote></div>}
      {!compact && t.needs === "copy" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" loading={respond.isPending && respond.variables === "taken"} onClick={() => respond.mutate("taken")}>{answerLabel("copy")}</Button>
          <Button size="sm" variant="secondary" loading={respond.isPending && respond.variables === "declined"} onClick={() => respond.mutate("declined")}>Skip it</Button>
        </div>
      )}
      {!compact && (t.needs === "update" || t.needs === "close") && (
        <div className="mt-3"><Button size="sm" loading={ack.isPending} onClick={() => ack.mutate()}>{answerLabel(t.needs)}</Button></div>
      )}
      {compact && !t.needs && t.state === "open" && <p className="mt-2 text-xs text-ink-2">{t.response === "taken" ? "You took this trade." : t.response === "declined" ? "You skipped this trade." : ""}</p>}
      {compact && t.state === "leader_closed" && t.response && <p className="mt-1 text-xs text-ink-2">{t.response === "taken" ? "You took this trade." : "You skipped this trade."}</p>}
    </article>
  );
}

// ------------------------------------------------------------------ small pieces used by several pages
export function FeedDelayNote() {
  return <Notice tone="warning">Updates from this trader are delayed, so tickets may be late or missing. Check their trades yourself before relying on it.</Notice>;
}

export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left text-sm font-semibold">
        {title}<span className="text-ink-2">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}
