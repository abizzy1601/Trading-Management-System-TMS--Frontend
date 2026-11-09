import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Info, Loader2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Bias, Severity } from "../lib/types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ------------------------------------------------------------------ buttons & inputs
type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50",
  danger: "border border-line bg-surface text-neg-text hover:bg-surface-2 disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

const FIELD =
  "rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(FIELD, "h-10 w-full", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(FIELD, "h-10 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-2">{hint}</span>}
    </label>
  );
}

// ------------------------------------------------------------------ surfaces
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-xl border border-line bg-surface shadow-[var(--shadow)]", className)}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-neg-text">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "warning" ? "border-warning/60 bg-warning/10 text-ink" : "border-line bg-surface-2 text-ink-2",
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

// ------------------------------------------------------------------ controls
export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange(v: T): void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1 text-sm transition-colors",
            o.value === value ? "bg-surface font-medium text-ink shadow-[var(--shadow)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ badges (icon + text, never colour alone)
const BIAS_STYLE: Record<Bias, { icon: typeof TrendingUp; text: string; cls: string }> = {
  bullish: { icon: TrendingUp, text: "Bullish", cls: "text-pos-text bg-pos/10" },
  bearish: { icon: TrendingDown, text: "Bearish", cls: "text-neg-text bg-neg/10" },
  neutral: { icon: Minus, text: "Neutral", cls: "text-ink-2 bg-surface-2" },
};
export function BiasBadge({ bias, size = "md" }: { bias: Bias; size?: "sm" | "md" }) {
  const s = BIAS_STYLE[bias];
  const Icon = s.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md font-medium", s.cls, size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm")}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {s.text}
    </span>
  );
}

export function SideBadge({ side }: { side: "buy" | "sell" }) {
  return (
    <span className={cx("inline-flex items-center gap-1 text-sm font-medium", side === "buy" ? "text-pos-text" : "text-neg-text")}>
      {side === "buy" ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
      {side === "buy" ? "Buy" : "Sell"}
    </span>
  );
}

const STATUS: Record<string, { icon: typeof Clock; text: string; color: string }> = {
  connected: { icon: CheckCircle2, text: "Connected", color: "text-good" },
  pending: { icon: Clock, text: "Connecting", color: "text-ink-2" },
  error: { icon: AlertTriangle, text: "Needs attention", color: "text-critical" },
};
export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending!;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
      <Icon className={cx("size-4", s.color)} aria-hidden />
      {s.text}
    </span>
  );
}

// ------------------------------------------------------------------ figures
export function StatTile({ label, value, hint, tone, children }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "pos" | "neg"; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tracking-tight", tone === "pos" && "text-pos-text", tone === "neg" && "text-neg-text")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-2">{hint}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** One whole split into parts: widths proportional, 2px surface gaps, fully rounded ends, no text on the bar. */
export function ThinSegmentedBar({ parts, label }: { parts: { name: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div role="img" aria-label={label} className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {total > 0 &&
          parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.name} title={`${p.name}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
          ))}
        {total === 0 && <div className="w-full bg-surface-2" />}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
        {parts.filter((p) => p.value > 0).map((p) => (
          <li key={p.name} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.name} {p.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

type MeterTone = "accent" | "warning" | "danger";
const METER_FILL: Record<MeterTone, string> = { accent: "var(--accent)", warning: "var(--warning)", danger: "var(--critical)" };

export function Meter({ value, max = 100, label, tone = "accent" }: { value: number; max?: number; label: string; tone?: MeterTone }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // The unfilled track is a lighter step of the same colour, so state reads across the whole bar.
  const track = tone === "accent" ? "var(--track)" : `color-mix(in srgb, ${METER_FILL[tone]} 22%, var(--surface))`;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: track }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: METER_FILL[tone] }} />
    </div>
  );
}

/** Usage against a limit. Colour escalates, and the state is also written out so it never relies on colour alone. */
export function LimitMeter({ label, used, limit, display, caption }: { label: string; used: number; limit: number; display: string; caption?: string }) {
  const ratio = limit > 0 ? used / limit : 0;
  const tone: MeterTone = ratio > 1 ? "danger" : ratio >= 0.7 ? "warning" : "accent";
  const state = ratio > 1 ? "Over limit" : ratio >= 1 ? "At limit" : ratio >= 0.7 ? "Close to limit" : "Within limit";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <div className="mt-2"><Meter value={used} max={limit} label={`${label}: ${display}`} tone={tone} /></div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs text-ink-2">
        <span className={cx(tone === "danger" && "font-semibold text-neg-text")}>{state}</span>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}

const SEVERITY: Record<Severity, { icon: typeof Info; text: string; cls: string }> = {
  critical: { icon: AlertOctagon, text: "Critical", cls: "text-critical" },
  warning: { icon: AlertTriangle, text: "Warning", cls: "text-warning" },
  info: { icon: Info, text: "Heads-up", cls: "text-ink-2" },
};
export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-ink">
      <Icon className={cx("size-4", s.cls)} aria-hidden />
      {s.text}
    </span>
  );
}
