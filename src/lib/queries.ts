import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useEntitled } from "./auth";
import type {
  Account, AnalysisDetail, Analysis, AppConfig, Candle, Catalog, ChatRoom, Feed, Performance, Plan, Portfolio, Position, Preferences, RiskAlerts, RiskSettings, Timeframe, TradePage,
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
