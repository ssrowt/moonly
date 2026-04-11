export type Plan = 'FREE' | 'PRO' | 'LUXE';
export type Direction = 'BULLISH' | 'BEARISH';
export type Timeframe = '1H' | '4H' | '1D';
export type SignalStatus = 'ACTIVE' | 'HIT_TP' | 'HIT_SL' | 'EXPIRED';
export type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Signal {
  id: number;
  symbol: string;
  direction: Direction;
  confidence_score: number;
  timeframe: Timeframe;
  status: SignalStatus;
  premium_level: Plan;
  created_at: string;
  locked?: boolean;
  // Detail fields (only on /signals/:id)
  entry?: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number | null;
  take_profit_3?: number | null;
  ai_summary?: string | null;
  expires_at?: string | null;
}

export interface LiveSignal {
  symbol: string;
  price: number;
  entry: number;
  tp: number;
  sl: number;
  score: number;
  winrate: number;
  trend: 'BUY' | 'SELL';
  rsi: number;
  is_top: boolean;
  is_risky: boolean;
  ai_analysis?: string;
}

export interface User {
  id: number;
  username: string | null;
  first_name: string | null;
  plan: Plan;
  plan_expires_at: string | null;
  referral_code: string;
  referral_count?: number;
  referral_link?: string;
  notifications_enabled: boolean;
}

export interface Opportunity {
  symbol: string;
  reason: string;
}

export interface Analysis {
  id: number;
  market_sentiment: Sentiment;
  fear_greed_index: number | null;
  top_opportunities: Opportunity[];
  risk_level: RiskLevel;
  volatility_note: string | null;
  ai_insights: string[];
  created_at: string;
}

export interface PlanInfo {
  id: Plan;
  label: string;
  period: string;
  duration_days?: number;
  features: string[];
  price: string | null;
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

export interface ChartPoint {
  ts: number;
  price: number;
}

export interface MarketData {
  coins: MarketCoin[];
  btcChart: ChartPoint[];
  updatedAt: string;
  stale?: boolean;
}

export interface Subscription {
  plan: Plan;
  plan_expires_at: string | null;
  days_remaining: number | null;
  features: string[];
}
