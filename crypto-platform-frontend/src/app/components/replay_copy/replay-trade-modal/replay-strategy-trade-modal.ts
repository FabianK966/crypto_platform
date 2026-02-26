// Modal für die Ausführung eines Trades (Kauf/Verkauf von Long/Short).
// Wird von ReplayPortfolio geöffnet.

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayTradingService } from '../services/replay-strategy-trading.service';

@Component({
  selector: 'app-replay-trade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './replay-strategy-trade-modal.html',
  styleUrl: './replay-strategy-trade-modal.css'
})
export class ReplayTradeModalComponent {
  @Input() type!: 'buy' | 'sell';                 // Art des Trades
  @Input() positionType!: 'long' | 'short';        // Betroffene Position
  @Input() currentPrice!: number;                  // Aktueller Preis (von der Hauptkomponente)
  @Input() tradingService!: ReplayTradingService;  // Service-Referenz
  @Input() selectedSymbol!: string;                 // Symbol für Anzeige
  @Output() close = new EventEmitter<void>();       // Schließen des Modals

  quantityInput = 0;                                 // Vom Benutzer eingegebene Menge

  // Liefert den passenden Titel je nach Typ und Position
  getTitle(): string {
    if (this.type === 'buy' && this.positionType === 'long') return '🟢 Buy Long';
    if (this.type === 'sell' && this.positionType === 'long') return '🔴 Sell Long';
    if (this.type === 'sell' && this.positionType === 'short') return '🔴 Short More';
    if (this.type === 'buy' && this.positionType === 'short') return '🟢 Cover Short';
    return 'Trade';
  }

  // Liefert den anzuzeigenden verfügbaren Betrag (Cash oder Positionsgröße)
  getAvailableAmount(): string {
    if (this.type === 'buy' && this.positionType === 'long') {
      return `$ ${this.tradingService.replayCashBalance().toFixed(2)}`;
    }
    if (this.type === 'sell' && this.positionType === 'long') {
      return `${this.tradingService.replayLongQuantity().toFixed(8)} ${this.selectedSymbol}`;
    }
    if (this.type === 'sell' && this.positionType === 'short') {
      return `$ ${this.tradingService.replayCashBalance().toFixed(2)}`;
    }
    if (this.type === 'buy' && this.positionType === 'short') {
      return `${this.tradingService.replayShortQuantity().toFixed(8)} ${this.selectedSymbol}`;
    }
    return '';
  }

  // Setzt die Menge auf einen bestimmten Prozentsatz des Maximums
  setPercent(percent: number) {
    const leverage = this.tradingService.selectedLeverage();

    if ((this.type === 'buy' && this.positionType === 'long') || (this.type === 'sell' && this.positionType === 'short')) {
      // Bei Kauf Long oder Short More: Maximal mögliche Menge basierend auf freier Margin und Hebel
      const maxQty = (this.tradingService.freeMargin() * leverage) / this.currentPrice;
      this.quantityInput = Math.floor(maxQty * (percent / 100) * 100000) / 100000; // Auf 5 Nachkommastellen runden
    } else if (this.type === 'sell' && this.positionType === 'long') {
      // Verkauf Long: Maximal vorhandene Long-Menge
      this.quantityInput = Math.floor(this.tradingService.replayLongQuantity() * (percent / 100) * 100000) / 100000;
    } else if (this.type === 'buy' && this.positionType === 'short') {
      // Cover Short: Maximal vorhandene Short-Menge
      this.quantityInput = Math.floor(this.tradingService.replayShortQuantity() * (percent / 100) * 100000) / 100000;
    }
  }

  // Berechnet die geschätzte Gebühr für die aktuelle Eingabe
  getEstimatedFee(): number {
    if (this.quantityInput <= 0 || this.currentPrice <= 0) return 0;
    const transactionValue = this.quantityInput * this.currentPrice;
    return this.tradingService.calculateFeeForValue(transactionValue);
  }

  // Berechnet die geschätzte realisierte PnL für die aktuelle Eingabe (nur für Verkauf/Deckung)
  getEstimatedPnl(): number {
    if (this.quantityInput <= 0 || this.currentPrice <= 0) return 0;

    // Bei Verkauf einer Long-Position
    if (this.type === 'sell' && this.positionType === 'long') {
      const avgPrice = this.tradingService.replayLongAvgPrice();
      const qty = Math.min(this.quantityInput, this.tradingService.replayLongQuantity());
      return (this.currentPrice - avgPrice) * qty;
    }

    // Bei Rückkauf einer Short-Position (Cover)
    if (this.type === 'buy' && this.positionType === 'short') {
      const avgPrice = this.tradingService.replayShortAvgPrice();
      const qty = Math.min(this.quantityInput, this.tradingService.replayShortQuantity());
      return (avgPrice - this.currentPrice) * qty;
    }

    // Bei anderen Aktionen (Kauf, Short More) gibt es keinen realisierten PnL
    return 0;
  }

  // Führt den Trade aus, wenn der Benutzer bestätigt
  confirmTrade() {
    const qty = Number(this.quantityInput);
    if (qty <= 0 || this.currentPrice <= 0) return;

    let success = false;

    // Je nach Kombination die entsprechende Methode im TradingService aufrufen
    if (this.type === 'buy' && this.positionType === 'long') {
      success = this.tradingService.increaseLong(qty, this.currentPrice);
      if (!success) alert('Insufficient cash for margin');
    } else if (this.type === 'sell' && this.positionType === 'long') {
      success = this.tradingService.decreaseLong(qty, this.currentPrice);
      if (!success) alert('Cannot sell more than your position');
    } else if (this.type === 'sell' && this.positionType === 'short') {
      success = this.tradingService.increaseShort(qty, this.currentPrice);
      if (!success) alert('Insufficient equity for margin');
    } else if (this.type === 'buy' && this.positionType === 'short') {
      success = this.tradingService.decreaseShort(qty, this.currentPrice);
      if (!success) alert('Cannot cover more than your position');
    }

    if (success) {
      this.close.emit(); // Modal schließen bei Erfolg
    }
  }
}