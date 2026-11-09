import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { money, timeAgo } from "../lib/format";
import { useAccounts, useConfig } from "../lib/queries";
import type { Account } from "../lib/types";
import { Button, Card, EmptyState, ErrorNote, Field, Input, Notice, PageHeader, Spinner, StatusPill } from "../components/ui";

export default function Accounts() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: config } = useConfig();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();

  return (
    <>
      <PageHeader title="MT5 accounts" subtitle="Connect an account to see your trade history and performance." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {isLoading && <Spinner />}
          {accounts?.length === 0 && (
            <Card><EmptyState icon={<Plug className="size-8" aria-hidden />} title="No accounts connected yet">Add one with the form. It takes a minute and your history is imported automatically.</EmptyState></Card>
          )}
          {accounts?.map((a) => <AccountCard key={a.id} account={a} onChange={refresh} />)}
        </div>
        <ConnectForm demo={config?.mt5_provider === "demo"} onDone={refresh} />
      </div>
    </>
  );
}

function AccountCard({ account: a, onChange }: { account: Account; onChange(): void }) {
  const sync = useMutation({ mutationFn: () => api(`/accounts/${a.id}/sync`, { method: "POST" }), onSettled: onChange });
  const remove = useMutation({ mutationFn: () => api(`/accounts/${a.id}`, { method: "DELETE" }), onSuccess: onChange });
  const cur = a.currency;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{a.label}</h2>
            {a.provider === "demo" && <span className="rounded-md bg-warning/20 px-1.5 py-0.5 text-xs font-medium">Demo data</span>}
          </div>
          <p className="mt-0.5 text-sm text-ink-2">#{a.login} · {a.server}</p>
        </div>
        <StatusPill status={a.status} />
      </div>

      {a.status === "connected" && (
        <dl className="mt-4 grid grid-cols-3 gap-4">
          {[["Balance", a.balance !== null ? money(a.balance, cur) : "—"], ["Equity", a.equity !== null ? money(a.equity, cur) : "—"], ["Leverage", a.leverage ? `1:${a.leverage}` : "—"]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-ink-2">{k}</dt><dd className="mt-0.5 text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</dd></div>
          ))}
        </dl>
      )}
      {a.status === "pending" && <p className="mt-3 text-sm text-ink-2">Connecting to the broker. This usually takes one to two minutes{a.error_message ? ` (${a.error_message})` : ""}.</p>}
      {a.status === "error" && <div className="mt-3"><ErrorNote>{a.error_message ?? "We could not connect to this account."} Check the login, server name and investor password, then remove and re-add the account.</ErrorNote></div>}
      {a.status === "connected" && a.error_message && <p className="mt-3 text-sm text-ink-2">{a.error_message}</p>}
      {sync.error instanceof ApiError && <div className="mt-3"><ErrorNote>{sync.error.message}</ErrorNote></div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-ink-2">Last synced {timeAgo(a.last_synced_at)}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={sync.isPending} disabled={a.status === "pending"} onClick={() => sync.mutate()}><RefreshCw className="size-4" aria-hidden />Sync now</Button>
          <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => { if (window.confirm(`Remove ${a.label}? Its imported trade history will be deleted from TMS.`)) remove.mutate(); }}><Trash2 className="size-4" aria-hidden />Remove</Button>
        </div>
      </div>
    </Card>
  );
}

function ConnectForm({ demo, onDone }: { demo: boolean; onDone(): void }) {
  const [form, setForm] = useState({ label: "", login: "", password: "", server: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const connect = useMutation({
    mutationFn: () => api<Account>("/accounts", { method: "POST", body: { ...form, label: form.label.trim() || "My MT5 account" } }),
    onSuccess: () => { setForm({ label: "", login: "", password: "", server: "" }); onDone(); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); connect.mutate(); };
  return (
    <Card className="h-fit p-5">
      <h2 className="text-base font-semibold">Connect an account</h2>
      <div className="mt-3 flex gap-2.5 rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p><strong className="text-ink">Use your investor password.</strong> It is read-only, so nobody can place or change trades with it. It is encrypted before it is stored.</p>
      </div>
      {demo && <div className="mt-3"><Notice tone="warning">Demo mode: any login works and the data is simulated.</Notice></div>}
      <form onSubmit={submit} className="mt-4 space-y-3.5">
        <Field label="Nickname"><Input placeholder="e.g. Funded challenge" maxLength={80} value={form.label} onChange={set("label")} /></Field>
        <Field label="MT5 login"><Input inputMode="numeric" pattern="\d{3,12}" title="3 to 12 digits" required placeholder="Account number" value={form.login} onChange={set("login")} /></Field>
        <Field label="Investor password"><Input type="password" autoComplete="off" required value={form.password} onChange={set("password")} /></Field>
        <Field label="Broker server" hint="Copy it exactly from MT5: File → Login to Trade Account."><Input required placeholder="e.g. ICMarketsSC-Live07" value={form.server} onChange={set("server")} /></Field>
        {connect.error instanceof ApiError && <ErrorNote>{connect.error.message}</ErrorNote>}
        <Button type="submit" className="w-full" loading={connect.isPending}>Connect account</Button>
      </form>
    </Card>
  );
}
