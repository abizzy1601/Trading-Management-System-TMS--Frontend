import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Share2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { movePct } from "../../lib/copy";
import { percent } from "../../lib/format";
import { useMyLeader } from "../../lib/queries";
import type { MyLeader } from "../../lib/types";
import { Button, Card, EmptyState, ErrorNote, Field, Input, Notice, PageHeader, Select, Spinner } from "../../components/ui";
import { CopyTabs, RiskNote } from "../../components/copy";

export default function Share() {
  const me = useMyLeader();
  return (
    <>
      <PageHeader title="Copy trading" subtitle="Let other traders follow your trades. Your results are read from your broker, so they cannot be edited." />
      <CopyTabs />
      {me.isLoading && <Spinner />}
      {me.isError && <ErrorNote>Could not load your sharing settings. Please try again.</ErrorNote>}
      {me.data && <Body data={me.data} />}
    </>
  );
}

function Body({ data }: { data: MyLeader }) {
  const queryClient = useQueryClient();
  const live = data.leader;
  const eligible = data.accounts.filter((a) => a.eligible);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [name, setName] = useState(live?.display_name ?? "");
  const [bio, setBio] = useState(live?.bio ?? "");
  const [agreed, setAgreed] = useState(false);
  useEffect(() => { setName(live?.display_name ?? ""); setBio(live?.bio ?? ""); }, [live?.display_name, live?.bio]);
  // Default to the account already being shared, so saving a new bio never quietly switches accounts.
  const chosen = accountId ?? data.account_id ?? eligible[0]?.id ?? null;

  const refresh = async () => { for (const key of ["copy-me", "copy-leaders", "copy-leader"]) await queryClient.invalidateQueries({ queryKey: [key] }); };
  const save = useMutation({ mutationFn: () => api<MyLeader>("/copy/me/leader", { method: "PUT", body: { account_id: chosen, display_name: name, bio } }), onSuccess: refresh });
  const stop = useMutation({ mutationFn: () => api("/copy/me/leader", { method: "DELETE" }), onSuccess: async () => { setAgreed(false); await refresh(); } });
  const error = [save.error, stop.error].find((e): e is ApiError => e instanceof ApiError);

  if (data.accounts.length === 0) {
    return (
      <Card><EmptyState icon={<Share2 className="size-8" aria-hidden />} title="Connect an MT5 account first"
        action={<Link to="/accounts" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">Connect MT5</Link>}>
        The account you share is where your record and your new trades come from. Use the read-only investor password, so no one can trade it.
      </EmptyState></Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="min-w-0 p-5">
        <h2 className="text-base font-semibold">{live ? "You are sharing your trades" : "Share your trades"}</h2>
        {live && (
          <p className="mt-1 text-sm text-ink-2">
            {live.followers} follower{live.followers === 1 ? "" : "s"} ·{" "}
            <Link to={`/copy/leaders/${live.id}`} className="text-accent underline">See your public profile</Link>
          </p>
        )}
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Account to share" hint={eligible.length === 0 ? "None of your accounts has enough closed trades yet." : undefined}>
            <Select className="w-full" value={chosen ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} disabled={eligible.length === 0}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.eligible}>
                  {a.label} · {a.trades} closed trades{!a.connected ? " · not connected" : a.eligible ? "" : ` · needs ${data.min_trades}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Display name" hint="Followers see this, never your real name or email. 3 to 30 letters, numbers, spaces, dots, dashes.">
            <Input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={30} required placeholder="e.g. Lagos Swing Desk" />
          </Field>
          <Field label="About your trading (optional)" hint="Your style, the pairs you trade, how you manage risk.">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-2" />
          </Field>
          {!live && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I understand followers will see my track record and receive my new trades, and that I am not giving financial advice.</span>
            </label>
          )}
          {error && <ErrorNote>{error.message}</ErrorNote>}
          {save.isSuccess && <p className="text-sm text-ink-2" role="status">Saved.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={save.isPending} disabled={chosen === null || name.trim().length < 3 || (!live && !agreed)}>{live ? "Save changes" : "Start sharing"}</Button>
            {live && <Button type="button" variant="danger" loading={stop.isPending} onClick={() => { if (window.confirm("Stop sharing? Your followers are told to manage any trades they copied themselves, and your profile disappears.")) stop.mutate(); }}>Stop sharing</Button>}
          </div>
        </form>
        {live && <div className="mt-4"><Notice>To change which account you share, pick it above and save. Followers with open copies are told to manage those trades themselves.</Notice></div>}
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Eye className="size-4" aria-hidden />What followers see</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Your display name and description</li>
            <li>Return, win rate, profit factor, drawdown, how often and how long you trade</li>
            <li>A growth line in percent, and your latest closed trades</li>
            <li>Your new trades as they open, with entry, stop loss and take profit (followers only)</li>
          </ul>
          <h2 className="mt-4 flex items-center gap-2 text-base font-semibold"><EyeOff className="size-4" aria-hidden />What stays private</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Your name, email, MT5 login and broker server</li>
            <li>Your balance, lot sizes and money amounts</li>
            <li>Who your followers are</li>
          </ul>
          {live && <p className="mt-4 text-xs text-ink-2">Your record today: {live.stats.return_pct === null ? "no return yet" : movePct(live.stats.return_pct)} return, {percent(live.stats.win_rate, 0)} win rate over {live.stats.trades} trades.</p>}
        </Card>
        <RiskNote>{data.risk_text}</RiskNote>
        <p className="text-xs text-ink-2">Sharing trades for others to copy can count as investment advice or portfolio management in some countries. Check the rules where you live before you take part.</p>
      </div>
    </div>
  );
}
