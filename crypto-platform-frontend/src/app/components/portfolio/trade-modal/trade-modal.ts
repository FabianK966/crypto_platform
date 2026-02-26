import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioAssetDto } from '../../../models/portfolio.model';

@Component({
  selector: 'app-trade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trade-modal.html',
  styleUrl: './trade-modal.css'
})

export class TradeModalComponent {
  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (!value) {
      this.reset();
    }
  }

  @Input() set type(value: 'buy' | 'sell') {
    this.tradeType.set(value);
  }

  @Input() set assetData(value: PortfolioAssetDto | null) {
    this.asset.set(value);
    if (value && value.currentPriceUsd > 0) {
      this.priceInput = value.currentPriceUsd;
      this.onInputChange();
    }
  }

  @Output() closeModal = new EventEmitter<void>();
  @Output() trade = new EventEmitter<{ quantity: number; price: number }>();

  isOpen = signal(false);
  tradeType = signal<'buy' | 'sell'>('buy');
  asset = signal<PortfolioAssetDto | null>(null);
  errorMessage = signal<string | null>(null);
  totalCost = signal(0);
  canTrade = signal(false);

  quantityInput: number = 0;
  priceInput: number = 0;

  onInputChange() {
    const total = (this.quantityInput || 0) * (this.priceInput || 0);
    this.totalCost.set(total);
    this.validate();
  }

  validate() {
    this.errorMessage.set(null);

    const qty = this.quantityInput || 0;
    const prc = this.priceInput || 0;
    const asset = this.asset();

    if (qty <= 0) {
      this.errorMessage.set('Menge muss größer als 0 sein');
      this.canTrade.set(false);
      return;
    }

    if (prc <= 0) {
      this.errorMessage.set('Preis muss größer als 0 sein');
      this.canTrade.set(false);
      return;
    }

    if (this.tradeType() === 'sell' && asset) {
      if (qty > asset.quantity) {
        this.errorMessage.set(`Du kannst maximal ${asset.quantity.toFixed(6)} ${asset.symbol} verkaufen`);
        this.canTrade.set(false);
        return;
      }
    }

    this.canTrade.set(true);
  }

  confirmTrade() {
    if (this.canTrade()) {
      this.trade.emit({
        quantity: this.quantityInput,
        price: this.priceInput
      });
      this.close();
    }
  }

  close() {
    this.reset();
    this.closeModal.emit();
  }

  reset() {
    this.quantityInput = 0;
    this.priceInput = 0;
    this.totalCost.set(0);
    this.errorMessage.set(null);
    this.canTrade.set(false);
  }
}