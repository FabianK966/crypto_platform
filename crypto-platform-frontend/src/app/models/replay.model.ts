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
  useSafetyVault: boolean;
  enableLossCut: boolean;

  enableStopLoss: boolean;
  longStopLossPercent: number; 
  shortStopLossPercent: number;

  lossCutThreshold: number;
  longLeverage: number;
  shortLeverage: number;
  longRsiBuyThreshold: number;
  longRsiSellThreshold: number;
  longOpenCooldown: number;
  longCloseCooldown: number;
  longFreeZonePercent: number;
  longBuyPercent: number;
  longBuyScaleThreshold: number;
  longBuyScalePercent: number;
  longClosePercent: number;
  longProfitThreshold: number;
  longLossThreshold: number;
  longDrawdownCandles: number;
  longRescueTrigger: number;
  longRescueClosePercent: number;
  longMaxPositionPercent: number;
  minlongpositionpercent: number;

  minshortpositionpercent: number;
  shortRsiBuyThreshold: number;
  shortRsiSellThreshold: number;
  shortOpenCooldown: number;
  shortCloseCooldown: number;
  shortFreeZonePercent: number;
  shortBuyPercent: number;
  shortBuyScaleThreshold: number;
  shortBuyScalePercent: number;
  shortClosePercent: number;
  shortProfitThreshold: number;
  shortLossThreshold: number;
  shortDrawdownCandles: number;
  shortRescueTrigger: number;
  shortRescueClosePercent: number;
  shortMaxPositionPercent: number;
}