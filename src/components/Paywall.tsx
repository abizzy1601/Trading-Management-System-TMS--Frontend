import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card } from "./ui";
import type { ReactNode } from "react";

export function Paywall({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
        <Lock className="size-5" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</p>
      <Link to="/billing" className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
        See plans
      </Link>
    </Card>
  );
}
