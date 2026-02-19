
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