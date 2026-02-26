// src/app/components/replay/replay.component.ts
// Hauptkomponente für das Replay-/Backtesting-Modul.
// Verwaltet Chart, Daten laden, Wiedergabesteuerung, Indikatoren (EMA, RSI) und integriert das Trading-Portfolio.

import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  signal, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption, ReplaySaveRequest } from '../../models/replay.model';
import { createChart, IChartApi, IPriceLine, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ReplayTradingService } from './services/replay-trading.service';
import { ReplayPortfolioComponent } from './replay-portfolio/replay-portfolio';
import { ReplayConfigSidebarComponent } from './replay-config-sidebar/replay-config-sidebar';
import { ReplaySessionsModalComponent } from './replay-sessions-modal/replay-sessions-modal';

@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SelectModule, ButtonModule,
    ReplayPortfolioComponent, ReplayConfigSidebarComponent,
    ReplaySessionsModalComponent,  
  ],
  templateUrl: './replay.html',
  styleUrl: './replay.css',
  providers: [ReplayTradingService]
})
export class ReplayComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;
  @ViewChild('rsiChartContainer') rsiChartContainer!: ElementRef;

  private replayService = inject(ReplayService);
  tradingService = inject(ReplayTradingService);

  // RSI-spezifische Eigenschaften
  private rsiChart: IChartApi | null = null;
  private rsiSeries: ISeriesApi<'Line'> | null = null;
  private rsiThreshold69Line: IPriceLine | null = null;
  private rsiThreshold31Line: IPriceLine | null = null;
  showRSI = signal(true);
  currentRSI = signal<number | null>(null);
  private readonly RSI_PERIOD = 14;

  // Durchschnittliche Einstiegspreise (Linien im Chart)
  private longEntryPriceLine: IPriceLine | null = null;
  private shortEntryPriceLine: IPriceLine | null = null;

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private ema50Series: ISeriesApi<'Line'> | null = null;
  private ema200Series: ISeriesApi<'Line'> | null = null;

  private readonly VISIBLE_CANDLES = 1000;
  private readonly FIT_THRESHOLD = 1000;
  private userIsScrolling = false;
  private scrollTimeout: any = null;

  allCandles: CandleData[] = [];
  availableSymbols = signal<string[]>([]);
  availableIntervals = signal<IntervalOption[]>([]);

  speedOptions = [
    { label: '0.5x', value: 0.5 }, { label: '1x', value: 1 },
    { label: '2x', value: 2 }, { label: '3x', value: 3 },
    { label: '5x', value: 5 }, { label: '10x', value: 10 }
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
  showEma50 = signal(true);
  showEma200 = signal(true);
  isPlaying = signal(false);
  playbackSpeed = 1;
  private playbackInterval: any = null;

  // ── NEU: Session-Speichern-Zustand ───────────────────────────────
  isSaving = signal(false);
  saveSuccess = signal(false);
  savedSessionId = signal<string | null>(null);
  showSessionsModal = signal(false);   // NEU: Modal-Sichtbarkeit

  constructor() {
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });

    effect(() => {
      if (this.tradingService.liquidationTriggered()) {
        this.stopPlayback();
        alert('⚠️ Liquidation! All positions closed.');
        this.tradingService.liquidationTriggered.set(false);
      }
    });
  }

  ngOnInit() {
    this.loadAvailableOptions();
  }

  ngOnDestroy() {
    document.body.style.overflowY = '';
    clearTimeout(this.scrollTimeout);
    this.stopPlayback();
    if (this.chart) this.chart.remove();
    if (this.rsiChart) this.rsiChart.remove();
  }

  loadAvailableOptions() {
    this.replayService.getAvailableSymbols().subscribe({
      next: (symbols) => this.availableSymbols.set(symbols),
      error: (err) => console.error('Failed to load symbols:', err)
    });
    this.replayService.getAvailableIntervals().subscribe({
      next: (intervals) => this.availableIntervals.set(intervals),
      error: (err) => console.error('Failed to load intervals:', err)
    });
  }

  onConfigChange(config: { symbol: string; interval: string; startDate: string; endDate: string; leverage: number }) {
    this.selectedSymbol = config.symbol;
    this.selectedInterval = config.interval;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.tradingService.selectedLeverage.set(config.leverage);
  }

  loadReplayData() {
    this.loading.set(true);
    this.error.set(null);
    this.stopPlayback();
    // Altes Save-Feedback zurücksetzen wenn neue Daten geladen werden
    this.saveSuccess.set(false);
    this.savedSessionId.set(null);

    const config: ReplayConfig = {
      symbol: this.selectedSymbol,
      interval: this.selectedInterval,
      startTime: new Date(this.startDate).getTime(),
      endTime: new Date(this.endDate).getTime()
    };

    this.replayService.getCandles(config).subscribe({
      next: (response) => {
        this.allCandles = response.candles;
        this.totalCandles.set(response.candles.length);
        this.candlesLoaded.set(true);
        this.currentCandleIndex.set(0);
        this.loading.set(false);
        this.tradingService.resetPortfolio();
        this.tradingService.replayStartBalance = this.tradingService.replayInitialBalance;
        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load historical data');
        this.loading.set(false);
      }
    });
  }

  // ── NEU: Session in DB speichern ──────────────────────────────────
  /**
   * Sammelt den gesamten aktuellen Zustand und sendet ihn ans Backend.
   * Das Backend vergibt eine neue UUID – jeder Klick erzeugt einen eigenen Eintrag.
   */
  saveSession() {
    if (!this.candlesLoaded() || this.isSaving()) return;

    this.isSaving.set(true);
    this.saveSuccess.set(false);

    const ts = this.tradingService;

    const payload: ReplaySaveRequest = {
        // Konfiguration
        symbol: this.selectedSymbol,
        intervalValue: this.selectedInterval,
        startTime: new Date(this.startDate).getTime(),
        endTime: new Date(this.endDate).getTime(),
        leverage: ts.selectedLeverage(),

        // Portfolio-Snapshot (rohe Zahlen aus den Signalen)
        initialBalance: ts.replayStartBalance,
        finalCashBalance: ts.replayCashBalance(),
        totalBalance: ts.replayTotalBalance(),
        realizedPnl: ts.replayRealizedPnl(),
        totalFees: ts.totalFees(),

        // Positionen
        longQuantity: ts.replayLongQuantity(),
        longAvgPrice: ts.replayLongAvgPrice(),
        longDebt: ts.replayLongDebt(),
        shortQuantity: ts.replayShortQuantity(),
        shortAvgPrice: ts.replayShortAvgPrice(),

        // Fortschritt
        currentCandle: this.currentCandleIndex(),
        totalCandles: this.totalCandles(),

        // Historien
        tradeHistory: ts.replayTradeHistory(),
        depositHistory: ts.replayDepositHistory(),
        startBalance: 0
    };

    this.replayService.saveSession(payload).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        this.savedSessionId.set(response.id);
        console.log('✅ Session gespeichert:', response.id);
        // Erfolgsmeldung nach 4 Sekunden ausblenden
        setTimeout(() => this.saveSuccess.set(false), 4000);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('❌ Fehler beim Speichern:', err);
        this.error.set('Fehler beim Speichern der Session');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────

  initializeChart() {
    if (this.chart) this.chart.remove();

    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 600,
      layout: { background: { color: '#0a0a0a' }, textColor: '#999' },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' }
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });

    if (this.showEma50()) {
      this.ema50Series = this.chart.addLineSeries({
        color: '#2962ff', lineWidth: 2, title: 'EMA 50',
        lastValueVisible: true, priceLineVisible: false
      });
    }

    if (this.showEma200()) {
      this.ema200Series = this.chart.addLineSeries({
        color: '#ff6d00', lineWidth: 2, title: 'EMA 200',
        lastValueVisible: true, priceLineVisible: false
      });
    }

    this.longEntryPriceLine = null;
    this.shortEntryPriceLine = null;

    if (this.rsiChart) this.rsiChart.remove();
    this.rsiChart = createChart(this.rsiChartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 150,
      layout: { background: { color: '#0a0a0a' }, textColor: '#999' },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' }
    });

    this.rsiSeries = this.rsiChart.addLineSeries({
      color: '#9c27b0',
      lineWidth: 2,
      title: `RSI (${this.RSI_PERIOD})`,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    this.rsiThreshold69Line = this.rsiSeries.createPriceLine({
      price: 69, color: '#ef5350', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: 'Overbought (69)',
    });
    this.rsiThreshold31Line = this.rsiSeries.createPriceLine({
      price: 31, color: '#26a69a', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: 'Oversold (31)',
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (this.rsiChart && !this.userIsScrolling && range) {
        this.rsiChart.timeScale().setVisibleLogicalRange(range);
      }
    });
    this.rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (this.chart && !this.userIsScrolling && range) {
        this.chart.timeScale().setVisibleLogicalRange(range);
      }
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
      this.currentCandleIndex.update(i => i + 1);
      this.updateChart();
      this.updateTradingService();
      this.tradingService.checkLiquidation();
    }
  }

  stepBackward() {
    if (this.currentCandleIndex() > 1) {
      this.currentCandleIndex.update(i => i - 1);
      this.updateChart();
      this.updateTradingService();
    }
  }

  skipToEnd() {
    this.currentCandleIndex.set(this.totalCandles());
    this.updateChart();
    this.updateTradingService();
    this.stopPlayback();
  }

  updateChart() {
    if (!this.candleSeries || !this.chart) return;

    const index = this.currentCandleIndex();
    const visibleCandles = this.allCandles.slice(0, index);
    const chartData = visibleCandles.map(c => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close
    }));

    this.candleSeries.setData(chartData);

    if (this.showEma50() && this.ema50Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map(c => c.close);
      const ema50Values = this.calculateEMA(closePrices, 50);
      this.ema50Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema50Values[i]
      })));
    }

    if (this.showEma200() && this.ema200Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map(c => c.close);
      const ema200Values = this.calculateEMA(closePrices, 200);
      this.ema200Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema200Values[i]
      })));
    }

    if (this.showRSI() && this.rsiSeries && visibleCandles.length > this.RSI_PERIOD) {
      const closePrices = visibleCandles.map(c => c.close);
      const rsiValues = this.calculateRSI(closePrices, this.RSI_PERIOD);
      if (rsiValues.length > 0) {
        const rsiData = rsiValues.map((value, i) => ({
          time: (visibleCandles[i + this.RSI_PERIOD].timestamp / 1000) as Time,
          value: value,
        }));
        this.rsiSeries.setData(rsiData);
        this.currentRSI.set(rsiValues[rsiValues.length - 1]);
      } else {
        this.currentRSI.set(null);
      }
    } else {
      this.currentRSI.set(null);
    }

    this.updateEntryPriceLines();

    if (chartData.length === 0 || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) {
      ts.fitContent();
    } else {
      ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
    }
  }

  private updateEntryPriceLines() {
    if (!this.candleSeries) return;

    const longQty = this.tradingService.replayLongQuantity();
    const longAvg = this.tradingService.replayLongAvgPrice();
    const shortQty = this.tradingService.replayShortQuantity();
    const shortAvg = this.tradingService.replayShortAvgPrice();

    if (longQty > 0 && longAvg > 0) {
      if (!this.longEntryPriceLine) {
        this.longEntryPriceLine = this.candleSeries.createPriceLine({
          price: longAvg, color: '#26a69a', lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Long Avg'
        });
      } else {
        this.longEntryPriceLine.applyOptions({ price: longAvg });
      }
    } else if (this.longEntryPriceLine) {
      this.candleSeries.removePriceLine(this.longEntryPriceLine);
      this.longEntryPriceLine = null;
    }

    if (shortQty > 0 && shortAvg > 0) {
      if (!this.shortEntryPriceLine) {
        this.shortEntryPriceLine = this.candleSeries.createPriceLine({
          price: shortAvg, color: '#ef5350', lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Short Avg'
        });
      } else {
        this.shortEntryPriceLine.applyOptions({ price: shortAvg });
      }
    } else if (this.shortEntryPriceLine) {
      this.candleSeries.removePriceLine(this.shortEntryPriceLine);
      this.shortEntryPriceLine = null;
    }
  }

  private calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i];
    ema.push(sum / Math.min(period, data.length));
    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
    return ema;
  }

  toggleEma50() {
    this.showEma50.update(v => !v);
    if (this.chart) {
      if (this.showEma50()) {
        this.ema50Series = this.chart.addLineSeries({
          color: '#2962ff', lineWidth: 2, title: 'EMA 50',
          lastValueVisible: true, priceLineVisible: false
        });
      } else if (this.ema50Series) {
        this.chart.removeSeries(this.ema50Series);
        this.ema50Series = null;
      }
      this.updateChart();
    }
  }

  toggleEma200() {
    this.showEma200.update(v => !v);
    if (this.chart) {
      if (this.showEma200()) {
        this.ema200Series = this.chart.addLineSeries({
          color: '#ff6d00', lineWidth: 2, title: 'EMA 200',
          lastValueVisible: true, priceLineVisible: false
        });
      } else if (this.ema200Series) {
        this.chart.removeSeries(this.ema200Series);
        this.ema200Series = null;
      }
      this.updateChart();
    }
  }

  toggleRSI() {
    this.showRSI.update(v => !v);
    if (this.rsiChart) {
      if (this.showRSI()) {
        this.rsiSeries = this.rsiChart.addLineSeries({
          color: '#9c27b0', lineWidth: 2,
          title: `RSI (${this.RSI_PERIOD})`,
          priceLineVisible: false, lastValueVisible: true,
        });
        this.rsiThreshold69Line = this.rsiSeries.createPriceLine({
          price: 69, color: '#ef5350', lineStyle: 2,
          axisLabelVisible: true, title: 'Overbought (69)',
        });
        this.rsiThreshold31Line = this.rsiSeries.createPriceLine({
          price: 31, color: '#26a69a', lineStyle: 2,
          axisLabelVisible: true, title: 'Oversold (31)',
        });
      } else if (this.rsiSeries) {
        this.rsiChart.removeSeries(this.rsiSeries);
        this.rsiSeries = null;
        this.rsiThreshold69Line = null;
        this.rsiThreshold31Line = null;
      }
      this.updateChart();
    }
  }

  private calculateRSI(prices: number[], period: number = this.RSI_PERIOD): number[] {
    if (prices.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }

    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    const rsi: number[] = [];
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      rsi.push(100 - 100 / (1 + avgGain / avgLoss));
    }

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - 100 / (1 + rs));
      }
    }
    return rsi;
  }

  private updateTradingService() {
    const price = this.getCurrentPrice();
    const timestamp = this.getCurrentDate();
    this.tradingService.setCurrentPrice(price, timestamp);
    this.tradingService.updateUsedMargin();
  }

  getIntervalLabel(): string {
    return this.availableIntervals().find(i => i.value === this.selectedInterval)?.label ?? this.selectedInterval;
  }

  getCurrentDate(): string {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return '';
    return new Date(this.allCandles[this.currentCandleIndex() - 1].timestamp).toLocaleString();
  }

  getCurrentPrice(): number {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return 0;
    return this.allCandles[this.currentCandleIndex() - 1].close;
  }
}