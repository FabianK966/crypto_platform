// Sidebar für den Strategy-Replay: enthält alle normalen Konfigurationsfelder
// PLUS die Strategie-Parameter (RSI-Schwellen, Prozentwerte, Cooldown).

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { IntervalOption, StrategyConfig } from '../../../models/replay.model';

@Component({
  selector: 'app-replay-strategy-config-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule],
  templateUrl: './replay-strategy-config-sidebar.html',
  styleUrl: './replay-strategy-config-sidebar.css'
})
export class ReplayStrategyConfigSidebarComponent implements OnInit {

  // ── Bestehende Chart-Konfiguration ──────────────────────────────
  @Input() availableSymbols: string[] = [];
  @Input() availableIntervals: IntervalOption[] = [];
  @Input() selectedSymbol!: string;
  @Input() selectedInterval!: string;
  @Input() startDate!: string;
  @Input() endDate!: string;
  @Input() today!: string;
  @Input() selectedLeverage!: number;
  @Input() showEma50!: boolean;
  @Input() showEma200!: boolean;
  @Input() loading!: boolean;
  @Input() error: string | null = null;
  @Input() candlesLoaded!: boolean;
  @Input() totalCandles!: number;
  @Input() isPlaying!: boolean;
  @Input() showRSI!: boolean;

  // ── Strategie-Konfiguration ──────────────────────────────────────
  @Input() strategyConfig!: StrategyConfig;

  // ── Outputs ──────────────────────────────────────────────────────
  @Output() configChange = new EventEmitter<{
    symbol: string; interval: string; startDate: string; endDate: string; leverage: number;
  }>();
  @Output() loadData = new EventEmitter<void>();
  @Output() toggleEma50 = new EventEmitter<void>();
  @Output() toggleEma200 = new EventEmitter<void>();
  @Output() toggleRSI = new EventEmitter<void>();
  @Output() strategyChange = new EventEmitter<StrategyConfig>();

  leverageOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 30, 50, 75, 100];
  localLongLeverage = 1;
  localShortLeverage = 1;

  // Lokale Kopien für ngModel
  localSymbol = '';
  localInterval = '';
  localStartDate = '';
  localEndDate = '';
  localLeverage = 1;

  // Lokale Strategie-Kopien
  localLongRsiBuy = 30;
  localLongRsiSell = 70;
  localShortRsiBuy = 30;
  localShortRsiSell = 70;
  localLongOpenCooldown = 10;
  localLongCloseCooldown = 3;
  localShortOpenCooldown = 10;
  localShortCloseCooldown = 3;
  localLongBuyScaleThreshold = 10;
  localLongBuyScalePercent = 10;
  localShortBuyScaleThreshold = 10;
  localShortBuyScalePercent = 10;
  localBuyPercent = 10;
  localClosePercent = 50;
  localAutoShort = true;
  localLongFreeZone = 30;
  localShortFreeZone = 30;
  localProfit = 10;
  localLoss = 10;
  // Lokale Strategie-Kopien — LONG
  localLongBuyPercent = 10;
  localLongMaxPositionPercent = 100;
  localLongClosePercent = 50;
  localLongProfit = 10;
  localLongLoss = 10;
  // Lokale Strategie-Kopien — SHORT
  localShortBuyPercent = 10;
  localShortMaxPositionPercent = 100;
  localShortClosePercent = 50;
  localShortProfit = 10;
  localShortLoss = 10;
  // Drawdown-Rescue Long
  localLongDrawdownCandles = 500;
  localLongRescueTrigger = 1;
  localLongRescueClosePercent = 50;
  // Drawdown-Rescue Short
  localShortDrawdownCandles = 500;
  localShortRescueTrigger = 1;
  localShortRescueClosePercent = 50;

  ngOnInit() {
    this.localSymbol = this.selectedSymbol;
    this.localInterval = this.selectedInterval;
    this.localStartDate = this.startDate;
    this.localEndDate = this.endDate;
    this.localLeverage = this.selectedLeverage;
    this.localLongLeverage = this.strategyConfig.longLeverage;
    this.localShortLeverage = this.strategyConfig.shortLeverage;
    this.localLongFreeZone = this.strategyConfig.longFreeZonePercent;
    this.localShortFreeZone = this.strategyConfig.shortFreeZonePercent;
    this.localLongBuyPercent = this.strategyConfig.longBuyPercent;
    this.localLongClosePercent = this.strategyConfig.longClosePercent;
    this.localLongProfit = this.strategyConfig.longProfitThreshold;
    this.localLongLoss = this.strategyConfig.longLossThreshold;
    this.localShortBuyPercent = this.strategyConfig.shortBuyPercent;
    this.localShortClosePercent = this.strategyConfig.shortClosePercent;
    this.localShortProfit = this.strategyConfig.shortProfitThreshold;
    this.localShortLoss = this.strategyConfig.shortLossThreshold;
    this.localLongMaxPositionPercent = this.strategyConfig.longMaxPositionPercent ?? 100;
    this.localShortMaxPositionPercent = this.strategyConfig.shortMaxPositionPercent ?? 100;

    if (this.strategyConfig) {
      this.localLongRsiBuy = this.strategyConfig.longRsiBuyThreshold;
      this.localLongRsiSell = this.strategyConfig.longRsiSellThreshold;
      this.localLongOpenCooldown = this.strategyConfig.longOpenCooldown;
      this.localLongCloseCooldown = this.strategyConfig.longCloseCooldown;
      this.localShortOpenCooldown = this.strategyConfig.shortOpenCooldown;
      this.localShortCloseCooldown = this.strategyConfig.shortCloseCooldown;
      this.localLongBuyScaleThreshold = this.strategyConfig.longBuyScaleThreshold;
      this.localLongBuyScalePercent = this.strategyConfig.longBuyScalePercent;
      this.localShortBuyScaleThreshold = this.strategyConfig.shortBuyScaleThreshold;
      this.localShortBuyScalePercent = this.strategyConfig.shortBuyScalePercent;
      this.localShortRsiBuy = this.strategyConfig.shortRsiBuyThreshold;
      this.localShortRsiSell = this.strategyConfig.shortRsiSellThreshold;
      this.localAutoShort = this.strategyConfig.autoShortEnabled;
      this.localLongDrawdownCandles = this.strategyConfig.longDrawdownCandles;
      this.localLongRescueTrigger = this.strategyConfig.longRescueTrigger;
      this.localLongRescueClosePercent = this.strategyConfig.longRescueClosePercent;
      this.localShortDrawdownCandles = this.strategyConfig.shortDrawdownCandles;
      this.localShortRescueTrigger = this.strategyConfig.shortRescueTrigger;
      this.localShortRescueClosePercent = this.strategyConfig.shortRescueClosePercent;
    }
  }

  onSymbolChange() { this.emitConfigChange(); }
  onIntervalChange() { this.emitConfigChange(); }
  onStartDateChange() { this.emitConfigChange(); }
  onEndDateChange() { this.emitConfigChange(); }
  onLeverageChange() { this.emitConfigChange(); }

  private emitConfigChange() {
    this.configChange.emit({
      symbol: this.localSymbol, interval: this.localInterval,
      startDate: this.localStartDate, endDate: this.localEndDate,
      leverage: this.localLeverage
    });
  }

  onStrategyChange() {
    this.strategyChange.emit({
      autoShortEnabled: this.localAutoShort,
      longRsiBuyThreshold: this.localLongRsiBuy,
      longRsiSellThreshold: this.localLongRsiSell,
      longLeverage: this.localLongLeverage,
      shortLeverage: this.localShortLeverage,
      longFreeZonePercent: this.localLongFreeZone,
      longBuyPercent: this.localLongBuyPercent,
      longClosePercent: this.localLongClosePercent,
      longOpenCooldown: this.localLongOpenCooldown,
      longCloseCooldown: this.localLongCloseCooldown,
      shortOpenCooldown: this.localShortOpenCooldown,
      shortCloseCooldown: this.localShortCloseCooldown,
      longBuyScaleThreshold: this.localLongBuyScaleThreshold,
      longBuyScalePercent: this.localLongBuyScalePercent,
      shortBuyScaleThreshold: this.localShortBuyScaleThreshold,
      shortBuyScalePercent: this.localShortBuyScalePercent,
      longProfitThreshold: this.localLongProfit,
      longLossThreshold: this.localLongLoss,
      longDrawdownCandles: this.localLongDrawdownCandles,
      longRescueTrigger: this.localLongRescueTrigger,
      longRescueClosePercent: this.localLongRescueClosePercent,
      shortDrawdownCandles: this.localShortDrawdownCandles,
      shortRescueTrigger: this.localShortRescueTrigger,
      shortRescueClosePercent: this.localShortRescueClosePercent,
      longMaxPositionPercent: this.localLongMaxPositionPercent,
      shortMaxPositionPercent: this.localShortMaxPositionPercent,
      shortRsiBuyThreshold: this.localShortRsiBuy,
      shortRsiSellThreshold: this.localShortRsiSell,
      shortFreeZonePercent: this.localShortFreeZone,
      shortBuyPercent: this.localShortBuyPercent,
      shortClosePercent: this.localShortClosePercent,
      shortProfitThreshold: this.localShortProfit,
      shortLossThreshold: this.localShortLoss,
    });
  }

  get symbolOptions() {
    return this.availableSymbols.map(s => ({ label: s, value: s }));
  }
}
