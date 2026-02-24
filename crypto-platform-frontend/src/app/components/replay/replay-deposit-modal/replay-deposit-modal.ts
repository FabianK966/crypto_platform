// Modal für Einzahlungen (Deposit). Wird von ReplayPortfolio geöffnet.

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayTradingService } from '../services/replay-trading.service';

@Component({
  selector: 'app-replay-deposit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './replay-deposit-modal.html',
  styleUrl: './replay-deposit-modal.css'
})
export class ReplayDepositModalComponent {
  @Input() tradingService!: ReplayTradingService;
  @Output() close = new EventEmitter<void>();

  depositAmount = 0;   // Vom Benutzer eingegebener Betrag

  // Setzt einen Schnellbetrag
  setQuickAmount(amount: number) {
    this.depositAmount = amount;
  }

  // Führt die Einzahlung aus
  confirmDeposit() {
    const amount = Number(this.depositAmount);
    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    this.tradingService.deposit(amount);
    this.close.emit();
  }
}