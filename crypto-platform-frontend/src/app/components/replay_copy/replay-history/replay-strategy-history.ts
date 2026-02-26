// Zeigt die Trade- und Einzahlungshistorie in zwei Tabellen an.

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplayTradingService } from '../services/replay-strategy-trading.service';

@Component({
  selector: 'app-replay-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replay-strategy-history.html',
  styleUrl: './replay-strategy-history.css'
})
export class ReplayHistoryComponent {
  @Input() tradingService!: ReplayTradingService;   // Service mit Historien-Signalen
}