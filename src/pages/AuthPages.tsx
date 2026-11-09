import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, ErrorNote, Field, Input } from "../components/ui";

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-base font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent"><Activity className="size-4" aria-hidden /></span>
          TMS
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </Card>
        <p className="mt-4 text-center text-sm text-ink-2">{footer}</p>
      </div>
    </div>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(() => login(email, password));
  return (
    <Shell title="Welcome back" subtitle="Log in to see your performance and market bias." footer={<>New here? <Link to="/register" className="font-medium text-accent hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" className="w-full" loading={busy}>Log in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit(() => register(email, password, name));
  return (
    <Shell title="Create your account" subtitle="Free to start. Connect an MT5 account and see your stats." footer={<>Already have an account? <Link to="/login" className="font-medium text-accent hover:underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" hint="Other traders only see your first name and last initial."><Input autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>
    </Shell>
  );
}
