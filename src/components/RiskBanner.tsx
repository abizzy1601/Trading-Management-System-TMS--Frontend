import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useRiskAlerts } from "../lib/queries";
import { cx, SeverityBadge } from "./ui";

const FRESH_MS = 24 * 3600 * 1000;

/** Recent unread warnings, on every page, so an over-trading alert is not buried on the Risk page. */
export function RiskBanner() {
  const { data } = useRiskAlerts();
  const queryClient = useQueryClient();
  const dismiss = useMutation({
    mutationFn: (id: number) => api("/risk/alerts/read", { method: "POST", body: { ids: [id] } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["risk-alerts"] }),
  });
  const now = Date.now();
  const shown = (data?.items ?? [])
    .filter((a) => !a.read && a.severity !== "info" && now - new Date(a.created_at).getTime() < FRESH_MS)
    .slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <div className="mb-5 space-y-2" role="region" aria-label="Risk alerts">
      {shown.map((a) => (
        <div key={a.id} className={cx("flex items-start gap-3 rounded-xl border bg-surface p-4", a.severity === "critical" ? "border-critical/60" : "border-warning/60")}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
              <SeverityBadge severity={a.severity} />
              <span>{a.account_label}</span>
              <span>{timeAgo(a.created_at)}</span>
            </div>
            <p className="mt-1.5 text-sm"><strong className="font-semibold">{a.title}.</strong> {a.message}</p>
            <Link to="/risk" className="mt-1.5 inline-block text-sm font-medium text-accent hover:underline">Review your risk</Link>
          </div>
          <button type="button" onClick={() => dismiss.mutate(a.id)} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Dismiss alert: ${a.title}`}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
