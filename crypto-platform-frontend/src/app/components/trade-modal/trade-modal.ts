import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioAssetDto } from '../../models/portfolio.model';

@Component({
  selector: 'app-trade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="close()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ tradeType() === 'buy' ? '🟢 Buy' : '🔴 Sell' }} {{ asset()?.symbol }}</h2>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          <div class="modal-body">
            <!-- Current Info -->
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Current Price</span>
                <span class="value">\${{ asset()?.currentPriceUsd | number:'1.2-2' }}</span>
              </div>
              @if (tradeType() === 'sell') {
                <div class="info-item">
                  <span class="label">Holdings</span>
                  <span class="value">{{ asset()?.quantity | number:'1.0-8' }}</span>
                </div>
              }
            </div>

            <!-- Input Fields -->
            <div class="input-group">
              <label>Quantity</label>
              <input 
                type="number" 
                [(ngModel)]="quantityInput"
                (input)="onInputChange()"
                placeholder="0.00000000"
                step="0.00000001"
                min="0"
                class="input-field"
              />
            </div>

            <div class="input-group">
              <label>Price per Coin</label>
              <input 
                type="number" 
                [(ngModel)]="priceInput"
                (input)="onInputChange()"
                [placeholder]="asset()?.currentPriceUsd?.toString() || '0.00'"
                step="0.01"
                min="0"
                class="input-field"
              />
            </div>

            <!-- Total Cost -->
            <div class="total-section">
              <div class="total-label">Total {{ tradeType() === 'buy' ? 'Cost' : 'Value' }}</div>
              <div class="total-value">\${{ totalCost() | number:'1.2-2' }}</div>
            </div>

            <!-- Error Message -->
            @if (errorMessage()) {
              <div class="error-message">
                ⚠️ {{ errorMessage() }}
              </div>
            }

            <!-- Debug Info (temporary) -->
            <div style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">
              Debug: Q={{ quantityInput }} | P={{ priceInput }} | Total={{ totalCost() }} | Valid={{ canTrade() }}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button 
              [class]="tradeType() === 'buy' ? 'btn-buy-confirm' : 'btn-sell-confirm'"
              (click)="confirmTrade()"
              [disabled]="!canTrade()"
            >
              {{ tradeType() === 'buy' ? 'Buy' : 'Sell' }} {{ asset()?.symbol }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;

      h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
      }
    }

    .close-btn {
      background: none;
      border: none;
      color: #999;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }

    .modal-body {
      padding: 1.5rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .info-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .label {
        color: #999;
        font-size: 0.875rem;
      }

      .value {
        color: #fff;
        font-size: 1.125rem;
        font-weight: 600;
      }
    }

    .input-group {
      margin-bottom: 1.25rem;

      label {
        display: block;
        color: #999;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
    }

    .input-field {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.875rem;
      color: #fff;
      font-size: 1rem;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: #2962ff;
        background: rgba(255, 255, 255, 0.08);
      }

      &::placeholder {
        color: #666;
      }
    }

    .total-section {
      background: rgba(41, 98, 255, 0.1);
      border: 1px solid rgba(41, 98, 255, 0.3);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .total-label {
        color: #2962ff;
        font-weight: 500;
      }

      .total-value {
        color: #fff;
        font-size: 1.5rem;
        font-weight: 700;
      }
    }

    .error-message {
      background: rgba(239, 83, 80, 0.1);
      border: 1px solid rgba(239, 83, 80, 0.3);
      border-radius: 8px;
      padding: 0.875rem;
      color: #ef5350;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 1rem;
    }

    .btn-cancel {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 0.875rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .btn-buy-confirm {
      flex: 2;
      background: linear-gradient(135deg, #26a69a 0%, #1e8e7e 100%);
      border: none;
      color: white;
      padding: 0.875rem;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(38, 166, 154, 0.3);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(38, 166, 154, 0.4);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    }

    .btn-sell-confirm {
      flex: 2;
      background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
      border: none;
      color: white;
      padding: 0.875rem;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(239, 83, 80, 0.3);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(239, 83, 80, 0.4);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    }
  `]
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