import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getTheme, setTheme, type ThemeChoice } from "../lib/theme";
import type { User } from "../lib/types";
import { Button, Card, ErrorNote, Field, Input, Notice, PageHeader, Segmented } from "../components/ui";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user!.full_name);
  const [alerts, setAlerts] = useState(user!.email_alerts);
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme());
  const [saved, setSaved] = useState(false);
  const canEmail = user!.subscription.email_alerts;

  const profile = useMutation({
    mutationFn: () => api<User>("/auth/me", { method: "PATCH", body: { full_name: name, email_alerts: alerts } }),
    onSuccess: (u) => { setUser(u); setSaved(true); },
  });

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <form className="mt-4 space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); setSaved(false); profile.mutate(); }}>
            <Field label="Email"><Input value={user!.email} readOnly disabled /></Field>
            <Field label="Full name" hint="In chat, other traders see only your first name and last initial."><Input value={name} maxLength={120} required onChange={(e) => { setName(e.target.value); setSaved(false); }} /></Field>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={alerts} onChange={(e) => { setAlerts(e.target.checked); setSaved(false); }} />
              <span className="text-sm"><span className="block font-medium">Email me when a bias changes</span><span className="block text-ink-2">{canEmail ? "Sent when the bias flips or its strength shifts on something you follow." : "Included with the Pro plan."}</span></span>
            </label>
            {profile.error instanceof ApiError && <ErrorNote>{profile.error.message}</ErrorNote>}
            <div className="flex items-center gap-3"><Button type="submit" loading={profile.isPending}>Save changes</Button>{saved && <span className="text-sm text-ink-2" role="status">Saved</span>}</div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Appearance</h2>
          <div className="mt-3">
            <Segmented<ThemeChoice> label="Theme" value={theme} onChange={(t) => { setTheme(t); setThemeState(t); }} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
        </Card>

        <PasswordCard />
      </div>
    </>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => api("/auth/password", { method: "POST", body: { current_password: current, new_password: next } }),
    onSuccess: () => { setCurrent(""); setNext(""); setDone(true); },
  });
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Password</h2>
      <p className="mt-1 text-sm text-ink-2">Changing your password signs you out on your other devices.</p>
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); setDone(false); change.mutate(); }}>
        <Field label="Current password"><Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        {change.error instanceof ApiError && <ErrorNote>{change.error.message}</ErrorNote>}
        {done && <Notice>Password updated.</Notice>}
        <Button type="submit" variant="secondary" loading={change.isPending}>Update password</Button>
      </form>
    </Card>
  );
}
