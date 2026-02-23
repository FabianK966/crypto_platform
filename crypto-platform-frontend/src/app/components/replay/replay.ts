// src/app/components/replay/replay.component.ts

import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  signal, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption } from '../../models/replay.model';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ReplayTradingService } from './services/replay-trading.service';
import { ReplayPortfolioComponent } from './replay-portfolio/replay-portfolio';
import { ReplayConfigSidebarComponent } from './replay-config-sidebar/replay-config-sidebar';
@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SelectModule, ButtonModule,
    ReplayPortfolioComponent, ReplayConfigSidebarComponent
  ],
  templateUrl: './replay.html',
  styleUrl: './replay.css',
  providers: [ReplayTradingService]
})
export class ReplayComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private replayService = inject(ReplayService);
  tradingService = inject(ReplayTradingService);

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
    if (this.chart) this.chart.remove();
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
        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load historical data');
        this.loading.set(false);
      }
    });
  }

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
      if (this.tradingService.checkLiquidation()) {
        alert('⚠️ Liquidation! All positions closed.');
      }
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
        time: (c.timestamp / 1000) as Time, value: ema50Values[i]
      })));
    }

    if (this.showEma200() && this.ema200Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map(c => c.close);
      const ema200Values = this.calculateEMA(closePrices, 200);
      this.ema200Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time, value: ema200Values[i]
      })));
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