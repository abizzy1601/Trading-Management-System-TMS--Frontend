import { price as fmtPrice } from "../lib/format";
import { riskRewardLayout, staggerMarkers } from "../lib/riskReward";

interface Props {
  direction: "long" | "short";
  stop: number;
  entry: number;
  targets: { price: number; rr: number }[];
}

/** The trade to scale: red is the money at risk, blue is the reward, with the entry and each target marked. */
export function RiskRewardBar({ direction, stop, entry, targets }: Props) {
  const layout = riskRewardLayout(direction, stop, entry, targets.map((t) => t.price));
  const last = layout.targets[layout.targets.length - 1] ?? 100;
  const markers = staggerMarkers([
    { x: layout.stop, label: "Stop", value: stop },
    { x: layout.entry, label: "Entry", value: entry },
    ...layout.targets.map((x, i) => ({ x, label: `TP${i + 1}`, value: targets[i]!.price })),
  ]);
  const crowded = markers.some((m) => m.row === 1);
  const summary = `Stop ${fmtPrice(stop)}, entry ${fmtPrice(entry)}, ${targets.map((t, i) => `target ${i + 1} ${fmtPrice(t.price)} at ${t.rr} times the risk`).join(", ")}`;

  return (
    <div role="img" aria-label={summary} className={`relative mx-4 h-2 ${crowded ? "mb-16 mt-12" : "mb-10 mt-8"}`}>
      {/* the track: risk to the left of the entry, reward to the right, a 2px gap between them */}
      <div className="absolute inset-y-0 rounded-l-full bg-neg" style={{ left: 0, width: `calc(${layout.entry}% - 1px)` }} />
      <div className="absolute inset-y-0 rounded-r-full bg-pos" style={{ left: `calc(${layout.entry}% + 1px)`, width: `calc(${last - layout.entry}% - 1px)` }} />
      {markers.map((m) => (
        <div key={m.label} className="absolute top-0" style={{ left: `${m.x}%` }}>
          <div className={`absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-ink-2 ${m.row ? "-top-11" : "-top-6"}`}>{m.label}</div>
          <div className={`absolute -translate-x-1/2 w-px bg-axis ${m.row ? "-top-9 h-9" : "-top-1.5 h-1.5"}`} aria-hidden />
          <div className="absolute -top-1.5 h-5 w-0.5 -translate-x-1/2 rounded bg-ink" aria-hidden />
          <div className={`absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-2 ${m.row ? "top-10" : "top-5"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtPrice(m.value)}</div>
        </div>
      ))}
    </div>
  );
}
