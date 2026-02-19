// src/app/components/replay/replay.component.ts

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption } from '../../models/replay.model';
import { 
  createChart, 
  IChartApi,
  ISeriesApi,
  Time
} from 'lightweight-charts';

// PrimeNG Dropdown (funktioniert besser als native select)
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, DatePickerModule],
  template: `
    <div class="replay-container">
      <!-- Configuration Panel -->
      <div class="config-panel">
        <div class="config-header">
          <h2>📊 Replay Backtesting</h2>
          <div class="status-badge" [ngClass]="isPlaying() ? 'playing' : 'paused'">
            {{ isPlaying() ? '▶️ Playing' : '⏸️ Paused' }}
          </div>
        </div>

        <div class="config-grid">
          <!-- Symbol Selection -->
          <div class="input-group">
            <label>Symbol</label>
            <p-select
              [options]="symbolOptions()"
              [(ngModel)]="selectedSymbol"
              optionLabel="label"
              optionValue="value"
              placeholder="Select Symbol"
              [style]="{'width': '100%'}"
              appendTo="body"
            />
          </div>

          <!-- Interval Selection -->
          <div class="input-group">
            <label>Timeframe</label>
            <p-select
              [options]="availableIntervals()"
              [(ngModel)]="selectedInterval"
              optionLabel="label"
              optionValue="value"
              placeholder="Select Timeframe"
              [style]="{'width': '100%'}"
              appendTo="body"
            />
          </div>

          <!-- Start Date -->
          <div class="input-group">
            <label>Start Date</label>
            <input 
              type="date" 
              [(ngModel)]="startDate"
              [max]="endDate"
              class="input-field"
            />
          </div>

          <!-- End Date -->
          <div class="input-group">
            <label>End Date</label>
            <input 
              type="date" 
              [(ngModel)]="endDate"
              [min]="startDate"
              [max]="today"
              class="input-field"
            />
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <p-button
            label="Load Data"
            icon="pi pi-refresh"
            [loading]="loading()"
            (onClick)="loadReplayData()"
            styleClass="p-button-primary"
          />

          @if (candlesLoaded()) {
            <div class="candle-info">
              ✅ {{ totalCandles() }} candles loaded
            </div>
          }
        </div>

        @if (error()) {
          <div class="error-message">
            <i class="pi pi-exclamation-triangle"></i>
            {{ error() }}
          </div>
        }
      </div>

      <!-- Chart Container -->
      <div class="chart-section">
        <div class="chart-header">
          <h3>{{ selectedSymbol }}/USDT - {{ getIntervalLabel() }}</h3>
          <div class="chart-info">
            @if (currentCandleIndex() > 0) {
              <span>Candle {{ currentCandleIndex() }} / {{ totalCandles() }}</span>
              <span class="separator">•</span>
              <span>{{ getCurrentDate() }}</span>
            }
          </div>
        </div>

        <div #chartContainer class="chart-container"></div>

        <!-- Replay Controls -->
        @if (candlesLoaded()) {
          <div class="replay-controls">
            <p-button
              icon="pi pi-step-backward"
              (onClick)="reset()"
              [outlined]="true"
              severity="secondary"
            />

            <p-button
              icon="pi pi-backward"
              (onClick)="stepBackward()"
              [disabled]="currentCandleIndex() <= 1"
              [outlined]="true"
              severity="secondary"
            />

            <p-button
              [icon]="isPlaying() ? 'pi pi-pause' : 'pi pi-play'"
              (onClick)="togglePlay()"
              [label]="isPlaying() ? 'Pause' : 'Play'"
              severity="success"
              styleClass="btn-play-large"
            />

            <p-button
              icon="pi pi-forward"
              (onClick)="stepForward()"
              [disabled]="currentCandleIndex() >= totalCandles()"
              [outlined]="true"
              severity="secondary"
            />

            <p-button
              icon="pi pi-step-forward"
              (onClick)="skipToEnd()"
              [outlined]="true"
              severity="secondary"
            />

            <!-- Speed Control -->
            <div class="speed-control">
              <label>Speed</label>
              <p-select
                [options]="speedOptions"
                [(ngModel)]="playbackSpeed"
                optionLabel="label"
                optionValue="value"
                [style]="{'width': '100px'}"
                appendTo="body"
              />
            </div>

            <!-- Progress Bar -->
            <div class="progress-bar-container">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  [style.width.%]="(currentCandleIndex() / totalCandles()) * 100"
                ></div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .replay-container {
      padding: 2rem;
      max-width: 2300px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .config-panel {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
      overflow: visible; /* ✅ WICHTIG */
      position: relative; /* ✅ WICHTIG */
      z-index: 10; /* ✅ WICHTIG */
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;

      h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
      }
    }

    .status-badge {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;

      &.playing {
        background: rgba(38, 166, 154, 0.2);
        border: 1px solid #26a69a;
        color: #26a69a;
      }

      &.paused {
        background: rgba(255, 193, 7, 0.2);
        border: 1px solid #ffc107;
        color: #ffc107;
      }
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      position: relative; /* ✅ WICHTIG */
      z-index: 1; /* ✅ WICHTIG */

      label {
        color: #999;
        font-size: 0.875rem;
        font-weight: 500;
      }
    }

    .input-field {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.75rem;
      color: #fff;
      font-size: 0.95rem;

      &:focus {
        outline: none;
        border-color: #2962ff;
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 1rem;
    }

    .candle-info {
      color: #26a69a;
      font-weight: 600;
    }

    .error-message {
      background: rgba(239, 83, 80, 0.1);
      border: 1px solid rgba(239, 83, 80, 0.3);
      border-radius: 8px;
      padding: 1rem;
      color: #ef5350;
      margin-top: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .chart-section {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;

      h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0;
      }
    }

    .chart-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #999;
      font-size: 0.875rem;

      .separator {
        color: #666;
      }
    }

    .chart-container {
      width: 100%;
      height: 1000px;
      background: #0a0a0a;
      border-radius: 8px;
    }

    .replay-controls {
      margin-top: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn-play-large {
      min-width: 120px;
    }

    .speed-control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;

      label {
        color: #999;
        font-size: 0.875rem;
      }
    }

    .progress-bar-container {
      width: 100%;
      margin-top: 1rem;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2962ff 0%, #26a69a 100%);
      transition: width 0.3s ease;
    }

    /* PrimeNG Overrides */
    ::ng-deep .p-dropdown {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;

      &:not(.p-disabled):hover {
        border-color: #2962ff;
      }

      .p-dropdown-label {
        color: #fff;
      }

      .p-dropdown-trigger {
        color: #999;
      }
    }

    ::ng-deep .p-dropdown-panel {
      background: rgba(20, 20, 20, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);

      .p-dropdown-items {
        .p-dropdown-item {
          color: #fff;

          &:not(.p-highlight):not(.p-disabled):hover {
            background: rgba(41, 98, 255, 0.1);
          }

          &.p-highlight {
            background: rgba(41, 98, 255, 0.2);
            color: #2962ff;
          }
        }
      }
    }

    ::ng-deep .p-button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);

      &.p-button-outlined {
        background: transparent;
      }

      &:not(:disabled):hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    ::ng-deep .p-button.p-button-success {
      background: linear-gradient(135deg, #26a69a 0%, #1e8e7e 100%);
      border: none;
      box-shadow: 0 2px 8px rgba(38, 166, 154, 0.3);

      &:not(:disabled):hover {
        box-shadow: 0 4px 12px rgba(38, 166, 154, 0.4);
      }
    }
  `]
})
export class ReplayComponent implements OnInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private replayService = inject(ReplayService);

  // Chart
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;

  // Data
  availableSymbols = signal<string[]>([]);
  availableIntervals = signal<IntervalOption[]>([]);
  symbolOptions = signal<Array<{label: string; value: string}>>([]);
  allCandles: CandleData[] = [];
  
  // Speed Options
  speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 }
  ];

  // Configuration
  selectedSymbol = 'BTC';
  selectedInterval = '1h';
  startDate = '2024-01-01';
  endDate = new Date().toISOString().split('T')[0];
  today = new Date().toISOString().split('T')[0];

  // State
  loading = signal(false);
  error = signal<string | null>(null);
  candlesLoaded = signal(false);
  totalCandles = signal(0);
  currentCandleIndex = signal(0);
  
  // Playback
  isPlaying = signal(false);
  playbackSpeed = 1;
  private playbackInterval: any = null;

  ngOnInit() {
    this.loadAvailableOptions();
  }

  ngOnDestroy() {
    this.stopPlayback();
    if (this.chart) {
      this.chart.remove();
    }
  }

  loadAvailableOptions() {
    this.replayService.getAvailableSymbols().subscribe({
      next: (symbols) => {
        this.availableSymbols.set(symbols);
        // Convert to dropdown format
        this.symbolOptions.set(symbols.map(s => ({ label: s, value: s })));
      },
      error: (err) => console.error('Failed to load symbols:', err)
    });

    this.replayService.getAvailableIntervals().subscribe({
      next: (intervals) => this.availableIntervals.set(intervals),
      error: (err) => console.error('Failed to load intervals:', err)
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
      endTime: new Date(this.endDate).getTime()
    };

    this.replayService.getCandles(config).subscribe({
      next: (response) => {
        this.allCandles = response.candles;
        this.totalCandles.set(response.candles.length);
        this.candlesLoaded.set(true);
        this.currentCandleIndex.set(0);
        this.loading.set(false);

        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load historical data');
        this.loading.set(false);
      }
    });
  }

  initializeChart() {
    if (this.chart) {
      this.chart.remove();
    }

    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 1000,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#999',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
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
        this.chart.applyOptions({
          width: this.chartContainer.nativeElement.clientWidth
        });
      }
    });

    this.reset();
  }

  reset() {
    this.stopPlayback();
    this.currentCandleIndex.set(0);
    this.updateChart();
  }

  togglePlay() {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.currentCandleIndex() >= this.totalCandles()) {
      this.reset();
    }

    this.isPlaying.set(true);
    
    const baseInterval = 1000;
    const interval = baseInterval / this.playbackSpeed;

    this.playbackInterval = setInterval(() => {
      if (this.currentCandleIndex() >= this.totalCandles()) {
        this.stopPlayback();
        return;
      }

      this.stepForward();
    }, interval);
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
    }
  }

  stepBackward() {
    if (this.currentCandleIndex() > 1) {
      this.currentCandleIndex.update(i => i - 1);
      this.updateChart();
    }
  }

  skipToEnd() {
    this.currentCandleIndex.set(this.totalCandles());
    this.updateChart();
    this.stopPlayback();
  }

  updateChart() {
    if (!this.candleSeries) return;

    const visibleCandles = this.allCandles.slice(0, this.currentCandleIndex());
    
    const chartData = visibleCandles.map(candle => ({
      time: (candle.timestamp / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));

    this.candleSeries.setData(chartData);

    if (this.chart && chartData.length > 0) {
      this.chart.timeScale().fitContent();
    }
  }

  getIntervalLabel(): string {
    const interval = this.availableIntervals().find(i => i.value === this.selectedInterval);
    return interval?.label || this.selectedInterval;
  }

  getCurrentDate(): string {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) {
      return '';
    }

    const currentCandle = this.allCandles[this.currentCandleIndex() - 1];
    return new Date(currentCandle.timestamp).toLocaleString();
  }
}