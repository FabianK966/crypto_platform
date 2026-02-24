// Sidebar zur Konfiguration des Backtests: Symbol, Intervall, Datum, Hebel, Indikatoren.
// Sendet Änderungen an die Hauptkomponente.

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { IntervalOption } from '../../../models/replay.model';

@Component({
  selector: 'app-replay-config-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule],
  templateUrl: './replay-config-sidebar.html',
  styleUrl: './replay-config-sidebar.css'
})
export class ReplayConfigSidebarComponent {
  // Alle Eingaben von der Elternkomponente
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

  // Events, die an die Elternkomponente gesendet werden
  @Output() configChange = new EventEmitter<{
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    leverage: number;
  }>();
  @Output() loadData = new EventEmitter<void>();
  @Output() toggleEma50 = new EventEmitter<void>();
  @Output() toggleEma200 = new EventEmitter<void>();
  @Output() toggleRSI = new EventEmitter<void>();

  leverageOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];   // Verfügbare Hebel

  // Lokale Kopien der Werte für zwei-Wege-Bindung (ngModel)
  localSymbol = '';
  localInterval = '';
  localStartDate = '';
  localEndDate = '';
  localLeverage = 1;

  ngOnInit() {
    // Initialisierung mit den Werten von @Input()
    this.localSymbol = this.selectedSymbol;
    this.localInterval = this.selectedInterval;
    this.localStartDate = this.startDate;
    this.localEndDate = this.endDate;
    this.localLeverage = this.selectedLeverage;
  }

  // Wenn sich eines der Felder ändert, wird ein configChange-Event ausgelöst
  onSymbolChange() { this.emitConfigChange(); }
  onIntervalChange() { this.emitConfigChange(); }
  onStartDateChange() { this.emitConfigChange(); }
  onEndDateChange() { this.emitConfigChange(); }
  onLeverageChange() { this.emitConfigChange(); }

  private emitConfigChange() {
    this.configChange.emit({
      symbol: this.localSymbol,
      interval: this.localInterval,
      startDate: this.localStartDate,
      endDate: this.localEndDate,
      leverage: this.localLeverage
    });
  }

  // Wandelt das Array von Strings in das von PrimeNG Select erwartete Format um
  get symbolOptions() {
    return this.availableSymbols.map(s => ({ label: s, value: s }));
  }
}