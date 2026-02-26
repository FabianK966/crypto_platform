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

  // Lokale Kopien für ngModel
  localSymbol = '';
  localInterval = '';
  localStartDate = '';
  localEndDate = '';
  localLeverage = 1;

  // Lokale Strategie-Kopien
  localRsiBuy = 30;
  localRsiSell = 70;
  localBuyPercent = 10;
  localClosePercent = 50;
  localCooldown = 10;
  localAutoShort = true;

  ngOnInit() {
    this.localSymbol    = this.selectedSymbol;
    this.localInterval  = this.selectedInterval;
    this.localStartDate = this.startDate;
    this.localEndDate   = this.endDate;
    this.localLeverage  = this.selectedLeverage;

    if (this.strategyConfig) {
      this.localRsiBuy      = this.strategyConfig.rsiBuyThreshold;
      this.localRsiSell     = this.strategyConfig.rsiSellThreshold;
      this.localBuyPercent  = this.strategyConfig.buyPortfolioPercent;
      this.localClosePercent = this.strategyConfig.closePositionPercent;
      this.localCooldown    = this.strategyConfig.cooldownCandles;
      this.localAutoShort   = this.strategyConfig.autoShortEnabled;
    }
  }

  onSymbolChange()    { this.emitConfigChange(); }
  onIntervalChange()  { this.emitConfigChange(); }
  onStartDateChange() { this.emitConfigChange(); }
  onEndDateChange()   { this.emitConfigChange(); }
  onLeverageChange()  { this.emitConfigChange(); }

  private emitConfigChange() {
    this.configChange.emit({
      symbol: this.localSymbol, interval: this.localInterval,
      startDate: this.localStartDate, endDate: this.localEndDate,
      leverage: this.localLeverage
    });
  }

  onStrategyChange() {
    this.strategyChange.emit({
      rsiBuyThreshold:      this.localRsiBuy,
      rsiSellThreshold:     this.localRsiSell,
      buyPortfolioPercent:  this.localBuyPercent,
      closePositionPercent: this.localClosePercent,
      cooldownCandles:      this.localCooldown,
      autoShortEnabled:     this.localAutoShort
    });
  }

  get symbolOptions() {
    return this.availableSymbols.map(s => ({ label: s, value: s }));
  }
}
