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
  localLongRsiSell = 72;
  localShortRsiBuy = 30;
  localShortRsiSell = 74;
  localLongOpenCooldown = 3;
  localLongCloseCooldown = 5;
  localShortOpenCooldown = 3;
  localShortCloseCooldown = 5;
  localLongBuyScaleThreshold = 25;
  localLongBuyScalePercent = 5;
  localShortBuyScaleThreshold = 20;
  localShortBuyScalePercent = 4;
  localMinLongPositionPercent = 4;
  localMinShortPositionPercent = 4;
  localAutoShort = true;
  localUseSafetyVault = true;
  localEnableLossCut = false;
  localLossCutThreshold = 100;
  localLongFreeZone = 15;
  localShortFreeZone = 10;
  localLongBuyPercent = 1;
  localLongMaxPositionPercent = 50;
  localLongClosePercent = 10;
  localLongProfit = 5;
  localLongLoss = 12;
  localShortBuyPercent = 1;
  localShortMaxPositionPercent = 30;
  localShortClosePercent = 20;
  localShortProfit = 4;
  localShortLoss = 16;
  localLongDrawdownCandles = 2000;
  localLongRescueTrigger = 9;
  localLongRescueClosePercent = 95;
  localShortDrawdownCandles = 2000;
  localShortRescueTrigger = 6;
  localShortRescueClosePercent = 98;

  ngOnInit() {
    this.localSymbol = this.selectedSymbol;
    this.localUseSafetyVault = this.strategyConfig.useSafetyVault;
    this.localEnableLossCut = this.strategyConfig.enableLossCut;
    this.localLossCutThreshold = this.strategyConfig.lossCutThreshold;
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
      useSafetyVault: this.localUseSafetyVault,
      enableLossCut: this.localEnableLossCut,
      lossCutThreshold: this.localLossCutThreshold,
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
      minlongpositionpercent: this.localMinLongPositionPercent,
      minshortpositionpercent: this.localMinShortPositionPercent
    });
  }

  get symbolOptions() {
    return this.availableSymbols.map(s => ({ label: s, value: s }));
  }
}
