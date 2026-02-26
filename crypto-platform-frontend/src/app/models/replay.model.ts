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

// ── NEU: Payload für "Session speichern" ────────────────────────────
export interface ReplaySaveRequest {
  // Konfiguration
  symbol: string;
  intervalValue: string;
  startTime: number;
  endTime: number;
  leverage: number;

  // Portfolio-Snapshot
  initialBalance: number;
  startBalance: number;
  finalCashBalance: number;
  totalBalance: number;
  realizedPnl: number;
  totalFees: number;

  // Offene Positionen
  longQuantity: number;
  longAvgPrice: number;
  longDebt: number;
  shortQuantity: number;
  shortAvgPrice: number;

  // Fortschritt
  currentCandle: number;
  totalCandles: number;

  // Historien
  tradeHistory: any[];
  depositHistory: any[];
}

// Antwort vom Backend nach dem Speichern
export interface ReplaySessionResponse {
  id: string;
  createdAt: string;
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