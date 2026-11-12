import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useEntitled } from "./auth";
import type {
  Account, AnalysisDetail, Analysis, AppConfig, Candle, Catalog, ChatRoom, Feed, Follow, FollowSettings, LeaderCard, LeaderDetail, MyLeader, Performance, Plan, Portfolio, Position, Preferences, RiskAlerts, RiskSettings, SizingPreview, Ticket, Timeframe, TradePage,
} from "./types";

export interface PerfFilter {
  accountId?: number | null;
  dateFrom?: string;
}

export const useConfig = () =>
  useQuery({ queryKey: ["config"], queryFn: () => api<AppConfig>("/config"), staleTime: Infinity });

export const useCatalog = () =>
  useQuery({ queryKey: ["catalog"], queryFn: () => api<Catalog>("/market/catalog"), staleTime: Infinity });

export const usePlans = () =>
  useQuery({ queryKey: ["plans"], queryFn: () => api<Plan[]>("/billing/plans"), staleTime: Infinity });

export const useAccounts = () =>
  useQuery({
    queryKey: ["accounts"],
    queryFn: () => api<Account[]>("/accounts"),
    // Keep polling while any account is still connecting to the broker.
    refetchInterval: (q) => (q.state.data?.some((a) => a.status === "pending") ? 5000 : false),
  });

export const usePositions = (accountId: number | null) =>
  useQuery({
    queryKey: ["positions", accountId],
    queryFn: () => api<Position[]>(`/accounts/${accountId}/positions`),
    enabled: accountId !== null,
    refetchInterval: 30_000,
  });

export const usePerformance = (f: PerfFilter) =>
  useQuery({
    queryKey: ["performance", f.accountId ?? "all", f.dateFrom ?? "all"],
    queryFn: () => api<Performance>("/performance", { query: { account_id: f.accountId, date_from: f.dateFrom } }),
    placeholderData: keepPreviousData,
  });

export interface TradeFilter extends PerfFilter {
  symbol?: string;
  side?: string;
  page: number;
  pageSize: number;
}
export const useTrades = (f: TradeFilter) =>
  useQuery({
    queryKey: ["trades", f],
    queryFn: () =>
      api<TradePage>("/performance/trades", {
        query: { account_id: f.accountId, date_from: f.dateFrom, symbol: f.symbol, side: f.side, page: f.page, page_size: f.pageSize },
      }),
    placeholderData: keepPreviousData,
  });

// ---- subscriber features: only fire when the user is entitled, so non-subscribers never see 402 errors
export const usePreferences = () => {
  const entitled = useEntitled();
  return useQuery({ queryKey: ["preferences"], queryFn: () => api<Preferences>("/analysis/preferences"), enabled: entitled });
};

export const useOverview = () => {
  const entitled = useEntitled();
  return useQuery({ queryKey: ["overview"], queryFn: () => api<Analysis[]>("/analysis/overview"), enabled: entitled, refetchInterval: 60_000 });
};

export const useFeed = () => {
  const entitled = useEntitled();
  return useQuery({ queryKey: ["feed"], queryFn: () => api<Feed>("/analysis/feed", { query: { limit: 40 } }), enabled: entitled, refetchInterval: 60_000 });
};

export const useUnread = () => {
  const entitled = useEntitled();
  return useQuery({
    queryKey: ["unread"],
    queryFn: () => api<{ unread: number }>("/analysis/feed/unread-count"),
    enabled: entitled,
    refetchInterval: 60_000,
    select: (d) => d.unread,
  });
};

export const useSymbolDetail = (symbol: string) =>
  useQuery({ queryKey: ["symbol", symbol], queryFn: () => api<AnalysisDetail[]>(`/analysis/symbol/${symbol}`), refetchInterval: 120_000 });

export const useCandles = (symbol: string, timeframe: Timeframe) =>
  useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => api<Candle[]>("/market/candles", { query: { symbol, timeframe, limit: 400 } }),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });

export const useChatRooms = () => {
  const entitled = useEntitled();
  return useQuery({ queryKey: ["chat-rooms"], queryFn: () => api<ChatRoom[]>("/chat/rooms"), enabled: entitled, refetchInterval: 30_000 });
};

// ---- risk management (free for every signed-in user)
export const useRiskSettings = () => useQuery({ queryKey: ["risk-settings"], queryFn: () => api<RiskSettings>("/risk/settings") });

export const useRiskAlerts = () =>
  useQuery({ queryKey: ["risk-alerts"], queryFn: () => api<RiskAlerts>("/risk/alerts", { query: { limit: 30 } }), refetchInterval: 60_000 });

export const usePortfolio = (accountId: number | null) =>
  useQuery({
    queryKey: ["portfolio", accountId ?? "all"],
    queryFn: () => api<Portfolio>("/risk/portfolio", { query: { account_id: accountId } }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

// ---- copy trading: browsing is open to everyone; following is part of the paid plan
export const useLeaders = () => useQuery({ queryKey: ["copy-leaders"], queryFn: () => api<LeaderCard[]>("/copy/leaders"), refetchInterval: 120_000 });

export const useLeader = (id: number) =>
  useQuery({ queryKey: ["copy-leader", id], queryFn: () => api<LeaderDetail>(`/copy/leaders/${id}`), enabled: Number.isFinite(id) });

export const useMyLeader = () => useQuery({ queryKey: ["copy-me"], queryFn: () => api<MyLeader>("/copy/me/leader") });

export const useFollows = () => useQuery({ queryKey: ["copy-follows"], queryFn: () => api<Follow[]>("/copy/follows"), refetchInterval: 30_000 });

export const useTickets = (view: "action" | "all") =>
  useQuery({ queryKey: ["copy-tickets", view], queryFn: () => api<Ticket[]>("/copy/tickets", { query: { view, limit: view === "all" ? 40 : 100 } }), refetchInterval: 20_000 });

/** How many tickets are waiting on the user. Drives the badge in the navigation. */
export const usePendingTickets = () =>
  useQuery({
    queryKey: ["copy-pending"],
    queryFn: () => api<{ pending: number }>("/copy/tickets/pending"),
    refetchInterval: 20_000,
    select: (d) => d.pending,
  });

export const useSizingPreview = (leaderId: number, accountId: number | null, s: Pick<FollowSettings, "size_mode" | "size_value" | "max_lots">) =>
  useQuery({
    queryKey: ["copy-preview", leaderId, accountId, s.size_mode, s.size_value, s.max_lots],
    queryFn: () => api<SizingPreview>(`/copy/leaders/${leaderId}/preview`, { query: { account_id: accountId, size_mode: s.size_mode, size_value: s.size_value, max_lots: s.max_lots } }),
    enabled: accountId !== null && s.size_value > 0 && s.max_lots > 0,
    placeholderData: keepPreviousData,
  });
