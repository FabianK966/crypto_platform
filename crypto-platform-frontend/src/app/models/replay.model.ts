export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayConfig {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
}

export interface ReplayResponse {
  candles: CandleData[];
  count: number;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
}

export interface IntervalOption {
  value: string;
  label: string;
}

// ── Payload für "Session speichern" ────────────────────────────
export interface ReplaySaveRequest {
  sessionType: 'manual' | 'strategy';
  symbol: string;
  intervalValue: string;
  startTime: number;
  endTime: number;
  leverage: number;
  initialBalance: number;
  startBalance: number;
  finalCashBalance: number;
  totalBalance: number;
  realizedPnl: number;
  totalFees: number;
  longQuantity: number;
  longAvgPrice: number;
  longDebt: number;
  shortQuantity: number;
  shortAvgPrice: number;
  currentCandle: number;
  totalCandles: number;
  tradeHistory: any[];
  depositHistory: any[];
}

// Antwort vom Backend nach dem Speichern
export interface ReplaySessionResponse {
  id: string;
  createdAt: string;
  sessionType: string;
  symbol: string;
  intervalValue: string;
  startTime: number;
  endTime: number;
  leverage: number;
  initialBalance: number;
  startBalance: number;
  finalCashBalance: number;
  totalBalance: number;
  realizedPnl: number;
  totalFees: number;
  longQuantity: number;
  longAvgPrice: number;
  shortQuantity: number;
  shortAvgPrice: number;
  currentCandle: number;
  totalCandles: number;
  tradeCount: number;
}

export interface StrategyConfig {
  autoShortEnabled: boolean;

  // ── LONG ──────────────────────────────────────────────
  longRsiBuyThreshold:    number;
  longRsiSellThreshold:   number;
  longCooldownCandles:    number;
  longFreeZonePercent:    number;
  longBuyPercent:         number;
  longClosePercent:       number;
  longProfitThreshold:    number;
  longLossThreshold:      number;
  // NEU: Drawdown-Rescue
  longDrawdownCandles:    number;   // wie viele Kerzen im Minus bevor Rescue aktiv
  longRescueTrigger:      number;   // % Profit der Rescue auslöst (z.B. 1)
  longRescueClosePercent: number;   // % der Position die dann verkauft wird (z.B. 50)

  // ── SHORT ─────────────────────────────────────────────
  shortRsiBuyThreshold:    number;
  shortRsiSellThreshold:   number;
  shortCooldownCandles:    number;
  shortFreeZonePercent:    number;
  shortBuyPercent:         number;
  shortClosePercent:       number;
  shortProfitThreshold:    number;
  shortLossThreshold:      number;
  // NEU: Drawdown-Rescue
  shortDrawdownCandles:    number;
  shortRescueTrigger:      number;
  shortRescueClosePercent: number;
}