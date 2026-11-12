// Shapes returned by the TMS API. Kept in one place so a backend change is a one-file fix here.

export type Bias = "bullish" | "bearish" | "neutral";
export type Timeframe = "M15" | "H1" | "H4" | "D1";

export interface Subscription {
  plan: string | null;
  status: string;
  entitled: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  max_symbols: number;
  max_methods: number;
  max_timeframes: number;
  email_alerts: boolean;
  max_leaders: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
  methods: string[];
  timeframes: string[];
  email_alerts: boolean;
  subscription: Subscription;
}

export interface AuthResponse {
  access_token: string;
  expires_in: number;
  user: User;
}

export interface AppConfig {
  env: string;
  mt5_provider: "demo" | "metaapi";
  billing_provider: "dev" | "stripe";
  market_data_provider: "live" | "synthetic";
}

export interface Account {
  id: number;
  label: string;
  login: string;
  server: string;
  provider: string;
  status: "pending" | "connected" | "error";
  error_message: string | null;
  currency: string | null;
  leverage: number | null;
  balance: number | null;
  equity: number | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Position {
  position_id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  open_price: number;
  current_price: number | null;
  profit: number;
  stop_loss: number | null;
  take_profit: number | null;
  open_time: string;
}

export interface PerfSummary {
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  net_profit: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number | null;
  avg_win: number;
  avg_loss: number;
  payoff_ratio: number | null;
  expectancy: number;
  best_trade: number;
  worst_trade: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  current_streak: number;
  avg_hold_seconds: number;
  total_volume: number;
  total_commission: number;
  total_swap: number;
  starting_balance: number;
  ending_balance: number;
  return_pct: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  profitable_days_pct: number;
  best_day: number;
  worst_day: number;
}

export interface Bucket {
  trades: number;
  net: number;
  win_rate: number;
  profit_factor: number | null;
}

export interface Performance {
  account_ids: number[];
  currency: string | null;
  summary: PerfSummary;
  equity_curve: { time: string; balance: number; drawdown: number }[];
  daily_pnl: { date: string; pnl: number; trades: number }[];
  monthly_pnl: { month: string; pnl: number; trades: number }[];
  by_symbol: (Bucket & { symbol: string })[];
  by_weekday: (Bucket & { day: string })[];
  by_hour: (Bucket & { hour: number })[];
  by_side: (Bucket & { side: "buy" | "sell" })[];
}

export interface Trade {
  id: number;
  account_id: number;
  position_id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  open_time: string;
  close_time: string;
  open_price: number;
  close_price: number;
  profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  hold_seconds: number;
}

export interface TradePage {
  items: Trade[];
  total: number;
  page: number;
  page_size: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  asset_class: "crypto" | "forex" | "metal";
  note: string;
  contract_size: number;
  quote_currency: string;
  pip_size: number | null;
}

export interface MethodInfo {
  id: string;
  name: string;
  description: string;
}

export interface Catalog {
  instruments: Instrument[];
  methods: MethodInfo[];
  timeframes: Timeframe[];
}

export interface Plan {
  id: string;
  name: string;
  price_usd_monthly: number;
  max_symbols: number;
  max_methods: number;
  max_timeframes: number;
  email_alerts: boolean;
  max_leaders: number;
  features: string[];
}

export interface Preferences {
  methods: string[];
  timeframes: Timeframe[];
  watchlist: string[];
  max_symbols: number;
  max_methods: number;
  max_timeframes: number;
}

export interface Analysis {
  id: number;
  symbol: string;
  timeframe: Timeframe;
  method: string;
  bias: Bias;
  score: number;
  strength: number;
  price: number;
  summary: string;
  candle_time: string;
  created_at: string;
}

export interface Zone {
  type: string;
  side: Bias;
  top: number;
  bottom: number;
  start: number;
  status: string;
  label: string;
}

export interface LevelLine {
  price: number;
  label: string;
  kind: string;
}

export interface TradePlan {
  direction: "long" | "short";
  entry_zone: [number, number];
  entry_basis: string;
  stop: number;
  targets: { price: number; label: string }[];
  risk_reward: number;
}

export interface AnalysisDetail extends Analysis {
  detail: {
    reasons: { text: string; weight: number }[];
    plan: TradePlan | null;
    triggers: { bullish_above: number; bearish_below: number } | null;
    zones: Zone[];
    levels: LevelLine[];
    indicators: { atr: number; ema50: number; ema200: number; rsi: number | null; trend: string };
  };
}

export interface FeedItem {
  id: number;
  reason: "first" | "bias_changed" | "strength_shift";
  read: boolean;
  created_at: string;
  analysis: Analysis;
}

export interface Feed {
  items: FeedItem[];
  unread: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChatRoom {
  slug: string;
  name: string;
  description: string;
  online: number;
}

export interface ChatMessage {
  id: number;
  room: string;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

// ---- risk management
export type Severity = "info" | "warning" | "critical";

export interface RiskSettings {
  alerts_enabled: boolean;
  max_trades_per_day: number;
  max_daily_loss_pct: number;
  max_open_positions: number;
  max_trades_per_hour: number;
  risk_per_trade_pct: number;
  email_alerts: boolean;
}

export interface RiskAlert {
  id: number;
  account_id: number;
  account_label: string;
  kind: string;
  severity: Severity;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface RiskAlerts {
  items: RiskAlert[];
  unread: number;
}

export interface Finding {
  severity: "warning" | "info";
  text: string;
}

export interface Portfolio {
  account_ids: number[];
  currency: string;
  limits: Omit<RiskSettings, "alerts_enabled" | "email_alerts">;
  today: {
    date: string;
    trades_opened: number;
    trades_last_hour: number;
    realized_pnl: number;
    floating_pnl: number;
    pnl: number;
    loss_pct: number;
    open_positions: number;
  };
  exposure: {
    by_currency: { currency: string; net_lots: number; long_positions: number; short_positions: number }[];
    by_symbol: { symbol: string; long_lots: number; short_lots: number; net_lots: number; floating: number; positions: number }[];
    notes: Finding[];
  };
  concentration: {
    by_symbol: { symbol: string; trades: number; share_trades: number; share_volume: number; net: number; share_of_profit: number | null }[];
    top_share_trades: number;
    hhi: number;
    label: string;
  };
  overtrading: {
    trading_days: number;
    avg_trades_per_day: number;
    max_trades_in_a_day: number;
    busiest_day: string | null;
    days_over_limit: number;
    daily_limit: number;
    by_activity: { label: string; days: number; avg_pnl_per_day: number; win_rate: number; avg_trades: number }[];
    quick_reentry: {
      window_minutes: number;
      after_loss: { trades: number; win_rate: number; avg_net: number };
      other: { trades: number; win_rate: number; avg_net: number };
    };
    insights: Finding[];
  };
  sizing: {
    sample: number;
    kelly_fraction: number | null;
    suggested_risk_pct: number;
    current_risk_pct: number;
    basis: string;
    longest_losing_streak: number;
    streak_cost_at_suggested_pct: number;
    streak_cost_at_current_pct: number;
    max_drawdown_pct: number;
    size_consistency: { median_lots: number; p90_lots: number; max_lots: number; variation: number } | null;
    costs: { commission: number; swap: number; total: number; share_of_gross_profit: number | null };
  };
  recommendations: Finding[];
  data: { closed_trades: number; open_positions_available: boolean };
}

export interface PositionSizeRequest {
  account_id?: number | null;
  balance?: number | null;
  currency?: string | null;
  leverage?: number | null;
  risk_mode: "percent" | "amount";
  risk_value: number;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  stop_loss: number;
  take_profit?: number | null;
  contract_size?: number | null;
  quote_currency?: string | null;
  conversion_rate?: number | null;
}

export interface PositionSize {
  lots: number;
  units: number;
  risk_amount: number;
  risk_percent: number;
  actual_risk_amount: number;
  actual_risk_percent: number;
  risk_per_lot: number;
  stop_distance: number;
  stop_distance_pips: number | null;
  pip_value_per_lot: number | null;
  min_lot_risk_amount: number;
  reward_amount: number | null;
  reward_risk_ratio: number | null;
  take_profit_distance_pips: number | null;
  margin_required: number | null;
  margin_percent_of_balance: number | null;
  losing_trades_to_daily_limit: number | null;
  daily_loss_limit_pct: number;
  currency: string;
  quote_currency: string;
  quote_to_account_rate: number;
  balance: number;
  symbol: string;
  leverage: number | null;
  contract_size: number;
  warnings: string[];
  assumptions: string[];
}

// ---- trade planner
export interface PlanTarget {
  price: number;
  rr: number;
  basis: string;
  reward_amount: number;
  distance_pips: number | null;
}

export interface DirectionPlan {
  direction: "long" | "short";
  entry: number;
  stop_loss: number;
  stop_basis: string;
  stop_atr: number;
  stop_distance_pips: number | null;
  targets: PlanTarget[];
  lots: number;
  units: number;
  risk_amount: number;
  risk_percent: number;
  margin_required: number | null;
  margin_percent_of_balance: number | null;
  pip_value_per_lot: number | null;
  fits_daily_budget: boolean | null;
  favoured: boolean;
  warnings: string[];
}

export type PlanSide = DirectionPlan | { direction: "long" | "short"; error: string };

export interface TradePlan {
  symbol: string;
  name: string;
  timeframe: Timeframe;
  price: number;
  as_of: string;
  atr: number;
  atr_pips: number | null;
  account: { balance: number; currency: string; leverage: number | null; connected: boolean };
  risk: { mode: "percent" | "amount"; value: number; from_settings: boolean; suggested: { percent: number; basis: string; trades: number } | null };
  consensus: { bias: Bias; score: number; bullish: number; bearish: number; neutral: number; methods: number } | null;
  consensus_locked: boolean;
  budget: { limit_pct: number; used_pct: number; remaining_pct: number; remaining_amount: number; trades_today: number; trade_limit: number } | null;
  plans: { long: PlanSide; short: PlanSide };
  notes: Finding[];
  assumptions: string[];
}

// ---- copy trading
export interface LeaderStats {
  trades: number;
  win_rate: number;
  profit_factor: number | null;
  payoff_ratio: number | null;
  return_pct: number | null;
  max_drawdown_pct: number;
  avg_hold_seconds: number;
  track_days: number;
  trades_per_week: number;
  last_trade_at: string | null;
  top_symbols: { symbol: string; trades: number; win_rate: number }[];
}

export interface LeaderCard {
  id: number;
  display_name: string;
  bio: string;
  followers: number;
  is_me: boolean;
  following: boolean;
  active: boolean;
  stats: LeaderStats;
}

export interface PublicTrade {
  symbol: string;
  side: "buy" | "sell";
  opened: string;
  closed: string;
  move_pct: number;
  result: "win" | "loss" | "flat";
  hold_seconds: number;
}

export interface LeaderDetail extends LeaderCard {
  curve: { time: string; pct: number }[];
  recent_trades: PublicTrade[];
  risk_text: string;
}

export interface EligibleAccount {
  id: number;
  label: string;
  trades: number;
  connected: boolean;
  eligible: boolean;
}

export interface MyLeader {
  leader: LeaderCard | null;
  account_id: number | null;
  accounts: EligibleAccount[];
  min_trades: number;
  risk_text: string;
}

export type SizeMode = "proportional" | "fixed";

export interface FollowSettings {
  size_mode: SizeMode;
  size_value: number;
  max_lots: number;
  max_open_copies: number;
  daily_loss_stop_pct: number;
  notify_email: boolean;
}

export interface Follow extends FollowSettings {
  id: number;
  leader_id: number;
  leader_name: string;
  leader_active: boolean;
  account_id: number;
  account_label: string;
  status: "active" | "paused" | "stopped";
  started_at: string;
  blocked: string | null;
  feed_delayed: boolean;
  needs_action: number;
}

export interface Ticket {
  id: number;
  follow_id: number;
  leader_name: string;
  symbol: string;
  display_symbol: string;
  side: "buy" | "sell";
  volume: number | null;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  state: "open" | "leader_closed" | "skipped";
  skip_reason: string | null;
  response: "taken" | "declined" | null;
  needs: "copy" | "update" | "close" | null;
  leader_opened_at: string;
  created_at: string;
  changed_at: string | null;
  change_note: string | null;
  leader_closed_at: string | null;
  result_pct: number | null;
}

export interface SizingPreview {
  sample: number;
  typical_lots: number | null;
  largest_lots: number | null;
  skipped_pct: number | null;
  problem: string | null;
}
