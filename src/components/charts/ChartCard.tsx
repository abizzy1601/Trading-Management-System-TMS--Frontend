import { useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, cx } from "../ui";

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** The table twin: every chart can be read as plain data. */
  table: TableSpec;
  chart: ReactNode;
  actions?: ReactNode;
  /** Dim the previous render while refetching instead of flashing a skeleton. */
  refetching?: boolean;
  footnote?: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, table, chart, actions, refetching, footnote, className }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cx("min-w-0 p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div role="group" aria-label={`${title} view`} className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
            {([["chart", BarChart3, "Chart"], ["table", Table2, "Table"]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" aria-pressed={view === v} aria-label={`${label} view`} onClick={() => setView(v)} className={cx("rounded-md p-1.5", view === v ? "bg-surface text-ink shadow-[var(--shadow)]" : "text-ink-2 hover:text-ink")}>
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={cx(refetching && "refetching")}>
        {view === "chart" ? (
          chart
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-surface-2 text-xs text-ink-2">
                <tr>{table.columns.map((c, i) => <th key={c} scope="col" className={cx("px-3 py-2 font-medium", i > 0 && "text-right")}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-line">
                    {r.map((cell, ci) => <td key={ci} className={cx("px-3 py-1.5", ci > 0 && "text-right")} style={ci > 0 ? { fontVariantNumeric: "tabular-nums" } : undefined}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {footnote && <p className="mt-3 text-xs text-ink-2">{footnote}</p>}
    </Card>
  );
}
