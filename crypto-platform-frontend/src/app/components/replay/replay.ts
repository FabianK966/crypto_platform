// Hauptkomponente für das Replay-/Backtesting-Modul.
// Verwaltet Chart, Daten laden, Wiedergabesteuerung, Indikatoren (EMA, RSI) und integriert das Trading-Portfolio.

import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  signal, inject, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayService } from '../../services/replay.service';
import { CandleData, ReplayConfig, IntervalOption } from '../../models/replay.model';
import { createChart, IChartApi, IPriceLine, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
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
  providers: [ReplayTradingService]   // Stellt den TradingService für diese Komponente und ihre Kinder bereit
})
export class ReplayComponent implements OnInit, OnDestroy {
  // Referenzen auf DOM-Elemente für Chart-Container
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;
  @ViewChild('rsiChartContainer') rsiChartContainer!: ElementRef;

  // Services
  private replayService = inject(ReplayService);        // Holt historische Kerzendaten
  tradingService = inject(ReplayTradingService);        // Verwaltet Portfolio, Trades, Margins

  // --- RSI (Relative Strength Index) Felder ---
  private rsiChart: IChartApi | null = null;            // RSI-Chart-Instanz
  private rsiSeries: ISeriesApi<'Line'> | null = null;  // Linien-Serie für RSI
  private rsiThreshold70Line: IPriceLine | null = null; // Horizontale Linie bei 70 (überkauft)
  private rsiThreshold30Line: IPriceLine | null = null; // Horizontale Linie bei 30 (überverkauft)
  showRSI = signal(true);                                // Signal: RSI sichtbar?
  currentRSI = signal<number | null>(null);              // Aktueller RSI-Wert (für Anzeige)
  private readonly RSI_PERIOD = 14;                       // Standardperiode für RSI

  // --- Durchschnittliche Einstiegspreise (Linien im Chart) ---
  private longEntryPriceLine: IPriceLine | null = null;
  private shortEntryPriceLine: IPriceLine | null = null;

  // --- Hauptchart Felder ---
  private chart: IChartApi | null = null;                // Hauptchart-Instanz
  private candleSeries: ISeriesApi<'Candlestick'> | null = null; // Kerzen-Serie
  private ema50Series: ISeriesApi<'Line'> | null = null; // EMA 50 Linie
  private ema200Series: ISeriesApi<'Line'> | null = null;// EMA 200 Linie

  // --- Scroll- und Zoom-Verhalten ---
  private readonly VISIBLE_CANDLES = 1000;               // Wie viele Kerzen sichtbar bleiben sollen
  private readonly FIT_THRESHOLD = 1000;                  // Grenze für automatischen Zoom
  private userIsScrolling = false;                         // Flag: Benutzer scrollt manuell?
  private scrollTimeout: any = null;                       // Timeout zum Zurücksetzen des Flags

  // --- Daten und Metadaten ---
  allCandles: CandleData[] = [];                           // Alle geladenen Kerzen
  availableSymbols = signal<string[]>([]);                  // Verfügbare Symbole (von API)
  availableIntervals = signal<IntervalOption[]>([]);        // Verfügbare Zeitintervalle

  // --- UI-Optionen ---
  speedOptions = [
    { label: '0.5x', value: 0.5 }, { label: '1x', value: 1 },
    { label: '2x', value: 2 }, { label: '3x', value: 3 },
    { label: '5x', value: 5 }, { label: '10x', value: 10 }
  ];

  // Aktuelle Auswahl (werden von der Sidebar gesetzt)
  selectedSymbol = 'BTC';
  selectedInterval = '1h';
  startDate = '2024-01-01';
  endDate = new Date().toISOString().split('T')[0];
  today = new Date().toISOString().split('T')[0];

  // --- Zustände (Signale) ---
  loading = signal(false);                                 // Ladezustand
  error = signal<string | null>(null);                     // Fehlermeldung
  candlesLoaded = signal(false);                            // Wurden Kerzen geladen?
  totalCandles = signal(0);                                 // Anzahl geladener Kerzen
  currentCandleIndex = signal(0);                           // Aktueller Index in der Wiedergabe (0 = noch keine Kerze)
  showEma50 = signal(true);                                  // EMA 50 sichtbar?
  showEma200 = signal(true);                                 // EMA 200 sichtbar?
  isPlaying = signal(false);                                 // Läuft die Wiedergabe?
  playbackSpeed = 1;                                         // Geschwindigkeitsfaktor
  private playbackInterval: any = null;                      // Intervall-Handle für Wiedergabe

  constructor() {
    // Effekt: Wenn Kerzen geladen werden, erlaube vertikales Scrollen, sonst sperren.
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });
  }

  ngOnInit() {
    this.loadAvailableOptions();                            // Beim Start verfügbare Symbole/Intervalle laden
  }

  ngOnDestroy() {
    document.body.style.overflowY = '';                     // Zurücksetzen
    clearTimeout(this.scrollTimeout);
    this.stopPlayback();                                     // Wiedergabe stoppen
    if (this.chart) this.chart.remove();                     // Chart-Ressourcen freigeben
    if (this.rsiChart) this.rsiChart.remove();
  }

  // Lädt verfügbare Symbole und Intervalle vom Service
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

  // Wird von der Sidebar aufgerufen, wenn sich Konfiguration ändert (Symbol, Interval, Datum, Hebel)
  onConfigChange(config: { symbol: string; interval: string; startDate: string; endDate: string; leverage: number }) {
    this.selectedSymbol = config.symbol;
    this.selectedInterval = config.interval;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.tradingService.selectedLeverage.set(config.leverage); // Hebel im TradingService setzen
  }

  // Lädt die historischen Kerzendaten gemäß aktueller Konfiguration
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
        this.currentCandleIndex.set(0);                     // Zurücksetzen auf Start
        this.loading.set(false);
        this.tradingService.resetPortfolio();               // Portfolio zurücksetzen
        setTimeout(() => this.initializeChart(), 100);      // Chart nach DOM-Update initialisieren
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load historical data');
        this.loading.set(false);
      }
    });
  }

  // Initialisiert Hauptchart und RSI-Chart
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

    // Candlestick-Serie hinzufügen
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });

    // EMA 50 Linie, falls aktiviert
    if (this.showEma50()) {
      this.ema50Series = this.chart.addLineSeries({
        color: '#2962ff', lineWidth: 2, title: 'EMA 50',
        lastValueVisible: true, priceLineVisible: false
      });
    }

    // EMA 200 Linie, falls aktiviert
    if (this.showEma200()) {
      this.ema200Series = this.chart.addLineSeries({
        color: '#ff6d00', lineWidth: 2, title: 'EMA 200',
        lastValueVisible: true, priceLineVisible: false
      });
    }

    // Entry-Preis-Linien zurücksetzen
    this.longEntryPriceLine = null;
    this.shortEntryPriceLine = null;

    // --- RSI-Chart initialisieren ---
    if (this.rsiChart) this.rsiChart.remove();
    this.rsiChart = createChart(this.rsiChartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: 150,
      layout: { background: { color: '#0a0a0a' }, textColor: '#999' },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' }
    });

    // RSI-Linie hinzufügen
    this.rsiSeries = this.rsiChart.addLineSeries({
      color: '#9c27b0',
      lineWidth: 2,
      title: `RSI (${this.RSI_PERIOD})`,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Horizontale Linien bei 70 und 30
    this.rsiThreshold70Line = this.rsiSeries.createPriceLine({
      price: 70,
      color: '#ef5350',
      lineWidth: 1,
      lineStyle: 2, // gestrichelt
      axisLabelVisible: true,
      title: 'Overbought (70)',
    });
    this.rsiThreshold30Line = this.rsiSeries.createPriceLine({
      price: 30,
      color: '#26a69a',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Oversold (30)',
    });

    // Zeitskalen synchronisieren: Wenn Benutzer im Hauptchart scrollt, folgt der RSI-Chart und umgekehrt
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

    // Resize-Listener für responsive Breite
    window.addEventListener('resize', () => {
      if (this.chart && this.chartContainer) {
        this.chart.applyOptions({ width: this.chartContainer.nativeElement.clientWidth });
      }
    });

    // Erkenne manuelles Scrollen des Benutzers
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.userIsScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => { this.userIsScrolling = false; }, 150);
    });

    this.reset(); // Setze auf erste Kerze und zeichne Chart
  }

  // Setzt Wiedergabe auf Anfang zurück
  reset() {
    this.stopPlayback();
    this.currentCandleIndex.set(0);
    this.updateChart(); // Chart neu zeichnen (leer)
  }

  // Startet/Pausiert die Wiedergabe
  togglePlay() {
    this.isPlaying() ? this.stopPlayback() : this.startPlayback();
  }

  // Startet automatische Schritt-für-Schritt-Wiedergabe
  startPlayback() {
    if (this.currentCandleIndex() >= this.totalCandles()) this.reset();
    this.isPlaying.set(true);
    this.playbackInterval = setInterval(() => {
      if (this.currentCandleIndex() >= this.totalCandles()) {
        this.stopPlayback(); // Ende erreicht
        return;
      }
      this.stepForward();
    }, 1000 / this.playbackSpeed); // Intervall basierend auf Geschwindigkeit
  }

  // Stoppt die automatische Wiedergabe
  stopPlayback() {
    this.isPlaying.set(false);
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  // Geht eine Kerze vorwärts
  stepForward() {
    if (this.currentCandleIndex() < this.totalCandles()) {
      this.currentCandleIndex.update(i => i + 1);
      this.updateChart();                               // Chart aktualisieren
      this.updateTradingService();                      // TradingService über neuen Preis informieren
      if (this.tradingService.checkLiquidation()) {     // Prüfen, ob Liquidation stattfindet
        alert('⚠️ Liquidation! All positions closed.');
      }
    }
  }

  // Geht eine Kerze rückwärts (nur möglich, wenn mindestens eine Kerze vorhanden)
  stepBackward() {
    if (this.currentCandleIndex() > 1) {
      this.currentCandleIndex.update(i => i - 1);
      this.updateChart();
      this.updateTradingService();
    }
  }

  // Springt zur letzten Kerze
  skipToEnd() {
    this.currentCandleIndex.set(this.totalCandles());
    this.updateChart();
    this.updateTradingService();
    this.stopPlayback();
  }

  // Aktualisiert den Chart basierend auf aktuellem Index
  updateChart() {
    if (!this.candleSeries || !this.chart) return;

    const index = this.currentCandleIndex();
    const visibleCandles = this.allCandles.slice(0, index); // Alle Kerzen bis zum aktuellen Index
    const chartData = visibleCandles.map(c => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close
    }));

    this.candleSeries.setData(chartData); // Kerzen setzen

    // EMA 50 aktualisieren, falls aktiv
    if (this.showEma50() && this.ema50Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map(c => c.close);
      const ema50Values = this.calculateEMA(closePrices, 50);
      this.ema50Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema50Values[i]
      })));
    }

    // EMA 200 aktualisieren, falls aktiv
    if (this.showEma200() && this.ema200Series && visibleCandles.length > 0) {
      const closePrices = visibleCandles.map(c => c.close);
      const ema200Values = this.calculateEMA(closePrices, 200);
      this.ema200Series.setData(visibleCandles.map((c, i) => ({
        time: (c.timestamp / 1000) as Time,
        value: ema200Values[i]
      })));
    }

    // RSI aktualisieren, falls aktiv und genügend Kerzen vorhanden
    if (this.showRSI() && this.rsiSeries && visibleCandles.length > this.RSI_PERIOD) {
      const closePrices = visibleCandles.map(c => c.close);
      const rsiValues = this.calculateRSI(closePrices, this.RSI_PERIOD);
      if (rsiValues.length > 0) {
        // RSI-Werte beginnen erst nach der Periode, daher Zeiten entsprechend anpassen
        const rsiData = rsiValues.map((value, i) => ({
          time: (visibleCandles[i + this.RSI_PERIOD].timestamp / 1000) as Time,
          value: value,
        }));
        this.rsiSeries.setData(rsiData);
        this.currentRSI.set(rsiValues[rsiValues.length - 1]); // letzten Wert für Anzeige speichern
      } else {
        this.currentRSI.set(null);
      }
    } else {
      this.currentRSI.set(null);
    }

    // Durchschnittliche Einstiegspreise als horizontale Linien anzeigen
    this.updateEntryPriceLines();

    // Automatisches Scroll-Verhalten: Wenn Benutzer nicht selbst scrollt, passe Ansicht an
    if (chartData.length === 0 || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) {
      ts.fitContent(); // Zeige alle Daten
    } else {
      // Zeige einen Bereich um die aktuelle Kerze herum
      ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
    }
  }

  // Erstellt/aktualisiert/entfernt die horizontalen Linien für durchschnittliche Einstiegspreise
  private updateEntryPriceLines() {
    if (!this.candleSeries) return;

    const longQty = this.tradingService.replayLongQuantity();
    const longAvg = this.tradingService.replayLongAvgPrice();
    const shortQty = this.tradingService.replayShortQuantity();
    const shortAvg = this.tradingService.replayShortAvgPrice();

    // Long-Position vorhanden: Linie anzeigen
    if (longQty > 0 && longAvg > 0) {
      if (!this.longEntryPriceLine) {
        this.longEntryPriceLine = this.candleSeries.createPriceLine({
          price: longAvg, color: '#26a69a', lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Long Avg'
        });
      } else {
        this.longEntryPriceLine.applyOptions({ price: longAvg }); // Preis aktualisieren (z.B. nach Averaging)
      }
    } else if (this.longEntryPriceLine) { // Keine Position: Linie entfernen
      this.candleSeries.removePriceLine(this.longEntryPriceLine);
      this.longEntryPriceLine = null;
    }

    // Analog für Short-Position
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

  // Berechnet den exponentiell gleitenden Durchschnitt (EMA)
  private calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i];
    ema.push(sum / Math.min(period, data.length)); // SMA als Startwert
    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] - ema[i - 1]) * multiplier + ema[i - 1]); // EMA-Formel
    }
    return ema;
  }

  // Schaltet die Sichtbarkeit von EMA 50 um (wird vom Sidebar-Button aufgerufen)
  toggleEma50() {
    this.showEma50.update(v => !v);
    if (this.chart) {
      if (this.showEma50()) {
        // Serie neu anlegen, wenn aktiviert
        this.ema50Series = this.chart.addLineSeries({
          color: '#2962ff', lineWidth: 2, title: 'EMA 50',
          lastValueVisible: true, priceLineVisible: false
        });
      } else if (this.ema50Series) {
        this.chart.removeSeries(this.ema50Series);
        this.ema50Series = null;
      }
      this.updateChart(); // Chart neu zeichnen
    }
  }

  // Schaltet die Sichtbarkeit von EMA 200 um
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

  // Schaltet die Sichtbarkeit des RSI-Charts um
  toggleRSI() {
    this.showRSI.update(v => !v);
    if (this.rsiChart) {
      if (this.showRSI()) {
        // RSI-Linie neu anlegen
        this.rsiSeries = this.rsiChart.addLineSeries({
          color: '#9c27b0',
          lineWidth: 2,
          title: `RSI (${this.RSI_PERIOD})`,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        this.rsiThreshold70Line = this.rsiSeries.createPriceLine({
          price: 70,
          color: '#ef5350',
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Overbought (70)',
        });
        this.rsiThreshold30Line = this.rsiSeries.createPriceLine({
          price: 30,
          color: '#26a69a',
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Oversold (30)',
        });
      } else if (this.rsiSeries) {
        this.rsiChart.removeSeries(this.rsiSeries);
        this.rsiSeries = null;
        this.rsiThreshold70Line = null;
        this.rsiThreshold30Line = null;
      }
      this.updateChart(); // RSI-Daten neu zeichnen (bzw. entfernen)
    }
  }

  // Berechnet den RSI (Relative Strength Index)
  private calculateRSI(prices: number[], period: number = this.RSI_PERIOD): number[] {
    if (prices.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    // Differenzen der Schlusskurse berechnen
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }

    // Initialer Durchschnitt der ersten "period" Gewinne/Verluste
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    const rsi: number[] = [];
    // Erster RSI-Wert (nach der ersten Periode)
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      rsi.push(100 - 100 / (1 + avgGain / avgLoss));
    }

    // Restliche Werte mit gleitendem Durchschnitt (Wilder's Smoothing)
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

  // Informiert den TradingService über den aktuellen Preis und Zeitstempel
  private updateTradingService() {
    const price = this.getCurrentPrice();
    const timestamp = this.getCurrentDate();
    this.tradingService.setCurrentPrice(price, timestamp);
    this.tradingService.updateUsedMargin(); // Margin neu berechnen (abhängig vom Preis)
  }

  // Hilfsfunktion: Liefert die lesbare Bezeichnung des aktuellen Intervalls
  getIntervalLabel(): string {
    return this.availableIntervals().find(i => i.value === this.selectedInterval)?.label ?? this.selectedInterval;
  }

  // Liefert den Zeitstempel der aktuellen Kerze als lesbaren String
  getCurrentDate(): string {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return '';
    return new Date(this.allCandles[this.currentCandleIndex() - 1].timestamp).toLocaleString();
  }

  // Liefert den Schlusskurs der aktuellen Kerze (oder 0, wenn keine Kerze)
  getCurrentPrice(): number {
    if (this.currentCandleIndex() === 0 || !this.allCandles.length) return 0;
    return this.allCandles[this.currentCandleIndex() - 1].close;
  }
}