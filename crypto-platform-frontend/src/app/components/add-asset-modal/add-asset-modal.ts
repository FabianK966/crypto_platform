import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-asset-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="close()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>➕ Add New Asset</h2>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          <div class="modal-body">
            <p class="description">
              Start your portfolio by adding your first crypto asset
            </p>

            <!-- Symbol Input -->
            <div class="input-group">
              <label>Symbol (e.g., BTC, ETH, SOL)</label>
              <input 
                type="text" 
                [(ngModel)]="symbolInput"
                (input)="onInputChange()"
                placeholder="BTC"
                class="input-field"
                style="text-transform: uppercase;"
              />
            </div>

            <!-- Quantity Input -->
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

            <!-- Price Input -->
            <div class="input-group">
              <label>Purchase Price (USD)</label>
              <input 
                type="number" 
                [(ngModel)]="priceInput"
                (input)="onInputChange()"
                placeholder="0.00"
                step="0.01"
                min="0"
                class="input-field"
              />
            </div>

            <!-- Total Cost -->
            <div class="total-section">
              <div class="total-label">Total Investment</div>
              <div class="total-value">\${{ totalCost() | number:'1.2-2' }}</div>
            </div>

            <!-- Error Message -->
            @if (errorMessage()) {
              <div class="error-message">
                ⚠️ {{ errorMessage() }}
              </div>
            }

            <!-- Debug Info -->
            <div style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">
              Debug: Symbol={{ symbolInput }} | Q={{ quantityInput }} | P={{ priceInput }} | Total={{ totalCost() }} | Valid={{ canAdd() }}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button 
              class="btn-add-confirm"
              (click)="confirmAdd()"
              [disabled]="!canAdd()"
            >
              Add {{ symbolInput || 'Asset' }}
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

    .description {
      color: #999;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
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

    .btn-add-confirm {
      flex: 2;
      background: linear-gradient(135deg, #2962ff 0%, #1e4ed8 100%);
      border: none;
      color: white;
      padding: 0.875rem;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(41, 98, 255, 0.3);

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(41, 98, 255, 0.4);
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
export class AddAssetModalComponent {
  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (!value) {
      this.reset();
    }
  }

  @Output() closeModal = new EventEmitter<void>();
  @Output() addAsset = new EventEmitter<{ symbol: string; quantity: number; price: number }>();

  isOpen = signal(false);
  errorMessage = signal<string | null>(null);
  totalCost = signal(0);
  canAdd = signal(false);

  symbolInput: string = '';
  quantityInput: number = 0;
  priceInput: number = 0;


  onInputChange() {
    // Auto-uppercase symbol
    this.symbolInput = this.symbolInput.toUpperCase().trim();

    // Calculate total
    const total = (this.quantityInput || 0) * (this.priceInput || 0);
    this.totalCost.set(total);
    
    // Validate
    this.validate();
  }

  validate() {
    this.errorMessage.set(null);
    
    const symbol = this.symbolInput;
    const qty = this.quantityInput;
    const prc = this.priceInput;
    const total = this.totalCost();

    // Symbol validation
    if (!symbol || symbol.length === 0) {
      this.canAdd.set(false);
      return;
    }

    if (symbol.length < 2 || symbol.length > 10) {
      this.errorMessage.set('Symbol must be 2-10 characters');
      this.canAdd.set(false);
      return;
    }

    // Quantity validation
    if (!qty || qty <= 0) {
      this.canAdd.set(false);
      return;
    }

    // Price validation
    if (!prc || prc <= 0) {
      this.canAdd.set(false);
      return;
    }

    // All checks passed
    this.canAdd.set(true);
  }

  confirmAdd() {
    if (this.canAdd()) {
      this.addAsset.emit({
        symbol: this.symbolInput.toUpperCase(),
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
    this.symbolInput = '';
    this.quantityInput = 0;
    this.priceInput = 0;
    this.totalCost.set(0);
    this.errorMessage.set(null);
    this.canAdd.set(false);
  }
}