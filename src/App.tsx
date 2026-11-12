import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/AuthPages";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Accounts from "./pages/Accounts";
import Analysis from "./pages/Analysis";
import Chat from "./pages/Chat";
import Billing from "./pages/Billing";
import SettingsPage from "./pages/Settings";
import Risk from "./pages/Risk";
import CalculatorPage from "./pages/Calculator";
import TradePlanner from "./pages/TradePlanner";
import CopyDiscover from "./pages/copy/Discover";
import CopyLeader from "./pages/copy/LeaderPage";
import CopyFollowing from "./pages/copy/Following";
import CopyShare from "./pages/copy/Share";

// The candlestick chart library is only needed on this page, so it loads on demand.
const SymbolAnalysis = lazy(() => import("./pages/SymbolAnalysis"));

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <div className="grid h-full place-items-center"><Spinner label="Loading your session" /></div>;
  if (status === "anon") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/dashboard";
  if (status === "loading") return <div className="grid h-full place-items-center"><Spinner /></div>;
  if (status === "authed") return <Navigate to={from} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/planner" element={<TradePlanner />} />
        <Route path="/copy" element={<CopyDiscover />} />
        <Route path="/copy/leaders/:id" element={<CopyLeader />} />
        <Route path="/copy/following" element={<CopyFollowing />} />
        <Route path="/copy/share" element={<CopyShare />} />
        <Route path="/risk" element={<Risk />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/analysis/:symbol" element={<Suspense fallback={<Spinner />}><SymbolAnalysis /></Suspense>} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<div className="grid h-full place-items-center p-8 text-center"><div><h1 className="text-2xl font-semibold">Page not found</h1><a href="/" className="mt-3 inline-block text-accent underline">Go home</a></div></div>} />
    </Routes>
  );
}
