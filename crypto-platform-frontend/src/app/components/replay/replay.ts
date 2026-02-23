// =====================================================
// replay.component.ts
// Hauptkomponente für das Replay-Backtesting.
// Enthält alle Korrekturen für Margin, Hebel (1x-10x),
// Long‑Schulden, korrekte Short‑Logik und Liquidation.
// =====================================================

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

// ----------------------------------------------------------------------
// Typdefinitionen für die Historie
// ----------------------------------------------------------------------
interface ReplayTrade {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
  total: number;
  positionType: 'long' | 'short';
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
  // --------------------------------------------------------------------
  // Chart- und DOM-Referenzen
  // --------------------------------------------------------------------
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private replayService = inject(ReplayService);

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private ema50Series: ISeriesApi<'Line'> | null = null;
  private ema200Series: ISeriesApi<'Line'> | null = null;

  private readonly VISIBLE_CANDLES = 1000;
  private readonly FIT_THRESHOLD = 1000;
  private userIsScrolling = false;
  private scrollTimeout: any = null;

  // --------------------------------------------------------------------
  // Verfügbare Daten
  // --------------------------------------------------------------------
  availableSymbols = signal<string[]>([]);
  availableIntervals = signal<IntervalOption[]>([]);
  symbolOptions = signal<Array<{ label: string; value: string }>>([]);
  allCandles: CandleData[] = [];

  // --------------------------------------------------------------------
  // UI-Konfiguration
  // --------------------------------------------------------------------
  speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '3x', value: 3 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
  ];

  leverageOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  selectedLeverage = signal(1); // Standard 1x

  selectedSymbol = 'BTC';
  selectedInterval = '1h';
  startDate = '2024-01-01';
  endDate = new Date().toISOString().split('T')[0];
  today = new Date().toISOString().split('T')[0];

  // --------------------------------------------------------------------
  // Zustandssignale
  // --------------------------------------------------------------------
  loading = signal(false);
  error = signal<string | null>(null);
  candlesLoaded = signal(false);
  totalCandles = signal(0);
  currentCandleIndex = signal(0);

  showEma50 = signal(true);
  showEma200 = signal(true);

  isPlaying = signal(false);
  playbackSpeed = 1;
  private playbackInterval: any = null;

  // --------------------------------------------------------------------
  // Portfolio-Signale
  // --------------------------------------------------------------------
  replayCashBalance = signal(10000);
  replayLongQuantity = signal(0);
  replayLongAvgPrice = signal(0);
  replayLongDebt = signal(0);            // Geliehener Betrag für Longs (USD)
  replayShortQuantity = signal(0);
  replayShortAvgPrice = signal(0);
  replayRealizedPnl = signal(0);
  replayTradeHistory = signal<ReplayTrade[]>([]);
  replayDepositHistory = signal<ReplayDeposit[]>([]);

  replayInitialBalanceInput = 10000;
  private replayInitialBalance = 10000;

  // Gebundene Margin (wird bei jedem Kurswechsel neu berechnet)
  replayUsedMargin = signal(0);

  // --------------------------------------------------------------------
  // Computed-Signale
  // --------------------------------------------------------------------
  hasLong = computed(() => this.replayLongQuantity() > 0);
  hasShort = computed(() => this.replayShortQuantity() > 0);

  // Aktueller Preis (Schlusskurs der aktuellen Kerze)
  getCurrentPrice(): number {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return 0;
    return this.allCandles[this.currentCandleIndex() - 1].close;
  }

  longAssetValue = computed(() => this.replayLongQuantity() * this.getCurrentPrice());
  shortAssetValue = computed(() => -this.replayShortQuantity() * this.getCurrentPrice());

  longUnrealizedPnl = computed(() => {
    if (!this.hasLong()) return 0;
    return (this.getCurrentPrice() - this.replayLongAvgPrice()) * this.replayLongQuantity();
  });

  longUnrealizedPnlPercent = computed(() => {
    if (!this.hasLong()) return 0;
    const invested = this.replayLongQuantity() * this.replayLongAvgPrice();
    return invested ? (this.longUnrealizedPnl() / invested) * 100 : 0;
  });

  shortUnrealizedPnl = computed(() => {
    if (!this.hasShort()) return 0;
    return (this.replayShortAvgPrice() - this.getCurrentPrice()) * this.replayShortQuantity();
  });

  shortUnrealizedPnlPercent = computed(() => {
    if (!this.hasShort()) return 0;
    const invested = this.replayShortQuantity() * this.replayShortAvgPrice();
    return invested ? (this.shortUnrealizedPnl() / invested) * 100 : 0;
  });

  // Gesamtwert aller Positionen (Long + Short)
  replayAssetValue = computed(() => this.longAssetValue() + this.shortAssetValue());

  // Gesamtbilanz: Cash + aktueller Wert der Longs - noch nicht getilgter Long-Kredit + Short-Wert (negativ)
  replayTotalBalance = computed(() => {
    return this.replayCashBalance() + this.longAssetValue() - this.replayLongDebt() + this.shortAssetValue();
  });

  replayUnrealizedPnl = computed(() => this.longUnrealizedPnl() + this.shortUnrealizedPnl());

  // Freie Margin = Eigenkapital - gebundene Margin
  freeMargin = computed(() => this.replayTotalBalance() - this.replayUsedMargin());

  // --------------------------------------------------------------------
  // UI-Zustände für Panels
  // --------------------------------------------------------------------
  tradePanelOpen = signal(false);
  tradePanelType = signal<'buy' | 'sell'>('buy');
  tradePanelPositionType = signal<'long' | 'short' | null>(null);
  tradeQuantityInput = 0;

  depositPanelOpen = signal(false);
  depositAmountInput = 0;

  // --------------------------------------------------------------------
  // Konstruktor
  // --------------------------------------------------------------------
  constructor() {
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });
  }

  // --------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------
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

  // --------------------------------------------------------------------
  // Daten laden
  // --------------------------------------------------------------------
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

  // --------------------------------------------------------------------
  // Chart (unverändert)
  // --------------------------------------------------------------------
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

    if (this.showEma50()) {
      this.ema50Series = this.chart.addLineSeries({
        color: '#2962ff',
        lineWidth: 2,
        title: 'EMA 50',
        lastValueVisible: true,
        priceLineVisible: false,
      });
    }

    if (this.showEma200()) {
      this.ema200Series = this.chart.addLineSeries({
        color: '#ff6d00',
        lineWidth: 2,
        title: 'EMA 200',
        lastValueVisible: true,
        priceLineVisible: false,
      });
    }

    window.addEventListener('resize', () => {
      if (this.chart && this.chartContainer) {
        this.chart.applyOptions({ width: this.chartContainer.nativeElement.clientWidth });
      }
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.userIsScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.userIsScrolling = false;
      }, 150);
    });

    this.reset();
  }

  reset() {
    this.stopPlayback();
    this.currentCandleIndex.set(0);
    this.updateChart();
  }

  updateChart() {
    if (!this.candleSeries || !this.chart) return;

    const index = this.currentCandleIndex();
    const visibleCandles = this.allCandles.slice(0, index);

    const chartData = visibleCandles.map((c) => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    this.candleSeries.setData(chartData);

    if (this.showEma50() && this.ema50Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map((c) => c.close);
      const ema50Values = this.calculateEMA(closePrices, 50);
      const ema50Data = visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema50Values[i],
      }));
      this.ema50Series.setData(ema50Data);
    }

    if (this.showEma200() && this.ema200Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map((c) => c.close);
      const ema200Values = this.calculateEMA(closePrices, 200);
      const ema200Data = visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema200Values[i],
      }));
      this.ema200Series.setData(ema200Data);
    }

    if (chartData.length === 0 || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) {
      ts.fitContent();
    } else {
      ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
    }
  }

  private calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    let sum = 0;
    for (let i = 0; i < Math.min(period, data.length); i++) {
      sum += data[i];
    }
    ema.push(sum / Math.min(period, data.length));

    for (let i = 1; i < data.length; i++) {
      const value = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(value);
    }

    return ema;
  }

  toggleEma50() {
    this.showEma50.update((v) => !v);
    if (this.chart) {
      if (this.showEma50()) {
        this.ema50Series = this.chart.addLineSeries({
          color: '#2962ff',
          lineWidth: 2,
          title: 'EMA 50',
          lastValueVisible: true,
          priceLineVisible: false,
        });
      } else if (this.ema50Series) {
        this.chart.removeSeries(this.ema50Series);
        this.ema50Series = null;
      }
      this.updateChart();
    }
  }

  toggleEma200() {
    this.showEma200.update((v) => !v);
    if (this.chart) {
      if (this.showEma200()) {
        this.ema200Series = this.chart.addLineSeries({
          color: '#ff6d00',
          lineWidth: 2,
          title: 'EMA 200',
          lastValueVisible: true,
          priceLineVisible: false,
        });
      } else if (this.ema200Series) {
        this.chart.removeSeries(this.ema200Series);
        this.ema200Series = null;
      }
      this.updateChart();
    }
  }

  // --------------------------------------------------------------------
  // Playback
  // --------------------------------------------------------------------
  togglePlay() {
    this.isPlaying() ? this.stopPlayback() : this.startPlayback();
  }

  startPlayback() {
    if (this.currentCandleIndex() >= this.totalCandles()) this.reset();
    this.isPlaying.set(true);
    this.playbackInterval = setInterval(() => {
      if (this.currentCandleIndex() >= this.totalCandles()) {
        this.stopPlayback();
        return;
      }
      this.stepForward();
    }, 1000 / this.playbackSpeed);
  }

  stopPlayback() {
    this.isPlaying.set(false);
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  stepForward() {
    if (this.currentCandleIndex() < this.totalCandles()) {
      this.currentCandleIndex.update((i) => i + 1);
      this.updateChart();
      this.updateUsedMargin();          // Margin bei Kursänderung aktualisieren
      this.checkLiquidation();          // Auf Liquidation prüfen
    }
  }

  stepBackward() {
    if (this.currentCandleIndex() > 1) {
      this.currentCandleIndex.update((i) => i - 1);
      this.updateChart();
      this.updateUsedMargin();
      this.checkLiquidation();
    }
  }

  skipToEnd() {
    this.currentCandleIndex.set(this.totalCandles());
    this.updateChart();
    this.updateUsedMargin();
    this.checkLiquidation();
    this.stopPlayback();
  }

  // --------------------------------------------------------------------
  // Hilfsfunktionen
  // --------------------------------------------------------------------
  getIntervalLabel(): string {
    return (
      this.availableIntervals().find((i) => i.value === this.selectedInterval)?.label ??
      this.selectedInterval
    );
  }

  getCurrentDate(): string {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return '';
    return new Date(this.allCandles[this.currentCandleIndex() - 1].timestamp).toLocaleString();
  }

  // --------------------------------------------------------------------
  // Portfolio-Reset
  // --------------------------------------------------------------------
  setReplayBalance() {
    const amount = Number(this.replayInitialBalanceInput);
    if (amount > 0) {
      this.replayInitialBalance = amount;
      this.replayCashBalance.set(amount);
    }
  }

  resetReplayPortfolio() {
    this.replayCashBalance.set(this.replayInitialBalance);
    this.replayLongQuantity.set(0);
    this.replayLongAvgPrice.set(0);
    this.replayLongDebt.set(0);
    this.replayShortQuantity.set(0);
    this.replayShortAvgPrice.set(0);
    this.replayRealizedPnl.set(0);
    this.replayTradeHistory.set([]);
    this.replayDepositHistory.set([]);
    this.replayUsedMargin.set(0);
    this.closeTradePanel();
    this.closeDepositPanel();
  }

  // --------------------------------------------------------------------
  // Einzahlungen
  // --------------------------------------------------------------------
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

    this.replayCashBalance.update((b) => b + amount);
    const newBalance = this.replayCashBalance();

    this.replayDepositHistory.update((h) => [
      { amount, timestamp: this.getCurrentDate(), newBalance },
      ...h,
    ]);

    console.log(`💰 Deposited $${amount.toFixed(2)} at ${this.getCurrentDate()}`);
    this.closeDepositPanel();
  }

  // --------------------------------------------------------------------
  // Trade-Panel
  // --------------------------------------------------------------------
  openTradePanel(type: 'buy' | 'sell', positionType: 'long' | 'short') {
    this.tradePanelType.set(type);
    this.tradePanelPositionType.set(positionType);
    this.tradeQuantityInput = 0;
    this.tradePanelOpen.set(true);
  }

  closeTradePanel() {
    this.tradePanelOpen.set(false);
    this.tradeQuantityInput = 0;
    this.tradePanelPositionType.set(null);
  }

  setTradePercent(percent: number) {
    const price = this.getCurrentPrice();
    if (price <= 0) return;

    const type = this.tradePanelType();
    const posType = this.tradePanelPositionType();
    const leverage = this.selectedLeverage();

    if ((type === 'buy' && posType === 'long') || (type === 'sell' && posType === 'short')) {
      // Eröffnung: basierend auf freier Margin
      const maxQuantity = (this.freeMargin() * leverage) / price;
      this.tradeQuantityInput = Math.floor(maxQuantity * (percent / 100) * 100000) / 100000;
    } else if (type === 'sell' && posType === 'long') {
      // Long reduzieren
      this.tradeQuantityInput = Math.floor(this.replayLongQuantity() * (percent / 100) * 100000) / 100000;
    } else if (type === 'buy' && posType === 'short') {
      // Short reduzieren (covern)
      this.tradeQuantityInput = Math.floor(this.replayShortQuantity() * (percent / 100) * 100000) / 100000;
    }
  }

  confirmTrade() {
    const price = this.getCurrentPrice();
    const qty = Number(this.tradeQuantityInput);
    if (qty <= 0 || price <= 0) return;

    const type = this.tradePanelType();
    const posType = this.tradePanelPositionType();

    if (!posType) return;

    if (type === 'buy' && posType === 'long') {
      this.increaseLong(qty, price);
    } else if (type === 'sell' && posType === 'long') {
      this.decreaseLong(qty, price);
    } else if (type === 'sell' && posType === 'short') {
      this.increaseShort(qty, price);
    } else if (type === 'buy' && posType === 'short') {
      this.decreaseShort(qty, price);
    }

    this.closeTradePanel();
  }

  // --------------------------------------------------------------------
  // Long-Operationen (mit Schulden)
  // --------------------------------------------------------------------
  private increaseLong(qty: number, price: number) {
    const totalCost = qty * price;
    const margin = totalCost / this.selectedLeverage();
    const loan = totalCost - margin;

    if (margin > this.replayCashBalance()) {
      alert('Insufficient cash for margin');
      return;
    }

    const currentQty = this.replayLongQuantity();
    const newQty = currentQty + qty;
    const newAvg = currentQty > 0
      ? (currentQty * this.replayLongAvgPrice() + qty * price) / newQty
      : price;

    this.replayLongQuantity.set(newQty);
    this.replayLongAvgPrice.set(newAvg);
    this.replayLongDebt.update(d => d + loan);
    this.replayCashBalance.update(b => b - margin);

    this.replayTradeHistory.update(h => [{
      type: 'buy',
      quantity: qty,
      price,
      total: totalCost,
      timestamp: this.getCurrentDate(),
      positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
  }

  private decreaseLong(qty: number, price: number) {
    if (qty > this.replayLongQuantity()) {
      alert('Cannot sell more than your long position');
      return;
    }

    const currentQty = this.replayLongQuantity();
    const currentAvg = this.replayLongAvgPrice();
    const currentDebt = this.replayLongDebt();

    const proportion = qty / currentQty;
    const repaidDebt = currentDebt * proportion;          // Anteiliger Kredit, der zurückgezahlt wird
    const proceeds = qty * price;                          // Verkaufserlös (voll)
    const realizedPnl = proceeds - qty * currentAvg;       // realisierter Gewinn/Verlust

    const newQty = currentQty - qty;
    const newAvg = newQty > 0 ? currentAvg : 0;
    const newDebt = currentDebt - repaidDebt;

    this.replayLongQuantity.set(newQty);
    this.replayLongAvgPrice.set(newAvg);
    this.replayLongDebt.set(newDebt);
    // Cash erhöht sich um den Nettoerlös (Verkaufserlös abzüglich des getilgten Kredits)
    this.replayCashBalance.update(b => b + (proceeds - repaidDebt));
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'sell',
      quantity: qty,
      price,
      total: proceeds,
      timestamp: this.getCurrentDate(),
      positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
  }

  // --------------------------------------------------------------------
  // Short-Operationen (ohne explizite Debt)
  // --------------------------------------------------------------------
  private increaseShort(qty: number, price: number) {
    const totalProceeds = qty * price;                      // voller Verkaufserlös
    const requiredMargin = totalProceeds / this.selectedLeverage();

    // Prüfen, ob genug Eigenkapital für die neue Gesamt-Margin vorhanden ist
    const currentLongMargin = (this.replayLongQuantity() * this.replayLongAvgPrice()) / this.selectedLeverage();
    const currentShortMargin = (this.replayShortQuantity() * this.replayShortAvgPrice()) / this.selectedLeverage();
    const newTotalMargin = currentLongMargin + currentShortMargin + requiredMargin;
    if (newTotalMargin > this.replayTotalBalance()) {
      alert('Insufficient equity for margin requirement');
      return;
    }

    const currentQty = this.replayShortQuantity();
    const newQty = currentQty + qty;
    const newAvg = currentQty > 0
      ? (currentQty * this.replayShortAvgPrice() + qty * price) / newQty
      : price;

    this.replayShortQuantity.set(newQty);
    this.replayShortAvgPrice.set(newAvg);
    // Cash um den vollen Verkaufserlös erhöhen
    this.replayCashBalance.update(b => b + totalProceeds);

    this.replayTradeHistory.update(h => [{
      type: 'sell',
      quantity: qty,
      price,
      total: totalProceeds,
      timestamp: this.getCurrentDate(),
      positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
  }

  private decreaseShort(qty: number, price: number) {
    if (qty > this.replayShortQuantity()) {
      alert('Cannot cover more than your short position');
      return;
    }

    const currentQty = this.replayShortQuantity();
    const currentAvg = this.replayShortAvgPrice();

    const costToCover = qty * price;                         // voller Rückkaufpreis
    const realizedPnl = (currentAvg - price) * qty;          // Gewinn, wenn Kurs gefallen

    const newQty = currentQty - qty;
    const newAvg = newQty > 0 ? currentAvg : 0;

    this.replayShortQuantity.set(newQty);
    this.replayShortAvgPrice.set(newAvg);
    // Cash um den vollen Rückkaufpreis reduzieren
    this.replayCashBalance.update(b => b - costToCover);
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'buy',
      quantity: qty,
      price,
      total: costToCover,
      timestamp: this.getCurrentDate(),
      positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
  }

  // --------------------------------------------------------------------
  // Margin & Liquidation
  // --------------------------------------------------------------------
  private updateUsedMargin() {
    const price = this.getCurrentPrice();
    if (price <= 0) return;
    const longMargin = (this.replayLongQuantity() * price) / this.selectedLeverage();
    const shortMargin = (this.replayShortQuantity() * price) / this.selectedLeverage();
    this.replayUsedMargin.set(longMargin + shortMargin);
  }

  private maintenanceMarginFactor = 0.1; // 50% der Initial Margin

  private checkLiquidation() {
    if (this.replayTotalBalance() < this.replayUsedMargin() * this.maintenanceMarginFactor) {
      // Liquidation: alle Positionen zum aktuellen Kurs schließen
      const price = this.getCurrentPrice();
      if (price <= 0) return;

      // Longs schließen
      if (this.hasLong()) {
        const qty = this.replayLongQuantity();
        const proceeds = qty * price;
        const costBasis = qty * this.replayLongAvgPrice();
        const realizedPnl = proceeds - costBasis;
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b + (proceeds - this.replayLongDebt()));
        this.replayLongQuantity.set(0);
        this.replayLongAvgPrice.set(0);
        this.replayLongDebt.set(0);
        this.replayTradeHistory.update(h => [{
          type: 'sell',
          quantity: qty,
          price,
          total: proceeds,
          timestamp: this.getCurrentDate(),
          positionType: 'long'
        }, ...h]);
      }

      // Shorts schließen
      if (this.hasShort()) {
        const qty = this.replayShortQuantity();
        const costToCover = qty * price;
        const costBasis = qty * this.replayShortAvgPrice();
        const realizedPnl = costBasis - costToCover;
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b - costToCover);
        this.replayShortQuantity.set(0);
        this.replayShortAvgPrice.set(0);
        this.replayTradeHistory.update(h => [{
          type: 'buy',
          quantity: qty,
          price,
          total: costToCover,
          timestamp: this.getCurrentDate(),
          positionType: 'short'
        }, ...h]);
      }

      this.replayUsedMargin.set(0);
      alert('⚠️ Liquidation! Alle Positionen wurden geschlossen.');
    }
  }

  // --------------------------------------------------------------------
  // Hilfsmethoden für UI
  // --------------------------------------------------------------------
  getPositionDescription(): string {
    const parts: string[] = [];
    if (this.hasLong()) {
      parts.push(`Long ${this.replayLongQuantity().toFixed(8)} ${this.selectedSymbol}`);
    }
    if (this.hasShort()) {
      parts.push(`Short ${this.replayShortQuantity().toFixed(8)} ${this.selectedSymbol}`);
    }
    return parts.length ? parts.join(' · ') : 'No Position';
  }

  isTradeDisabled(): boolean {
    return this.isPlaying() || !this.candlesLoaded() || this.getCurrentPrice() <= 0;
  }
}