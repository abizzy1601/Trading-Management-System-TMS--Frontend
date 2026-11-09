import { Link } from "react-router-dom";
import { Activity, BarChart3, Check, MessagesSquare, Radar } from "lucide-react";
import { usePlans } from "../lib/queries";
import { Card } from "../components/ui";

const FEATURES = [
  { icon: BarChart3, title: "Know your numbers", text: "Connect your MT5 account and see win rate, profit factor, drawdown, and which pairs, days and hours actually make you money." },
  { icon: Radar, title: "Bias in your method", text: "Pick the coins and pairs you trade and how you trade them: SMC, fair value gaps, ICT, supply and demand, price action or trend following." },
  { icon: MessagesSquare, title: "Trade alongside others", text: "Subscribers get access to live chat rooms to compare ideas with other traders." },
];

export default function Landing() {
  const { data: plans } = usePlans();
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-base font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent"><Activity className="size-4" aria-hidden /></span>
          TMS
        </span>
        <nav className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">Log in</Link>
          <Link to="/register" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">See your edge. Trade with a bias.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2">
          A trading management portal that turns your MT5 history into clear performance analytics, and sends you market bias based on the way you trade.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-medium text-on-accent hover:bg-accent-hover">Create a free account</Link>
          <a href="#pricing" className="inline-flex h-11 items-center rounded-lg border border-line px-6 text-sm font-medium hover:bg-surface-2">See pricing</a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-5">
            <Icon className="size-5 text-accent" aria-hidden />
            <h2 className="mt-3 text-base font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm text-ink-2">{text}</p>
          </Card>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold">Free to track. Subscribe for bias and chat.</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink-2">Performance analytics for your MT5 accounts are free. Market bias and the trader chat come with a subscription.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {plans?.map((p) => (
            <Card key={p.id} className="p-6">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1"><span className="text-3xl font-semibold">${p.price_usd_monthly}</span><span className="text-sm text-ink-2"> / month</span></p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{f}</li>)}
              </ul>
              <Link to="/register" className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg border border-line text-sm font-medium hover:bg-surface-2">Get started</Link>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-4 py-8 text-center text-xs text-ink-2">
        <p className="mx-auto max-w-2xl">
          Educational technical analysis only. Nothing here is financial advice or a recommendation to buy or sell, and no outcome is guaranteed. Trading leveraged products carries a high risk of loss.
        </p>
      </footer>
    </div>
  );
}
