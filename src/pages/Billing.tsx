import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { dateTime } from "../lib/format";
import { useConfig, usePlans } from "../lib/queries";
import type { Plan } from "../lib/types";
import { Button, Card, cx, ErrorNote, Notice, PageHeader, Spinner } from "../components/ui";

export default function Billing() {
  const { user, reload } = useAuth();
  const { data: plans } = usePlans();
  const { data: config } = useConfig();
  const [params, setParams] = useSearchParams();
  const sub = user!.subscription;
  const [message, setMessage] = useState<string | null>(null);
  const returning = params.get("checkout") === "success";

  // Returning from Stripe: the webhook may land a moment after the redirect, so poll briefly.
  const [waiting, setWaiting] = useState(returning && !sub.entitled);
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = setInterval(async () => {
      const me = await reload();
      if (me?.subscription.entitled || ++tries >= 12) {
        clearInterval(t);
        setWaiting(false);
        if (me?.subscription.entitled) { setMessage("Your subscription is active. Welcome aboard."); setParams({}, { replace: true }); }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [waiting, reload, setParams]);

  const subscribe = useMutation({
    mutationFn: (plan: string) => api<{ activated: boolean; checkout_url: string | null }>("/billing/checkout", { method: "POST", body: { plan } }),
    onSuccess: async (res) => {
      if (res.checkout_url) { window.location.assign(res.checkout_url); return; }
      await reload();
      setMessage("Your plan is updated.");
    },
  });
  const portal = useMutation({ mutationFn: () => api<{ url: string }>("/billing/portal", { method: "POST" }), onSuccess: (r) => window.location.assign(r.url) });
  const cancel = useMutation({ mutationFn: (path: "cancel" | "resume") => api(`/billing/${path}`, { method: "POST" }), onSuccess: async (_, path) => { await reload(); setMessage(path === "cancel" ? "Cancelled. You keep access until the end of the paid period." : "Subscription resumed."); } });
  const error = [subscribe.error, portal.error, cancel.error].find((e): e is ApiError => e instanceof ApiError);

  return (
    <>
      <PageHeader title="Plans & billing" subtitle="Performance analytics are free. Market bias and chat come with a plan." />
      {config?.billing_provider === "dev" && <div className="mb-4"><Notice tone="warning"><strong>Test billing.</strong> Subscribing activates instantly with no payment. Set <code>BILLING_PROVIDER=stripe</code> on the server for real checkout.</Notice></div>}
      {waiting && <div className="mb-4"><Notice><Spinner label="Confirming your payment" /></Notice></div>}
      {message && <div className="mb-4"><Notice>{message}</Notice></div>}
      {error && <div className="mb-4"><ErrorNote>{error.message}</ErrorNote></div>}

      <Card className="mb-6 p-5">
        <h2 className="text-base font-semibold">Your subscription</h2>
        {sub.entitled ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p><strong className="capitalize">{sub.plan}</strong> plan · <span className="capitalize">{sub.status}</span></p>
              {sub.current_period_end && <p className="mt-0.5 text-ink-2">{sub.cancel_at_period_end ? "Access ends" : "Renews"} {dateTime(sub.current_period_end)}</p>}
              {sub.cancel_at_period_end && <p className="mt-0.5 text-ink-2">It will not renew. You can resume any time before then.</p>}
            </div>
            <div className="flex gap-2">
              {config?.billing_provider === "stripe" && <Button variant="secondary" size="sm" loading={portal.isPending} onClick={() => portal.mutate()}>Manage billing</Button>}
              {sub.cancel_at_period_end
                ? <Button variant="secondary" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate("resume")}>Resume</Button>
                : <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => { if (window.confirm("Cancel at the end of your paid period?")) cancel.mutate("cancel"); }}>Cancel plan</Button>}
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-2">{sub.status === "none" ? "You are on the free account." : `Your last subscription is ${sub.status}.`} Choose a plan to unlock market bias and the trader chat.</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {plans?.map((p) => <PlanCard key={p.id} plan={p} current={sub.entitled && sub.plan === p.id} entitled={sub.entitled} busy={subscribe.isPending && subscribe.variables === p.id} onChoose={() => subscribe.mutate(p.id)} />)}
      </div>
      <p className="mt-6 text-xs text-ink-2">Prices are in USD per month. Market bias is educational technical analysis, not financial advice.</p>
    </>
  );
}

function PlanCard({ plan, current, entitled, busy, onChoose }: { plan: Plan; current: boolean; entitled: boolean; busy: boolean; onChoose(): void }) {
  return (
    <Card className={cx("p-6", current && "border-accent")}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {current && <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Current plan</span>}
      </div>
      <p className="mt-1"><span className="text-3xl font-semibold">${plan.price_usd_monthly}</span><span className="text-sm text-ink-2"> / month</span></p>
      <ul className="mt-4 space-y-2 text-sm">
        {plan.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{f}</li>)}
      </ul>
      <Button className="mt-6 w-full" variant={current ? "secondary" : "primary"} disabled={current} loading={busy} onClick={onChoose}>
        {current ? "You are on this plan" : entitled ? `Switch to ${plan.name}` : `Subscribe to ${plan.name}`}
      </Button>
    </Card>
  );
}
