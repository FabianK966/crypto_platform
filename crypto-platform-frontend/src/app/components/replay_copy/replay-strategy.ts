// replay-copy.component.ts
// Automatisierter Strategy-Replay: kauft/verkauft basierend auf RSI-Schwellen.
// Alle Strategie-Parameter sind über die Sidebar konfigurierbar.

import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  signal, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption, ReplaySaveRequest, StrategyConfig } from '../../models/replay.model';
import { createChart, IChartApi, IPriceLine, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ReplayTradingService } from '../replay/services/replay-trading.service';
import { ReplayPortfolioComponent } from '../replay/replay-portfolio/replay-portfolio';
import { ReplaySessionsModalComponent } from '../replay/replay-sessions-modal/replay-sessions-modal';
import { ReplayStrategyConfigSidebarComponent } from '../replay_copy/replay-strategy-config-sidebar/replay-strategy-config-sidebar';

// Log-Eintrag für automatisierte Trades
interface StrategyLogEntry {
  candle: number;
  action: string;
  price: number;
  qty: number;
  rsi: number;
  reason: string;
}

@Component({
  selector: 'app-replay-copy',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SelectModule, ButtonModule,
    ReplayPortfolioComponent,
    ReplaySessionsModalComponent,
    ReplayStrategyConfigSidebarComponent
  ],
  templateUrl: './replay-strategy.html',
  styleUrl: './replay-strategy.css',
  providers: [ReplayTradingService]
})
export class ReplayCopyComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;
  @ViewChild('rsiChartContainer') rsiChartContainer!: ElementRef;

  private replayService = inject(ReplayService);
  tradingService = inject(ReplayTradingService);

  // RSI
  private rsiChart: IChartApi | null = null;
  private rsiSeries: ISeriesApi<'Line'> | null = null;
  private rsiThreshold69Line: IPriceLine | null = null;
  private rsiThreshold31Line: IPriceLine | null = null;
  showRSI = signal(true);
  currentRSI = signal<number | null>(null);
  private readonly RSI_PERIOD = 14;

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
    { label: '5x', value: 5 }, { label: '10x', value: 10 },
    { label: '25x', value: 25 }, { label: '50x', value: 50 },
    { label: '100x', value: 100 }, { label: '500x', value: 500 }
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

  // Session-Speichern
  isSaving = signal(false);
  saveSuccess = signal(false);
  savedSessionId = signal<string | null>(null);
  showSessionsModal = signal(false);

  // Startkapital (eingefroren beim Laden)
  replayStartBalance = 10000;

  // ── Strategie ────────────────────────────────────────────────────
  strategyConfig: StrategyConfig = {
    rsiBuyThreshold: 30,
    rsiSellThreshold: 70,
    buyPortfolioPercent: 10,
    closePositionPercent: 50,
    cooldownCandles: 10,
    autoShortEnabled: true
  };

  // Cooldown-Zähler: startet bei cooldownCandles damit der erste Trade sofort möglich ist
  private candlesSinceLastTrade = 99;
  strategyLog = signal<StrategyLogEntry[]>([]);
  showStrategyLog = signal(false);
  strategyTradeCount = signal(0);

  constructor() {
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });
    effect(() => {
      if (this.tradingService.liquidationTriggered()) {
        this.stopPlayback();
        alert('⚠️ Liquidation! Alle Positionen wurden zwangsgeschlossen. Strategie gestoppt.');
        this.tradingService.liquidationTriggered.set(false);
      }
    });
  }

  ngOnInit() { this.loadAvailableOptions(); }

  ngOnDestroy() {
    document.body.style.overflowY = '';
    clearTimeout(this.scrollTimeout);
    this.stopPlayback();
    if (this.chart) this.chart.remove();
    if (this.rsiChart) this.rsiChart.remove();
  }

  loadAvailableOptions() {
    this.replayService.getAvailableSymbols().subscribe({
      next: s => this.availableSymbols.set(s),
      error: e => console.error('Symbols:', e)
    });
    this.replayService.getAvailableIntervals().subscribe({
      next: i => this.availableIntervals.set(i),
      error: e => console.error('Intervals:', e)
    });
  }

  onConfigChange(config: { symbol: string; interval: string; startDate: string; endDate: string; leverage: number }) {
    this.selectedSymbol = config.symbol;
    this.selectedInterval = config.interval;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.tradingService.selectedLeverage.set(config.leverage);
  }

  onStrategyChange(config: StrategyConfig) {
    this.strategyConfig = { ...config };
    // Cooldown zurücksetzen, damit die neue Einstellung sofort gilt
    this.candlesSinceLastTrade = config.cooldownCandles;
  }

  loadReplayData() {
    this.loading.set(true);
    this.error.set(null);
    this.stopPlayback();
    this.saveSuccess.set(false);
    this.savedSessionId.set(null);
    this.strategyLog.set([]);
    this.strategyTradeCount.set(0);
    this.candlesSinceLastTrade = 99; // erstes Signal sofort auslösen

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
        // Startkapital einfrieren
        this.replayStartBalance = this.tradingService.replayInitialBalance;
        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Fehler beim Laden der Daten');
        this.loading.set(false);
      }
    });
  }

  // ── Strategie-Logik ──────────────────────────────────────────────

  /**
   * Wird nach jedem stepForward() aufgerufen.
   * Regeln:
   *  • RSI < buyThreshold   → Short covern (falls offen) ODER Long öffnen
   *  • RSI > sellThreshold  → Long schließen (falls offen) ODER Short öffnen (falls aktiviert)
   *  • Nach jedem Trade: cooldownCandles Pause
   *  • Nicht genug Balance / Menge zu klein → Trade wird übersprungen (kein Cooldown)
   *  • Preis = 0 oder RSI nicht verfügbar → überspringen
   */
  private checkStrategyTrade(): void {
    const rsi = this.currentRSI();
    if (rsi === null) return;

    const price = this.getCurrentPrice();
    if (price <= 0) return;

    const ts = this.tradingService;

    // Cooldown läuft noch
    if (this.candlesSinceLastTrade < this.strategyConfig.cooldownCandles) {
      this.candlesSinceLastTrade++;
      return;
    }

    const cfg = this.strategyConfig;
    let tradeDone = false;

    // ── OVERSOLD: RSI < Kauf-Schwelle ────────────────────────────
    if (rsi < cfg.rsiBuyThreshold) {

      if (ts.hasShort()) {
        // Short-Position teilweise schließen (Cover)
        const closeQty = ts.replayShortQuantity() * (cfg.closePositionPercent / 100);
        if (closeQty >= 0.000001 && ts.decreaseShort(closeQty, price)) {
          this.logTrade('SHORT COVER', price, closeQty, rsi,
            `RSI ${rsi.toFixed(1)} < ${cfg.rsiBuyThreshold} (Oversold)`);
          tradeDone = true;
        }
      } else {
        // Long öffnen
        const investAmount = ts.replayTotalBalance() * (cfg.buyPortfolioPercent / 100);
        const qty = (investAmount * ts.selectedLeverage()) / price;
        if (qty >= 0.000001 && ts.increaseLong(qty, price)) {
          this.logTrade('BUY LONG', price, qty, rsi,
            `RSI ${rsi.toFixed(1)} < ${cfg.rsiBuyThreshold} (Oversold)`);
          tradeDone = true;
        }
      }
    }

    // ── OVERBOUGHT: RSI > Verkauf-Schwelle ───────────────────────
    else if (rsi > cfg.rsiSellThreshold) {

      if (ts.hasLong()) {
        // Long-Position teilweise schließen
        const closeQty = ts.replayLongQuantity() * (cfg.closePositionPercent / 100);
        if (closeQty >= 0.000001 && ts.decreaseLong(closeQty, price)) {
          this.logTrade('SELL LONG', price, closeQty, rsi,
            `RSI ${rsi.toFixed(1)} > ${cfg.rsiSellThreshold} (Overbought)`);
          tradeDone = true;
        }
      } else if (cfg.autoShortEnabled) {
        // Short öffnen (kein Long offen)
        const investAmount = ts.replayTotalBalance() * (cfg.buyPortfolioPercent / 100);
        const qty = (investAmount * ts.selectedLeverage()) / price;
        if (qty >= 0.000001 && ts.increaseShort(qty, price)) {
          this.logTrade('OPEN SHORT', price, qty, rsi,
            `RSI ${rsi.toFixed(1)} > ${cfg.rsiSellThreshold} (Overbought, Auto-Short)`);
          tradeDone = true;
        }
      }
    }

    if (tradeDone) {
      this.candlesSinceLastTrade = 0;
      this.strategyTradeCount.update(n => n + 1);
    } else {
      // Kein Trade aber kein aktiver Cooldown → Zähler weiter hochsetzen
      // (verhindert, dass der Counter einfriert wenn nie gehandelt wird)
      this.candlesSinceLastTrade = Math.min(
        this.candlesSinceLastTrade + 1,
        this.strategyConfig.cooldownCandles + 1
      );
    }
  }

  private logTrade(action: string, price: number, qty: number, rsi: number, reason: string) {
    const entry: StrategyLogEntry = {
      candle: this.currentCandleIndex(),
      action, price, qty, rsi, reason
    };
    this.strategyLog.update(log => [entry, ...log]);
  }

  // ── Wiedergabe-Steuerung ─────────────────────────────────────────

  reset() {
    this.stopPlayback();
    this.currentCandleIndex.set(0);
    this.candlesSinceLastTrade = 99;
    this.strategyLog.set([]);
    this.strategyTradeCount.set(0);
    this.tradingService.resetPortfolio();
    this.updateChart();
  }

  togglePlay() { this.isPlaying() ? this.stopPlayback() : this.startPlayback(); }

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
      this.currentCandleIndex.update(i => i + 1);
      this.updateChart();
      this.updateTradingService();
      this.checkStrategyTrade();          // ← Strategie-Check
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

  // ── Session speichern ────────────────────────────────────────────

  saveSession() {
    if (!this.candlesLoaded() || this.isSaving()) return;
    this.isSaving.set(true);
    this.saveSuccess.set(false);

    const ts = this.tradingService;
    const payload: ReplaySaveRequest = {
      sessionType: 'strategy',        // ← immer 'strategy' in dieser Komponente
      symbol: this.selectedSymbol,
      intervalValue: this.selectedInterval,
      startTime: new Date(this.startDate).getTime(),
      endTime: new Date(this.endDate).getTime(),
      leverage: ts.selectedLeverage(),
      initialBalance: ts.replayInitialBalance,
      startBalance: this.replayStartBalance,
      finalCashBalance: ts.replayCashBalance(),
      totalBalance: ts.replayTotalBalance(),
      realizedPnl: ts.replayRealizedPnl(),
      totalFees: ts.totalFees(),
      longQuantity: ts.replayLongQuantity(),
      longAvgPrice: ts.replayLongAvgPrice(),
      longDebt: ts.replayLongDebt(),
      shortQuantity: ts.replayShortQuantity(),
      shortAvgPrice: ts.replayShortAvgPrice(),
      currentCandle: this.currentCandleIndex(),
      totalCandles: this.totalCandles(),
      tradeHistory: ts.replayTradeHistory(),
      depositHistory: ts.replayDepositHistory()
    };

    this.replayService.saveSession(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        this.savedSessionId.set(res.id);
        setTimeout(() => this.saveSuccess.set(false), 4000);
      },
      error: () => {
        this.isSaving.set(false);
        this.error.set('Fehler beim Speichern der Session');
      }
    });
  }

  // ── Chart-Initialisierung ────────────────────────────────────────

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
      color: '#9c27b0', lineWidth: 2,
      title: `RSI (${this.RSI_PERIOD})`,
      priceLineVisible: false, lastValueVisible: true
    });
    this.rsiThreshold69Line = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.rsiSellThreshold,
      color: '#ef5350', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `Sell (${this.strategyConfig.rsiSellThreshold})`
    });
    this.rsiThreshold31Line = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.rsiBuyThreshold,
      color: '#26a69a', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `Buy (${this.strategyConfig.rsiBuyThreshold})`
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (this.rsiChart && !this.userIsScrolling && range)
        this.rsiChart.timeScale().setVisibleLogicalRange(range);
    });
    this.rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (this.chart && !this.userIsScrolling && range)
        this.chart.timeScale().setVisibleLogicalRange(range);
    });
    window.addEventListener('resize', () => {
      if (this.chart && this.chartContainer)
        this.chart.applyOptions({ width: this.chartContainer.nativeElement.clientWidth });
    });
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.userIsScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => { this.userIsScrolling = false; }, 150);
    });

    this.reset();
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
      const ema50 = this.calculateEMA(visibleCandles.map(c => c.close), 50);
      this.ema50Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time, value: ema50[i]
      })));
    }
    if (this.showEma200() && this.ema200Series && visibleCandles.length > 0) {
      const ema200 = this.calculateEMA(visibleCandles.map(c => c.close), 200);
      this.ema200Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time, value: ema200[i]
      })));
    }
    if (this.showRSI() && this.rsiSeries && visibleCandles.length > this.RSI_PERIOD) {
      const rsiValues = this.calculateRSI(visibleCandles.map(c => c.close), this.RSI_PERIOD);
      if (rsiValues.length > 0) {
        this.rsiSeries.setData(rsiValues.map((value, i) => ({
          time: (visibleCandles[i + this.RSI_PERIOD].timestamp / 1000) as Time, value
        })));
        this.currentRSI.set(rsiValues[rsiValues.length - 1]);
      } else { this.currentRSI.set(null); }
    } else { this.currentRSI.set(null); }

    this.updateEntryPriceLines();

    if (chartData.length === 0 || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) ts.fitContent();
    else ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
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
      } else { this.longEntryPriceLine.applyOptions({ price: longAvg }); }
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
      } else { this.shortEntryPriceLine.applyOptions({ price: shortAvg }); }
    } else if (this.shortEntryPriceLine) {
      this.candleSeries.removePriceLine(this.shortEntryPriceLine);
      this.shortEntryPriceLine = null;
    }
  }

  private calculateEMA(data: number[], period: number): number[] {
    if (!data.length) return [];
    const ema: number[] = [];
    const m = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i];
    ema.push(sum / Math.min(period, data.length));
    for (let i = 1; i < data.length; i++)
      ema.push((data[i] - ema[i - 1]) * m + ema[i - 1]);
    return ema;
  }

  private calculateRSI(prices: number[], period = this.RSI_PERIOD): number[] {
    if (prices.length < period + 1) return [];
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const d = prices[i] - prices[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    let ag = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let al = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const rsi: number[] = [al === 0 ? 100 : 100 - 100 / (1 + ag / al)];
    for (let i = period; i < gains.length; i++) {
      ag = (ag * (period - 1) + gains[i]) / period;
      al = (al * (period - 1) + losses[i]) / period;
      rsi.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    }
    return rsi;
  }

  toggleEma50() {
    this.showEma50.update(v => !v);
    if (this.chart) {
      if (this.showEma50()) {
        this.ema50Series = this.chart.addLineSeries({
          color: '#2962ff', lineWidth: 2, title: 'EMA 50',
          lastValueVisible: true, priceLineVisible: false
        });
      } else if (this.ema50Series) { this.chart.removeSeries(this.ema50Series); this.ema50Series = null; }
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
      } else if (this.ema200Series) { this.chart.removeSeries(this.ema200Series); this.ema200Series = null; }
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
          priceLineVisible: false, lastValueVisible: true
        });
        this.rsiThreshold69Line = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.rsiSellThreshold, color: '#ef5350',
          lineStyle: 2, axisLabelVisible: true, title: `Sell (${this.strategyConfig.rsiSellThreshold})`
        });
        this.rsiThreshold31Line = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.rsiBuyThreshold, color: '#26a69a',
          lineStyle: 2, axisLabelVisible: true, title: `Buy (${this.strategyConfig.rsiBuyThreshold})`
        });
      } else if (this.rsiSeries) {
        this.rsiChart.removeSeries(this.rsiSeries);
        this.rsiSeries = null;
        this.rsiThreshold69Line = this.rsiThreshold31Line = null;
      }
      this.updateChart();
    }
  }

  private updateTradingService() {
    this.tradingService.setCurrentPrice(this.getCurrentPrice(), this.getCurrentDate());
    this.tradingService.updateUsedMargin();
  }

  getIntervalLabel(): string {
    return this.availableIntervals().find(i => i.value === this.selectedInterval)?.label ?? this.selectedInterval;
  }

  getCurrentDate(): string {
    if (!this.currentCandleIndex() || !this.allCandles.length) return '';
    return new Date(this.allCandles[this.currentCandleIndex() - 1].timestamp).toLocaleString();
  }

  getCurrentPrice(): number {
    if (!this.currentCandleIndex() || !this.allCandles.length) return 0;
    return this.allCandles[this.currentCandleIndex() - 1].close;
  }

  // Cooldown-Anzeige in %
  cooldownProgress(): number {
    const c = Math.min(this.candlesSinceLastTrade, this.strategyConfig.cooldownCandles);
    return Math.round((c / this.strategyConfig.cooldownCandles) * 100);
  }

  cooldownRemaining(): number {
    return Math.max(0, this.strategyConfig.cooldownCandles - this.candlesSinceLastTrade);
  }
  toggleStrategyLog() {
    this.showStrategyLog.update(v => !v);
  }
}
