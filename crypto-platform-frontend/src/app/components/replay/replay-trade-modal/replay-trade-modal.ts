// src/app/components/replay/components/replay-trade-modal/replay-trade-modal.component.ts

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayTradingService } from '../services/replay-trading.service';

@Component({
  selector: 'app-replay-trade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './replay-trade-modal.html',
  styleUrl: './replay-trade-modal.css'
})
export class ReplayTradeModalComponent {
  @Input() type!: 'buy' | 'sell';
  @Input() positionType!: 'long' | 'short';
  @Input() currentPrice!: number;
  @Input() tradingService!: ReplayTradingService;
  @Input() selectedSymbol!: string;
  @Output() close = new EventEmitter<void>();

  quantityInput = 0;

  getTitle(): string {
    if (this.type === 'buy' && this.positionType === 'long') return '🟢 Buy Long';
    if (this.type === 'sell' && this.positionType === 'long') return '🔴 Sell Long';
    if (this.type === 'sell' && this.positionType === 'short') return '🔴 Short More';
    if (this.type === 'buy' && this.positionType === 'short') return '🟢 Cover Short';
    return 'Trade';
  }

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

  setPercent(percent: number) {
    const leverage = this.tradingService.selectedLeverage();

    if ((this.type === 'buy' && this.positionType === 'long') || (this.type === 'sell' && this.positionType === 'short')) {
      const maxQty = (this.tradingService.freeMargin() * leverage) / this.currentPrice;
      this.quantityInput = Math.floor(maxQty * (percent / 100) * 100000) / 100000;
    } else if (this.type === 'sell' && this.positionType === 'long') {
      this.quantityInput = Math.floor(this.tradingService.replayLongQuantity() * (percent / 100) * 100000) / 100000;
    } else if (this.type === 'buy' && this.positionType === 'short') {
      this.quantityInput = Math.floor(this.tradingService.replayShortQuantity() * (percent / 100) * 100000) / 100000;
    }
  }

  confirmTrade() {
    const qty = Number(this.quantityInput);
    if (qty <= 0 || this.currentPrice <= 0) return;

    let success = false;

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
      this.close.emit();
    }
  }
}