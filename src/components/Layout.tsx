import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Calculator, Copy, CreditCard, LayoutDashboard, ListOrdered, Lock, LogOut, Menu, MessagesSquare, Moon, Plug, Settings, ShieldAlert, Sun, Target, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useConfig, usePendingTickets, useRiskAlerts, useUnread } from "../lib/queries";
import { getTheme, setTheme } from "../lib/theme";
import { RiskBanner } from "./RiskBanner";
import { cx, Notice } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trades", icon: ListOrdered },
  { to: "/accounts", label: "MT5 accounts", icon: Plug },
  { to: "/planner", label: "Trade planner", icon: Target },
  { to: "/risk", label: "Risk & portfolio", icon: ShieldAlert },
  { to: "/calculator", label: "Lot size calculator", icon: Calculator },
  { to: "/copy", label: "Copy trading", icon: Copy },
  { to: "/analysis", label: "Market bias", icon: Activity, paid: true },
  { to: "/chat", label: "Trader chat", icon: MessagesSquare, paid: true },
  { to: "/billing", label: "Plans & billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const t = getTheme();
    return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(dark ? "light" : "dark");
        setDark(!dark);
      }}
      className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { data: unread = 0 } = useUnread();
  const { data: riskAlerts } = useRiskAlerts();
  const riskUnread = riskAlerts?.unread ?? 0;
  const { data: copyWaiting = 0 } = usePendingTickets();
  const { data: config } = useConfig();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const entitled = user?.subscription.entitled ?? false;

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, paid }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")
          }
        >
          <Icon className="size-4" aria-hidden />
          <span className="flex-1">{label}</span>
          {paid && !entitled && <Lock className="size-3.5 text-muted" aria-label="Subscribers only" />}
          {to === "/risk" && riskUnread > 0 && (
            <span className="min-w-5 rounded-full bg-critical px-1.5 text-center text-xs font-semibold text-white" aria-label={`${riskUnread} unread risk alerts`}>
              {riskUnread > 99 ? "99+" : riskUnread}
            </span>
          )}
          {to === "/copy" && copyWaiting > 0 && (
            <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold text-on-accent" aria-label={`${copyWaiting} copy trades waiting`}>
              {copyWaiting > 99 ? "99+" : copyWaiting}
            </span>
          )}
          {to === "/analysis" && unread > 0 && (
            <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold text-on-accent" aria-label={`${unread} unread`}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-2 px-2 text-base font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-on-accent">
          <Activity className="size-4" aria-hidden />
        </span>
        TMS
      </div>
      {nav}
      <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-sm font-medium">{user?.full_name}</div>
          <div className="truncate text-xs text-ink-2">{entitled ? `${user?.subscription.plan} plan` : "Free account"}</div>
        </div>
        <ThemeToggle />
        <button type="button" onClick={() => logout()} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label="Log out">
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <span className="text-base font-semibold">TMS</span>
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Open menu">
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
        {open && (
          <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label="Close menu">
                <X className="size-5" aria-hidden />
              </button>
              {sidebar}
            </div>
          </div>
        )}
        <main key={location.pathname} className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {config?.mt5_provider === "demo" && (
            <div className="mb-5">
              <Notice tone="warning">
                <strong>Demo mode.</strong> MT5 account data is simulated. Set <code>MT5_PROVIDER=metaapi</code> on the server to connect real accounts.
              </Notice>
            </div>
          )}
          {location.pathname !== "/risk" && <RiskBanner />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
