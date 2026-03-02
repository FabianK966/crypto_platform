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
import { ReplayTradingService } from '../replay_copy/services/replay-strategy-trading.service';
import { ReplayStrategyPortfolioComponent } from '../replay_copy/replay-strategy-portfolio/replay-strategy-portfolio';
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
    ReplayStrategyPortfolioComponent,
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

  // ── RSI Chart ────────────────────────────────────────────────────
  private rsiChart: IChartApi | null = null;
  private rsiSeries: ISeriesApi<'Line'> | null = null;
  private rsiLongBuyLine: IPriceLine | null = null;
  private rsiLongSellLine: IPriceLine | null = null;
  private rsiShortBuyLine: IPriceLine | null = null;
  private rsiShortSellLine: IPriceLine | null = null;
  showRSI = signal(true);
  currentRSI = signal<number | null>(null);
  private readonly RSI_PERIOD = 14;

  // ── Chart Entry-Lines ────────────────────────────────────────────
  private longEntryPriceLine: IPriceLine | null = null;
  private shortEntryPriceLine: IPriceLine | null = null;

  // ── Drawdown-Zähler ──────────────────────────────────────────────
  private longCandlesInLoss = 0;
  private shortCandlesInLoss = 0;

  // ── Cooldown-Zähler (getrennt für Open/Close, Long/Short) ────────
  private longOpenCandlesSince = 999;
  private longCloseCandlesSince = 999;
  private shortOpenCandlesSince = 999;
  private shortCloseCandlesSince = 999;

  // ── Haupt-Chart ──────────────────────────────────────────────────
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private ema50Series: ISeriesApi<'Line'> | null = null;
  private ema200Series: ISeriesApi<'Line'> | null = null;

  private readonly VISIBLE_CANDLES = 1000;
  private readonly FIT_THRESHOLD = 1000;
  private userIsScrolling = false;
  private scrollTimeout: any = null;

  // ── Chart-Performance: inkrementeller Zustand ────────────────────
  private readonly CHART_TRIM_INTERVAL = 3000;
  private readonly CHART_DISPLAY_WINDOW = 2000;

  // RSI-Zustand (Wilder's Smoothing)
  private rsiAvgGain = 0;
  private rsiAvgLoss = 0;
  private rsiInitialized = false;
  private rsiPrevPrice = 0;

  // EMA-Zustände
  private ema50Value = 0;
  private ema200Value = 0;
  private ema50Ready = false;
  private ema200Ready = false;
  private ema50SumCount = 0;
  private ema200SumCount = 0;
  private ema50Sum = 0;
  private ema200Sum = 0;

  // letzter gezeichneter Index
  private lastDrawnIndex = 0;

  // ── Daten ────────────────────────────────────────────────────────
  allCandles: CandleData[] = [];
  availableSymbols = signal<string[]>([]);
  availableIntervals = signal<IntervalOption[]>([]);
  private longLossCutTriggered = false;
  private shortLossCutTriggered = false;

  speedOptions = [
    { label: '0.5x', value: 0.5 },
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '3x', value: 3 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
    { label: '25x', value: 25 },
    { label: '50x', value: 50 },
    { label: '100x', value: 100 },
    { label: '500x', value: 500 },
    { label: '1000x', value: 1000 },
    { label: '10000x', value: 10000 }
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
  // Skalierungsfaktor für Positionsgrößen (nur wenn Safety Vault deaktiviert)
  positionSizeFactor = 1;

  // Session-Speichern
  isSaving = signal(false);
  saveSuccess = signal(false);
  savedSessionId = signal<string | null>(null);
  showSessionsModal = signal(false);

  // Startkapital (eingefroren beim Laden)
  replayStartBalance = 10000;

  // ── Strategie-Konfiguration ──────────────────────────────────────
  strategyConfig: StrategyConfig = {
    autoShortEnabled: true,
    useSafetyVault: true,
    longLeverage: 4,
    shortLeverage: 2,
    enableLossCut: false,      
    lossCutThreshold: 100,

    longRsiBuyThreshold: 30,
    longRsiSellThreshold: 70,
    longOpenCooldown: 3,
    longCloseCooldown: 5,
    longFreeZonePercent: 15,
    longBuyPercent: 1,
    longBuyScaleThreshold: 25,
    longBuyScalePercent: 5,
    longClosePercent: 10,
    longProfitThreshold: 8,
    longLossThreshold: 8,
    longDrawdownCandles: 2000,
    longRescueTrigger: 5,
    longRescueClosePercent: 95,
    longMaxPositionPercent: 33,
    minlongpositionpercent: 10,

    minshortpositionpercent: 4,
    shortMaxPositionPercent: 30,
    shortRsiBuyThreshold: 30,
    shortRsiSellThreshold: 77,
    shortOpenCooldown: 3,
    shortCloseCooldown: 10,
    shortFreeZonePercent: 10,
    shortBuyPercent: 1,
    shortBuyScaleThreshold: 20,
    shortBuyScalePercent: 5,
    shortClosePercent: 20,
    shortProfitThreshold: 6,
    shortLossThreshold: 12,
    shortDrawdownCandles: 2000,
    shortRescueTrigger: 4,
    shortRescueClosePercent: 95,
  };

  strategyLog = signal<StrategyLogEntry[]>([]);
  showStrategyLog = signal(false);
  strategyTradeCount = signal(0);

  // ── Constructor ──────────────────────────────────────────────────
  constructor() {
    effect(() => {
      document.body.style.overflowY = this.candlesLoaded() ? 'auto' : 'hidden';
    });

    // ── Liquidation-Handler mit Vault-Injection ──────────────────
    effect(() => {
      if (this.tradingService.liquidationTriggered()) {
        this.stopPlayback();

        if (this.strategyConfig.useSafetyVault) {
          const vault = this.tradingService.safetyVault();

          if (vault > 0) {
            const inject = Math.min(vault, this.tradingService.replayInitialBalance);
            const remaining = vault - inject;
            this.tradingService.injectSafetyVault();

            // Cooldowns zurücksetzen
            this.longOpenCandlesSince = 999;
            this.longCloseCandlesSince = 999;
            this.shortOpenCandlesSince = 999;
            this.shortCloseCandlesSince = 999;
            this.longCandlesInLoss = 0;
            this.shortCandlesInLoss = 0;

            alert(
              `⚠️ Liquidation! Alle Positionen zwangsgeschlossen.\n` +
              `💰 $${inject.toFixed(0)} aus Safety Vault eingezahlt.\n` +
              (remaining > 0 ? `🔒 $${remaining.toFixed(0)} verbleiben im Vault.\n` : '') +
              `Strategie wird fortgesetzt.`
            );
            setTimeout(() => this.startPlayback(), 500);
          } else {
            alert(
              `⚠️ Liquidation! Alle Positionen wurden zwangsgeschlossen.\n` +
              `💸 Kein Safety Vault vorhanden — Strategie gestoppt.`
            );
          }
        } else {
          // Kein Vault aktiv → nur Liquidation, keine Rettung
          alert(
            `⚠️ Liquidation! Alle Positionen zwangsgeschlossen.\n` +
            `🔕 Safety Vault ist deaktiviert – Strategie gestoppt.`
          );
        }

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

  // ── Init ─────────────────────────────────────────────────────────
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
    this.longOpenCandlesSince = config.longOpenCooldown;
    this.longCloseCandlesSince = config.longCloseCooldown;
    this.shortOpenCandlesSince = config.shortOpenCooldown;
    this.shortCloseCandlesSince = config.shortCloseCooldown;

    this.rsiLongBuyLine?.applyOptions({
      price: config.longRsiBuyThreshold,
      title: `L-Buy (${config.longRsiBuyThreshold})`
    });
    this.rsiLongSellLine?.applyOptions({
      price: config.longRsiSellThreshold,
      title: `L-Sell (${config.longRsiSellThreshold})`
    });
    this.rsiShortBuyLine?.applyOptions({
      price: config.shortRsiBuyThreshold,
      title: `S-Cover (${config.shortRsiBuyThreshold})`
    });
    this.rsiShortSellLine?.applyOptions({
      price: config.shortRsiSellThreshold,
      title: `S-Open (${config.shortRsiSellThreshold})`
    });
  }

  // ── Daten laden ──────────────────────────────────────────────────
  loadReplayData() {
    this.loading.set(true);
    this.error.set(null);
    this.stopPlayback();
    this.saveSuccess.set(false);
    this.savedSessionId.set(null);
    this.strategyLog.set([]);
    this.strategyTradeCount.set(0);

    this.longOpenCandlesSince = 999;
    this.longCloseCandlesSince = 999;
    this.shortOpenCandlesSince = 999;
    this.shortCloseCandlesSince = 999;
    this.longCandlesInLoss = 0;
    this.shortCandlesInLoss = 0;

    this.rsiAvgGain = 0; this.rsiAvgLoss = 0;
    this.rsiInitialized = false; this.rsiPrevPrice = 0;
    this.ema50Value = 0; this.ema200Value = 0;
    this.ema50Ready = false; this.ema200Ready = false;
    this.ema50SumCount = 0; this.ema200SumCount = 0;
    this.ema50Sum = 0; this.ema200Sum = 0;
    this.lastDrawnIndex = 0;

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
        this.replayStartBalance = this.tradingService.replayInitialBalance;
        setTimeout(() => this.initializeChart(), 100);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Fehler beim Laden der Daten');
        this.loading.set(false);
      }
    });
  }

  /**
   * Aktualisiert den Skalierungsfaktor basierend auf der aktuellen Gesamtbilanz.
   * Bei jeder Verdopplung (gegenüber replayStartBalance) wird der Faktor halbiert.
   * Bei aktiviertem Vault bleibt der Faktor = 1.
   */
  private updatePositionSizeFactor() {
    if (!this.strategyConfig.useSafetyVault) {
      const totalBalance = this.tradingService.replayTotalBalance();
      const ratio = totalBalance / this.replayStartBalance;
      if (ratio >= 2) {
        const doublings = Math.floor(Math.log2(ratio));
      this.positionSizeFactor = Math.max(Math.pow(0.75, doublings), 0.33);
      } else {
        this.positionSizeFactor = 1;
      }
    } else {
      this.positionSizeFactor = 1;
    }
  }

  // ── Strategie-Logik ──────────────────────────────────────────────
  private checkStrategyTrade(): void {
  const rsi = this.currentRSI();
  if (rsi === null) return;
  const price = this.getCurrentPrice();
  if (price <= 0) return;

  const ts = this.tradingService;
  const cfg = this.strategyConfig;
  const totalBalance = ts.replayTotalBalance();
  const longNotional = ts.replayLongQuantity() * price;
  const shortNotional = ts.replayShortQuantity() * price;
  const longFreeZone = longNotional < totalBalance * (cfg.longFreeZonePercent / 100);
  const shortFreeZone = shortNotional < totalBalance * (cfg.shortFreeZonePercent / 100);
  const longPnlPct = ts.longUnrealizedPnlPercent();
  const shortPnlPct = ts.shortUnrealizedPnlPercent();

  // Skalierungsfaktor für Positionsgrößen (nur wenn Safety Vault deaktiviert)
  const scaleFactor = cfg.useSafetyVault ? 1 : this.positionSizeFactor;

  // Skalierte Kaufprozente
  const scaledLongBuyPct = cfg.longBuyPercent * scaleFactor;
  const scaledLongBuyScalePct = cfg.longBuyScalePercent * scaleFactor;
  const scaledShortBuyPct = cfg.shortBuyPercent * scaleFactor;
  const scaledShortBuyScalePct = cfg.shortBuyScalePercent * scaleFactor;

  // Flags, um mehrere Trades pro Kerze zu verhindern
  let longTradeDone = false;
  let shortTradeDone = false;

  // ── LOSS CUT PRÜFUNG (Flags setzen) ─────────────────────────────
  if (cfg.enableLossCut && longPnlPct <= -cfg.lossCutThreshold) {
    this.longLossCutTriggered = true;
  }
  if (cfg.enableLossCut && shortPnlPct <= -cfg.lossCutThreshold) {
    this.shortLossCutTriggered = true;
  }

  // ── DRAWDOWN-RESCUE ──────────────────────────────────────────────
  if (ts.hasLong()) {
    if (longPnlPct < 0) {
      this.longCandlesInLoss++;
    } else if (this.longCandlesInLoss < cfg.longDrawdownCandles) {
      this.longCandlesInLoss = 0;
    }
    if (
      this.longCandlesInLoss >= cfg.longDrawdownCandles &&
      longPnlPct >= cfg.longRescueTrigger
    ) {
      ts.selectedLeverage.set(cfg.longLeverage);
      const rescueQty = ts.replayLongQuantity() * (cfg.longRescueClosePercent / 100);
      if (rescueQty >= 0.000001 && ts.decreaseLong(rescueQty, price)) {
        this.logTrade('RESCUE SELL', price, rescueQty, rsi,
          `Drawdown-Rescue: ${this.longCandlesInLoss} Kerzen im Minus → +${longPnlPct.toFixed(2)}% Erholung | ${cfg.longRescueClosePercent}% verkauft`);
        this.strategyTradeCount.update(n => n + 1);
        this.longCandlesInLoss = 0;
        longTradeDone = true;
      }
    }
  } else {
    this.longCandlesInLoss = 0;
  }

  if (ts.hasShort()) {
    if (shortPnlPct < 0) {
      this.shortCandlesInLoss++;
    } else if (this.shortCandlesInLoss < cfg.shortDrawdownCandles) {
      this.shortCandlesInLoss = 0;
    }
    if (
      this.shortCandlesInLoss >= cfg.shortDrawdownCandles &&
      shortPnlPct >= cfg.shortRescueTrigger
    ) {
      ts.selectedLeverage.set(cfg.shortLeverage);
      const rescueQty = ts.replayShortQuantity() * (cfg.shortRescueClosePercent / 100);
      if (rescueQty >= 0.000001 && ts.decreaseShort(rescueQty, price)) {
        this.logTrade('RESCUE COVER', price, rescueQty, rsi,
          `Drawdown-Rescue: ${this.shortCandlesInLoss} Kerzen im Minus → +${shortPnlPct.toFixed(2)}% Erholung | ${cfg.shortRescueClosePercent}% gecovert`);
        this.strategyTradeCount.update(n => n + 1);
        this.shortCandlesInLoss = 0;
        shortTradeDone = true;
      }
    }
  } else {
    this.shortCandlesInLoss = 0;
  }

  // ── LONG-Seite ───────────────────────────────────────────────────
  const longOpenReady = this.longOpenCandlesSince >= cfg.longOpenCooldown;
  const longCloseReady = this.longCloseCandlesSince >= cfg.longCloseCooldown;

  const longPositionPct = (longNotional / totalBalance) * 100;
  // Effektiver Prozentsatz für diesen Trade (abhängig von Positionsgröße)
  const effectiveLongBuyPctForTrade = longPositionPct >= cfg.longBuyScaleThreshold
    ? scaledLongBuyScalePct
    : scaledLongBuyPct;

  // RSI-Kauf
  if (!longTradeDone && rsi < cfg.longRsiBuyThreshold) {
    if (longOpenReady) {
      const hasLong = ts.hasLong();
      const longProfitOk = longPnlPct >= cfg.longProfitThreshold;
      const longLossOk = longPnlPct <= -cfg.longLossThreshold;
      const canBuy = !hasLong
        ? longFreeZone
        : longFreeZone || longProfitOk || longLossOk;

      if (canBuy) {
        ts.selectedLeverage.set(cfg.longLeverage);
        const qty = (totalBalance * (effectiveLongBuyPctForTrade / 100) * cfg.longLeverage) / price;
        if (qty >= 0.000001 && ts.increaseLong(qty, price)) {
          this.logTrade('BUY LONG', price, qty, rsi,
            `RSI ${rsi.toFixed(1)} < ${cfg.longRsiBuyThreshold} | LongPnL: ${longPnlPct.toFixed(1)}% | Pos: ${longPositionPct.toFixed(1)}% → buy ${effectiveLongBuyPctForTrade.toFixed(2)}% (skaliert) | ${!hasLong ? 'New' : longFreeZone ? 'FreeZone' : longLossOk ? 'DCA' : 'InProfit'} | ${cfg.longLeverage}x`);
          this.longOpenCandlesSince = 0;
          this.strategyTradeCount.update(n => n + 1);
          longTradeDone = true;
        }
      }
    }
  }

  // RSI-Verkauf (Long) – inklusive Loss Cut
  if (!longTradeDone && rsi > cfg.longRsiSellThreshold && ts.hasLong() && longPositionPct > cfg.minlongpositionpercent) {
    if (longCloseReady) {
      const longInLoss = longPnlPct < 0;
      const longInProfit = longPnlPct >= cfg.longProfitThreshold;
      const canClose = longFreeZone ? !longInLoss : longInProfit;

      // Prüfen, ob Loss Cut aktiv und Flag gesetzt
      const isLossCut = cfg.enableLossCut && this.longLossCutTriggered;
      const closePercent = isLossCut ? 90 : cfg.longClosePercent;

      // Loss Cut überschreibt canClose – wir wollen auch dann schließen, wenn die normalen Bedingungen nicht erfüllt sind
      if (canClose || isLossCut) {
        ts.selectedLeverage.set(cfg.longLeverage);
        const closeQty = ts.replayLongQuantity() * (closePercent / 100);
        if (closeQty >= 0.000001 && ts.decreaseLong(closeQty, price)) {
          const action = isLossCut ? 'LOSS CUT SELL' : 'SELL LONG';
          const reason = isLossCut
            ? `Loss Cut: Verlust ${longPnlPct.toFixed(1)}% überschreitet Schwelle von ${cfg.lossCutThreshold}% → 50% geschlossen`
            : `RSI ${rsi.toFixed(1)} > ${cfg.longRsiSellThreshold} | LongPnL: ${longPnlPct.toFixed(1)}% | ${longFreeZone ? 'FreeZone' : 'InProfit'}`;
          this.logTrade(action, price, closeQty, rsi, reason);
          this.longCloseCandlesSince = 0;
          this.strategyTradeCount.update(n => n + 1);
          longTradeDone = true;
          if (isLossCut) this.longLossCutTriggered = false; // Flag zurücksetzen
        }
      }
    }
  }

  // Max. Positionsgröße überschritten + Gewinn
  if (!longTradeDone && ts.hasLong() && longCloseReady) {
    if (longPositionPct > cfg.longMaxPositionPercent && longPnlPct >= cfg.longProfitThreshold) {
      ts.selectedLeverage.set(cfg.longLeverage);
      const closeQty = ts.replayLongQuantity() * (cfg.longClosePercent / 100);
      if (closeQty >= 0.000001 && ts.decreaseLong(closeQty, price)) {
        this.logTrade('SELL LONG (MaxPos)', price, closeQty, rsi,
          `Position ${longPositionPct.toFixed(1)}% > ${cfg.longMaxPositionPercent}% und +${longPnlPct.toFixed(1)}% Gewinn → Verkauf ${cfg.longClosePercent}%`);
        this.longCloseCandlesSince = 0;
        this.strategyTradeCount.update(n => n + 1);
        longTradeDone = true;
      }
    }
  }

  this.longOpenCandlesSince = Math.min(this.longOpenCandlesSince + 1, cfg.longOpenCooldown + 1);
  this.longCloseCandlesSince = Math.min(this.longCloseCandlesSince + 1, cfg.longCloseCooldown + 1);

  // ── SHORT-Seite ──────────────────────────────────────────────────
  if (!cfg.autoShortEnabled) return;

  const shortOpenReady = this.shortOpenCandlesSince >= cfg.shortOpenCooldown;
  const shortCloseReady = this.shortCloseCandlesSince >= cfg.shortCloseCooldown;

  const shortPositionPct = (shortNotional / totalBalance) * 100;
  const effectiveShortBuyPctForTrade = shortPositionPct >= cfg.shortBuyScaleThreshold
    ? scaledShortBuyScalePct
    : scaledShortBuyPct;

  // RSI-Short-Eröffnung
  if (!shortTradeDone && rsi > cfg.shortRsiSellThreshold) {
    if (shortOpenReady) {
      const hasShort = ts.hasShort();
      const shortDcaOk = shortPnlPct <= -cfg.shortLossThreshold;
      const canShort = !hasShort ? shortFreeZone : shortFreeZone || shortDcaOk;

      if (canShort) {
        ts.selectedLeverage.set(cfg.shortLeverage);
        const qty = (totalBalance * (effectiveShortBuyPctForTrade / 100) * cfg.shortLeverage) / price;
        if (qty >= 0.000001 && ts.increaseShort(qty, price)) {
          this.logTrade('OPEN SHORT', price, qty, rsi,
            `RSI ${rsi.toFixed(1)} > ${cfg.shortRsiSellThreshold} | ShortPnL: ${shortPnlPct.toFixed(1)}% | Pos: ${shortPositionPct.toFixed(1)}% → buy ${effectiveShortBuyPctForTrade.toFixed(2)}% (skaliert) | ${!hasShort ? 'New' : shortFreeZone ? 'FreeZone' : 'DCA'} | ${cfg.shortLeverage}x`);
          this.shortOpenCandlesSince = 0;
          this.strategyTradeCount.update(n => n + 1);
          shortTradeDone = true;
        }
      }
    }
  }

  // RSI-Cover (Short) – inklusive Loss Cut
  if (!shortTradeDone && rsi < cfg.shortRsiBuyThreshold && ts.hasShort() && shortPositionPct > cfg.minshortpositionpercent) {
    if (shortCloseReady) {
      const shortInLoss = shortPnlPct < 0;
      const shortInProfit = shortPnlPct >= cfg.shortProfitThreshold;
      const canCover = shortFreeZone ? !shortInLoss : shortInProfit;

      // Prüfen, ob Loss Cut aktiv und Flag gesetzt
      const isLossCut = cfg.enableLossCut && this.shortLossCutTriggered;
      const closePercent = isLossCut ? 90 : cfg.shortClosePercent;

      if (canCover || isLossCut) {
        ts.selectedLeverage.set(cfg.shortLeverage);
        const closeQty = ts.replayShortQuantity() * (closePercent / 100);
        if (closeQty >= 0.000001 && ts.decreaseShort(closeQty, price)) {
          const action = isLossCut ? 'LOSS CUT COVER' : 'SHORT COVER';
          const reason = isLossCut
            ? `Loss Cut: Verlust ${shortPnlPct.toFixed(1)}% überschreitet Schwelle von ${cfg.lossCutThreshold}% → 50% geschlossen`
            : `RSI ${rsi.toFixed(1)} < ${cfg.shortRsiBuyThreshold} | ShortPnL: ${shortPnlPct.toFixed(1)}% | ${shortFreeZone ? 'FreeZone' : 'InProfit'}`;
          this.logTrade(action, price, closeQty, rsi, reason);
          this.shortCloseCandlesSince = 0;
          this.strategyTradeCount.update(n => n + 1);
          shortTradeDone = true;
          if (isLossCut) this.shortLossCutTriggered = false; // Flag zurücksetzen
        }
      }
    }
  }

  // Max. Positionsgröße überschritten + Gewinn (Short)
  if (!shortTradeDone && ts.hasShort() && shortCloseReady) {
    if (shortPositionPct > cfg.shortMaxPositionPercent && shortPnlPct >= cfg.shortProfitThreshold) {
      ts.selectedLeverage.set(cfg.shortLeverage);
      const closeQty = ts.replayShortQuantity() * (cfg.shortClosePercent / 100);
      if (closeQty >= 0.000001 && ts.decreaseShort(closeQty, price)) {
        this.logTrade('SHORT COVER (MaxPos)', price, closeQty, rsi,
          `Position ${shortPositionPct.toFixed(1)}% > ${cfg.shortMaxPositionPercent}% und +${shortPnlPct.toFixed(1)}% Gewinn → Cover ${cfg.shortClosePercent}%`);
        this.shortCloseCandlesSince = 0;
        this.strategyTradeCount.update(n => n + 1);
        shortTradeDone = true;
      }
    }
  }

  this.shortOpenCandlesSince = Math.min(this.shortOpenCandlesSince + 1, cfg.shortOpenCooldown + 1);
  this.shortCloseCandlesSince = Math.min(this.shortCloseCandlesSince + 1, cfg.shortCloseCooldown + 1);
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
    this.positionSizeFactor = 1;
    this.longLossCutTriggered = false;
    this.shortLossCutTriggered = false;

    this.longOpenCandlesSince = 999;
    this.longCloseCandlesSince = 999;
    this.shortOpenCandlesSince = 999;
    this.shortCloseCandlesSince = 999;
    this.longCandlesInLoss = 0;
    this.shortCandlesInLoss = 0;

    this.strategyLog.set([]);
    this.strategyTradeCount.set(0);
    this.tradingService.resetPortfolio();

    this.rsiAvgGain = 0; this.rsiAvgLoss = 0;
    this.rsiInitialized = false; this.rsiPrevPrice = 0;
    this.ema50Value = 0; this.ema200Value = 0;
    this.ema50Ready = false; this.ema200Ready = false;
    this.ema50SumCount = 0; this.ema200SumCount = 0;
    this.ema50Sum = 0; this.ema200Sum = 0;
    this.lastDrawnIndex = 0;

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
      this.updatePositionSizeFactor();
      this.checkStrategyTrade();



      // ── Profit-Harvest nur bei aktivem Vault ──
      if (this.strategyConfig.useSafetyVault && this.tradingService.checkProfitHarvest()) {
        const count = this.tradingService.harvestCount();
        const vault = this.tradingService.safetyVault();
        const harvest = this.tradingService.replayInitialBalance;
        this.logTrade(
          'HARVEST', this.getCurrentPrice(), 0, this.currentRSI() ?? 0,
          `💰 Profit x${count}: $${harvest.toFixed(0)} in Safe Vault gesichert | Vault gesamt: $${vault.toFixed(0)}`
        );
      }

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
      sessionType: 'strategy',
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

    this.rsiLongBuyLine = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.longRsiBuyThreshold,
      color: '#26a69a', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `L-Buy (${this.strategyConfig.longRsiBuyThreshold})`
    });
    this.rsiLongSellLine = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.longRsiSellThreshold,
      color: '#ef5350', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `L-Sell (${this.strategyConfig.longRsiSellThreshold})`
    });
    this.rsiShortBuyLine = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.shortRsiBuyThreshold,
      color: '#80cbc4', lineWidth: 1, lineStyle: 3,
      axisLabelVisible: true, title: `S-Cover (${this.strategyConfig.shortRsiBuyThreshold})`
    });
    this.rsiShortSellLine = this.rsiSeries.createPriceLine({
      price: this.strategyConfig.shortRsiSellThreshold,
      color: '#ef9a9a', lineWidth: 1, lineStyle: 3,
      axisLabelVisible: true, title: `S-Open (${this.strategyConfig.shortRsiSellThreshold})`
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

  // ── Chart Update (inkrementell + periodischer Trim) ──────────────
  updateChart() {
    if (!this.candleSeries || !this.chart) return;
    const index = this.currentCandleIndex();

    if (index === 0) {
      this.candleSeries.setData([]);
      this.ema50Series?.setData([]);
      this.ema200Series?.setData([]);
      this.rsiSeries?.setData([]);
      this.currentRSI.set(null);
      this.updateEntryPriceLines();
      return;
    }

    const candle = this.allCandles[index - 1];
    const t = (candle.timestamp / 1000) as Time;
    const close = candle.close;

    // ── Periodisches Trim ────────────────────────────────────────────
    if (index > this.CHART_DISPLAY_WINDOW && index % this.CHART_TRIM_INTERVAL === 0) {
      const trimFrom = index - this.CHART_DISPLAY_WINDOW;

      this.candleSeries.setData(this.allCandles.slice(trimFrom, index).map(c => ({
        time: (c.timestamp / 1000) as Time,
        open: c.open, high: c.high, low: c.low, close: c.close
      })));

      if (this.showEma50() && this.ema50Series && this.ema50Ready)
        this._redrawEmaWindow(this.ema50Series, 50, trimFrom, index);
      if (this.showEma200() && this.ema200Series && this.ema200Ready)
        this._redrawEmaWindow(this.ema200Series, 200, trimFrom, index);
      if (this.showRSI() && this.rsiSeries)
        this._redrawRsiWindow(trimFrom, index);

      this.lastDrawnIndex = index;
      this.updateEntryPriceLines();
      this._updateTimeScale(index);
      return;
    }

    // ── Fallback: vollständiger Neuaufbau (nach stepBackward/reset) ──
    if (index <= this.lastDrawnIndex) {
      this._fullRedraw(index);
      return;
    }

    // ── Inkrementelles Update ────────────────────────────────────────
    this.candleSeries.update({ time: t, open: candle.open, high: candle.high, low: candle.low, close });

    // EMA 50
    if (this.showEma50() && this.ema50Series) {
      if (!this.ema50Ready) {
        this.ema50Sum += close;
        this.ema50SumCount++;
        if (this.ema50SumCount >= 50) {
          this.ema50Value = this.ema50Sum / 50;
          this.ema50Ready = true;
          this.ema50Series.update({ time: t, value: this.ema50Value });
        }
      } else {
        this.ema50Value = (close - this.ema50Value) * (2 / 51) + this.ema50Value;
        this.ema50Series.update({ time: t, value: this.ema50Value });
      }
    }

    // EMA 200
    if (this.showEma200() && this.ema200Series) {
      if (!this.ema200Ready) {
        this.ema200Sum += close;
        this.ema200SumCount++;
        if (this.ema200SumCount >= 200) {
          this.ema200Value = this.ema200Sum / 200;
          this.ema200Ready = true;
          this.ema200Series.update({ time: t, value: this.ema200Value });
        }
      } else {
        this.ema200Value = (close - this.ema200Value) * (2 / 201) + this.ema200Value;
        this.ema200Series.update({ time: t, value: this.ema200Value });
      }
    }

    // RSI (Wilder's Smoothing)
    if (this.showRSI() && this.rsiSeries) {
      if (this.rsiPrevPrice === 0) {
        this.rsiPrevPrice = close;
      } else {
        const change = close - this.rsiPrevPrice;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        if (!this.rsiInitialized) {
          this.rsiAvgGain += gain;
          this.rsiAvgLoss += loss;
          if ((index - 1) >= this.RSI_PERIOD) {
            this.rsiAvgGain /= this.RSI_PERIOD;
            this.rsiAvgLoss /= this.RSI_PERIOD;
            this.rsiInitialized = true;
            const rsiVal = this.rsiAvgLoss === 0 ? 100 : 100 - 100 / (1 + this.rsiAvgGain / this.rsiAvgLoss);
            this.rsiSeries.update({ time: t, value: rsiVal });
            this.currentRSI.set(rsiVal);
          }
        } else {
          this.rsiAvgGain = (this.rsiAvgGain * (this.RSI_PERIOD - 1) + gain) / this.RSI_PERIOD;
          this.rsiAvgLoss = (this.rsiAvgLoss * (this.RSI_PERIOD - 1) + loss) / this.RSI_PERIOD;
          const rsiVal = this.rsiAvgLoss === 0 ? 100 : 100 - 100 / (1 + this.rsiAvgGain / this.rsiAvgLoss);
          this.rsiSeries.update({ time: t, value: rsiVal });
          this.currentRSI.set(rsiVal);
        }
        this.rsiPrevPrice = close;
      }
    }

    this.lastDrawnIndex = index;
    this.updateEntryPriceLines();
    this._updateTimeScale(index);
  }

  // ── Chart-Hilfsmethoden ──────────────────────────────────────────
  private _updateTimeScale(index: number) {
    if (!this.chart || this.userIsScrolling) return;
    const ts = this.chart.timeScale();
    if (index <= this.FIT_THRESHOLD) ts.fitContent();
    else ts.setVisibleLogicalRange({ from: index - this.VISIBLE_CANDLES, to: index + 5 });
  }

  private _fullRedraw(index: number) {
    if (!this.candleSeries) return;
    const sliced = this.allCandles.slice(0, index);

    this.candleSeries.setData(sliced.map(c => ({
      time: (c.timestamp / 1000) as Time,
      open: c.open, high: c.high, low: c.low, close: c.close
    })));

    if (this.showEma50() && this.ema50Series && sliced.length > 0) {
      const ema50 = this.calculateEMA(sliced.map(c => c.close), 50);
      this.ema50Series.setData(sliced.map((c, i) => ({ time: (c.timestamp / 1000) as Time, value: ema50[i] })));
    }
    if (this.showEma200() && this.ema200Series && sliced.length > 0) {
      const ema200 = this.calculateEMA(sliced.map(c => c.close), 200);
      this.ema200Series.setData(sliced.map((c, i) => ({ time: (c.timestamp / 1000) as Time, value: ema200[i] })));
    }
    if (this.showRSI() && this.rsiSeries && sliced.length > this.RSI_PERIOD) {
      const rsiValues = this.calculateRSI(sliced.map(c => c.close), this.RSI_PERIOD);
      this.rsiSeries.setData(rsiValues.map((value, i) => ({
        time: (sliced[i + this.RSI_PERIOD].timestamp / 1000) as Time, value
      })));
      this.currentRSI.set(rsiValues[rsiValues.length - 1] ?? null);
    }

    this.lastDrawnIndex = index;
    this.updateEntryPriceLines();
    this._updateTimeScale(index);
  }

  private _redrawEmaWindow(series: ISeriesApi<'Line'>, period: number, from: number, to: number) {
    const contextStart = Math.max(0, from - period * 2);
    const contextCandles = this.allCandles.slice(contextStart, to);
    const emaAll = this.calculateEMA(contextCandles.map(c => c.close), period);
    const windowOffset = from - contextStart;
    series.setData(contextCandles.slice(windowOffset).map((c, i) => ({
      time: (c.timestamp / 1000) as Time,
      value: emaAll[windowOffset + i]
    })));
  }

  private _redrawRsiWindow(from: number, to: number) {
    if (!this.rsiSeries) return;
    const contextStart = Math.max(0, from - this.RSI_PERIOD * 3);
    const contextCandles = this.allCandles.slice(contextStart, to);
    const rsiAll = this.calculateRSI(contextCandles.map(c => c.close), this.RSI_PERIOD);
    const windowOffset = from - contextStart;
    const rsiWindow = rsiAll.slice(Math.max(0, windowOffset - this.RSI_PERIOD));
    const startIdx = Math.max(contextStart + this.RSI_PERIOD, from);
    this.rsiSeries.setData(
      rsiWindow
        .map((value, i) => ({ time: (this.allCandles[startIdx + i]?.timestamp / 1000) as Time, value }))
        .filter(d => d.time)
    );
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

  // ── Indikatoren ──────────────────────────────────────────────────
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
          priceLineVisible: false, lastValueVisible: true
        });
        this.rsiLongBuyLine = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.longRsiBuyThreshold,
          color: '#26a69a', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: `L-Buy (${this.strategyConfig.longRsiBuyThreshold})`
        });
        this.rsiLongSellLine = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.longRsiSellThreshold,
          color: '#ef5350', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: `L-Sell (${this.strategyConfig.longRsiSellThreshold})`
        });
        this.rsiShortBuyLine = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.shortRsiBuyThreshold,
          color: '#80cbc4', lineWidth: 1, lineStyle: 3,
          axisLabelVisible: true, title: `S-Cover (${this.strategyConfig.shortRsiBuyThreshold})`
        });
        this.rsiShortSellLine = this.rsiSeries.createPriceLine({
          price: this.strategyConfig.shortRsiSellThreshold,
          color: '#ef9a9a', lineWidth: 1, lineStyle: 3,
          axisLabelVisible: true, title: `S-Open (${this.strategyConfig.shortRsiSellThreshold})`
        });
      } else if (this.rsiSeries) {
        this.rsiChart.removeSeries(this.rsiSeries);
        this.rsiSeries = null;
        this.rsiLongBuyLine = this.rsiLongSellLine = null;
        this.rsiShortBuyLine = this.rsiShortSellLine = null;
      }
      this.updateChart();
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────
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

  longCooldownProgress(): number {
    const c = Math.min(this.longOpenCandlesSince, this.strategyConfig.longOpenCooldown);
    return Math.round((c / this.strategyConfig.longOpenCooldown) * 100);
  }
  longCooldownRemaining(): number {
    return Math.max(0, this.strategyConfig.longOpenCooldown - this.longOpenCandlesSince);
  }
  shortCooldownProgress(): number {
    const c = Math.min(this.shortOpenCandlesSince, this.strategyConfig.shortOpenCooldown);
    return Math.round((c / this.strategyConfig.shortOpenCooldown) * 100);
  }
  shortCooldownRemaining(): number {
    return Math.max(0, this.strategyConfig.shortOpenCooldown - this.shortOpenCandlesSince);
  }

  toggleStrategyLog() {
    this.showStrategyLog.update(v => !v);
  }
}