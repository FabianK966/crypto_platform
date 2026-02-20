import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  inject,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption } from '../../models/replay.model';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';

import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

interface ReplayTrade {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
  total: number;
}

interface ReplayDeposit {
  amount: number;
  timestamp: string;
  newBalance: number;
}

@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, DatePickerModule],
  templateUrl: './replay.html',
  styleUrl: './replay.css',
})
export class ReplayComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private replayService = inject(ReplayService);

  // Chart
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private readonly VISIBLE_CANDLES = 1000;
  private readonly FIT_THRESHOLD = 1000;
  private userIsScrolling = false;
  private scrollTimeout: any = null;

  // Data
  availableSymbols = signal<string[]>([]);
  availableIntervals = signal<IntervalOption[]>([]);
  symbolOptions = signal<Array<{ label: string; value: string }>>([]);
  allCandles: CandleData[] = [];

  speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '3x', value: 3 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
  ];

  selectedSymbol = 'BTC';
  selectedInterval = '1h';
  startDate = '2024-01-01';
  endDate = new Date().toISOString().split('T')[0];
  today = new Date().toISOString().split('T')[0];

  loading = signal(false);
  error = signal<string | null>(null);
  candlesLoaded = signal(false);
  totalCandles = signal(0);
  currentCandleIndex = signal(0);

  isPlaying = signal(false);
  playbackSpeed = 1;
  private playbackInterval: any = null;

  // Portfolio
  replayCashBalance = signal(10000);
  replayQuantity = signal(0);
  replayAvgBuyPrice = signal(0);
  replayRealizedPnl = signal(0);
  replayTradeHistory = signal<ReplayTrade[]>([]);
  replayDepositHistory = signal<ReplayDeposit[]>([]);  
  replayInitialBalanceInput = 10000;
  private replayInitialBalance = 10000;

  replayAssetValue = computed(() => this.replayQuantity() * this.getCurrentPrice());
  replayTotalBalance = computed(() => this.replayCashBalance() + this.replayAssetValue());

  replayUnrealizedPnl = computed(() => {
    if (this.replayQuantity() === 0) return 0;
    return (this.getCurrentPrice() - this.replayAvgBuyPrice()) * this.replayQuantity();
  });

  replayUnrealizedPnlPercent = computed(() => {
    if (this.replayAvgBuyPrice() === 0 || this.replayQuantity() === 0) return 0;
    return ((this.getCurrentPrice() - this.replayAvgBuyPrice()) / this.replayAvgBuyPrice()) * 100;
  });

  // Trade Panel
  tradePanelOpen = signal(false);
  tradePanelType = signal<'buy' | 'sell'>('buy');
  tradeQuantityInput = 0;

  // Deposit Panel
  depositPanelOpen = signal(false);
  depositAmountInput = 0;

  constructor() {
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });
  }

  ngOnInit() {
    this.loadAvailableOptions();
  }

  ngOnDestroy() {
    document.body.style.overflowY = '';
    clearTimeout(this.scrollTimeout);
    this.stopPlayback();
    if (this.chart) {
      this.chart.remove();
    }
  }

  loadAvailableOptions() {
    this.replayService.getAvailableSymbols().subscribe({
      next: (symbols) => {
        this.availableSymbols.set(symbols);
        this.symbolOptions.set(symbols.map((s) => ({ label: s, value: s })));
      },
      error: (err) => console.error('Failed to load symbols:', err),
    });
    this.replayService.getAvailableIntervals().subscribe({
      next: (intervals) => this.availableIntervals.set(intervals),
      error: (err) => console.error('Failed to load intervals:', err),
    });
  }

  loadReplayData() {
    this.loading.set(true);
    this.error.set(null);
    this.stopPlayback();

    const config: ReplayConfig = {
      symbol: this.selectedSymbol,
      interval: this.selectedInterval,
      startTime: new Date(this.startDate).getTime(),
      endTime: new Date(this.endDate).getTime(),
    };

    this.replayService.getCandles(config).subscribe({
      next: (response) => {
        this.allCandles = response.candles;
        this.totalCandles.set(response.candles.length);
        this.candlesLoaded.set(true);
        this.currentCandleIndex.set(0);
        this.loading.set(false);
        this.resetReplayPortfolio();
        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load historical data');
        this.loading.set(false);
      },
    });
  }

  initializeChart() {
    if (this.chart) {
      this.chart.remove();
    }

    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 600,
      layout: { background: { color: '#0a0a0a' }, textColor: '#999' },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    window.addEventListener('resize', () => {
      if (this.chart && this.chartContainer) {
        this.chart.applyOptions({ width: this.chartContainer.nativeElement.clientWidth });
      }
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.userIsScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => { this.userIsScrolling = false; }, 150);
    });

    this.reset();
  }

  reset() {
    this.stopPlayback();
    this.currentCandleIndex.set(0);
    this.updateChart();
  }

  togglePlay() {
    this.isPlaying() ? this.stopPlayback() : this.startPlayback();
  }

  startPlayback() {
    if (this.currentCandleIndex() >= this.totalCandles()) this.reset();
    this.isPlaying.set(true);
    this.playbackInterval = setInterval(() => {
      if (this.currentCandleIndex() >= this.totalCandles()) { this.stopPlayback(); return; }
      this.stepForward();
    }, 1000 / this.playbackSpeed);
  }

  stopPlayback() {
    this.isPlaying.set(false);
    if (this.playbackInterval) { clearInterval(this.playbackInterval); this.playbackInterval = null; }
  }

  stepForward() {
    if (this.currentCandleIndex() < this.totalCandles()) {
      this.currentCandleIndex.update((i) => i + 1);
      this.updateChart();
    }
  }

  stepBackward() {
    if (this.currentCandleIndex() > 1) {
      this.currentCandleIndex.update((i) => i - 1);
      this.updateChart();
    }
  }

  skipToEnd() {
    this.currentCandleIndex.set(this.totalCandles());
    this.updateChart();
    this.stopPlayback();
  }

  updateChart() {
    if (!this.candleSeries || !this.chart) return;
    const index = this.currentCandleIndex();
    const chartData = this.allCandles.slice(0, index).map((c) => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    this.candleSeries.setData(chartData);
    if (chartData.length === 0 || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) {
      ts.fitContent();
    } else {
      ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
    }
  }

  getIntervalLabel(): string {
    return this.availableIntervals().find((i) => i.value === this.selectedInterval)?.label ?? this.selectedInterval;
  }

  getCurrentDate(): string {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return '';
    return new Date(this.allCandles[this.currentCandleIndex() - 1].timestamp).toLocaleString();
  }

  getCurrentPrice(): number {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return 0;
    return this.allCandles[this.currentCandleIndex() - 1].close;
  }

  // Portfolio methods
  setReplayBalance() {
    const amount = Number(this.replayInitialBalanceInput);
    if (amount > 0) { 
      this.replayInitialBalance = amount; 
      this.replayCashBalance.set(amount); 
    }
  }

  resetReplayPortfolio() {
    this.replayCashBalance.set(this.replayInitialBalance);
    this.replayQuantity.set(0);
    this.replayAvgBuyPrice.set(0);
    this.replayRealizedPnl.set(0);
    this.replayTradeHistory.set([]);
    this.replayDepositHistory.set([]); 
    this.closeTradePanel();
    this.closeDepositPanel();  
  }

  // Deposit Panel Methods
  openDepositPanel() {
    this.depositAmountInput = 0;
    this.depositPanelOpen.set(true);
  }

  closeDepositPanel() {
    this.depositPanelOpen.set(false);
    this.depositAmountInput = 0;
  }

  setDepositQuickAmount(amount: number) {
    this.depositAmountInput = amount;
  }

  confirmDeposit() {
    const amount = Number(this.depositAmountInput);
    if (amount <= 0) {
      alert('Please enter a valid deposit amount');
      return;
    }

    // Balance erhöhen
    this.replayCashBalance.update((b) => b + amount);
    
    const newBalance = this.replayCashBalance();

    // Deposit in Historie speichern
    this.replayDepositHistory.update((h) => [
      {
        amount,
        timestamp: this.getCurrentDate(),
        newBalance
      },
      ...h
    ]);

    console.log(`💰 Deposited $${amount.toFixed(2)} at ${this.getCurrentDate()}`);
    console.log(`💵 New cash balance: $${newBalance.toFixed(2)}`);

    this.closeDepositPanel();
  }

  // Trade Panel Methods
  openTradePanel(type: 'buy' | 'sell') {
    this.tradePanelType.set(type);
    this.tradeQuantityInput = 0;
    this.tradePanelOpen.set(true);
  }

  closeTradePanel() {
    this.tradePanelOpen.set(false);
    this.tradeQuantityInput = 0;
  }

  setTradePercent(percent: number) {
    const price = this.getCurrentPrice();
    if (price <= 0) return;
    this.tradeQuantityInput = Math.floor((this.replayCashBalance() * (percent / 100) / price) * 100000) / 100000;
  }

  setSellPercent(percent: number) {
    this.tradeQuantityInput = Math.floor(this.replayQuantity() * (percent / 100) * 100000) / 100000;
  }

  confirmTrade() {
    const price = this.getCurrentPrice();
    const qty = Number(this.tradeQuantityInput);
    if (qty <= 0 || price <= 0) return;
    this.tradePanelType() === 'buy' ? this.executeBuy(qty, price) : this.executeSell(qty, price);
    this.closeTradePanel();
  }

  private executeBuy(qty: number, price: number) {
    const totalCost = qty * price;
    if (totalCost > this.replayCashBalance()) { 
      alert('Insufficient cash balance'); 
      return; 
    }
    const existingQty = this.replayQuantity();
    const newAvg = existingQty > 0
      ? (existingQty * this.replayAvgBuyPrice() + qty * price) / (existingQty + qty)
      : price;
    this.replayQuantity.update((q) => q + qty);
    this.replayAvgBuyPrice.set(newAvg);
    this.replayCashBalance.update((b) => b - totalCost);
    this.replayTradeHistory.update((h) => [
      { type: 'buy', quantity: qty, price, total: totalCost, timestamp: this.getCurrentDate() }, 
      ...h,
    ]);
  }

  private executeSell(qty: number, price: number) {
    if (qty > this.replayQuantity()) { 
      alert('Insufficient asset quantity'); 
      return; 
    }
    const proceeds = qty * price;
    const realizedProfit = proceeds - qty * this.replayAvgBuyPrice();
    this.replayQuantity.update((q) => q - qty);
    this.replayCashBalance.update((b) => b + proceeds);
    this.replayRealizedPnl.update((p) => p + realizedProfit);
    if (this.replayQuantity() === 0) this.replayAvgBuyPrice.set(0);
    this.replayTradeHistory.update((h) => [
      { type: 'sell', quantity: qty, price, total: proceeds, timestamp: this.getCurrentDate() }, 
      ...h,
    ]);
  }
}