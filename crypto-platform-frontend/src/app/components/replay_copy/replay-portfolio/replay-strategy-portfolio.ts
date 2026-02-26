// Zeigt das Portfolio an: Cash, Margin, Positionen, PnL, und bietet Buttons zum Handeln.
// Enthält auch die Trade- und Deposit-Modals sowie die History.

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplayTradingService } from '../services/replay-strategy-trading.service';
import { ReplayTradeModalComponent } from '../replay-trade-modal/replay-strategy-trade-modal';
import { ReplayDepositModalComponent } from '../replay-deposit-modal/replay-strategy-deposit-modal';
import { ReplayHistoryComponent } from '../replay-history/replay-strategy-history';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-replay-portfolio',
  standalone: true,
  imports: [CommonModule, ReplayTradeModalComponent, FormsModule, ReplayDepositModalComponent, ReplayHistoryComponent],
  templateUrl: './replay-strategy-portfolio.html',
  styleUrl: './replay-strategy-portfolio.css'
})
export class ReplayPortfolioComponent {
  @Input() selectedSymbol!: string;               // Aktuelles Symbol
  @Input() currentPrice!: number;                  // Aktueller Preis (von Hauptkomponente)
  @Input() isPlaying!: boolean;                     // Läuft Wiedergabe?
  @Input() tradingService!: ReplayTradingService;   // TradingService

  initialBalanceInput = 10000;                       // Feld für Startguthaben
  tradeModalOpen = false;                            // Ist Trade-Modal sichtbar?
  tradeModalType: 'buy' | 'sell' = 'buy';             // Typ für Modal
  tradeModalPosition: 'long' | 'short' = 'long';      // Position für Modal
  depositModalOpen = false;                            // Ist Deposit-Modal sichtbar?

  // Setzt das Startguthaben im Service (nur wenn keine offenen Positionen/Historie)
  setBalance() {
    const amount = Number(this.initialBalanceInput);
    if (amount > 0) {
      this.tradingService.setInitialBalance(amount);
    }
  }

  // Setzt das gesamte Portfolio zurück
  resetPortfolio() {
    this.tradingService.resetPortfolio();
  }

  // Öffnet das Trade-Modal mit den übergebenen Parametern
  openTradeModal(type: 'buy' | 'sell', position: 'long' | 'short') {
    this.tradeModalType = type;
    this.tradeModalPosition = position;
    this.tradeModalOpen = true;
  }

  closeTradeModal() {
    this.tradeModalOpen = false;
  }

  openDepositModal() {
    this.depositModalOpen = true;
  }

  closeDepositModal() {
    this.depositModalOpen = false;
  }

  // Prüft, ob Trading-Buttons deaktiviert sein sollen (während Wiedergabe oder kein Preis)
  isTradeDisabled(): boolean {
    return this.isPlaying || this.currentPrice <= 0;
  }
}