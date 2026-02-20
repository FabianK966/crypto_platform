import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type BalanceOperationType = 'deposit' | 'withdraw' | 'set';

@Component({
  selector: 'app-balance-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="close()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>
              @switch (operationType()) {
                @case ('deposit') { 💰 Deposit Money }
                @case ('withdraw') { 💸 Withdraw Money }
                @case ('set') { ⚙️ Set Balance }
              }
            </h2>
            <button class="close-btn" (click)="close()">✕</button>
          </div>

          <div class="modal-body">
            <div class="balance-info">
              <div class="info-label">Current Initial Balance</div>
              <div class="info-value">\${{ currentBalance() | number:'1.2-2' }}</div>
            </div>

            <div class="input-group">
              <label>
                @switch (operationType()) {
                  @case ('deposit') { Amount to Deposit }
                  @case ('withdraw') { Amount to Withdraw }
                  @case ('set') { New Balance }
                }
              </label>
              <div class="input-wrapper">
                <span class="currency-symbol">$</span>
                <input
                  type="number"
                  [(ngModel)]="amountInput"
                  (input)="onInputChange()"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  class="input-field"
                  autofocus
                />
              </div>
            </div>

            <!-- Preview -->
            @if (amountInput > 0) {
              <div class="preview-section">
                <div class="preview-label">New Balance</div>
                <div class="preview-value" [ngClass]="{
                  'positive': newBalance() > currentBalance(),
                  'negative': newBalance() < currentBalance()
                }">
                  \${{ newBalance() | number:'1.2-2' }}
                  <span class="change">
                    ({{ newBalance() > currentBalance() ? '+' : '' }}{{ (newBalance() - currentBalance()) | number:'1.2-2' }})
                  </span>
                </div>
              </div>
            }

            @if (errorMessage()) {
              <div class="error-message">
                ⚠️ {{ errorMessage() }}
              </div>
            }

            <!-- Quick Amount Buttons (for deposit/set) -->
            @if (operationType() !== 'withdraw') {
              <div class="quick-amounts">
                <button class="quick-btn" (click)="setQuickAmount(100)">+$100</button>
                <button class="quick-btn" (click)="setQuickAmount(500)">+$500</button>
                <button class="quick-btn" (click)="setQuickAmount(1000)">+$1,000</button>
                <button class="quick-btn" (click)="setQuickAmount(5000)">+$5,000</button>
              </div>
            }
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button
              [class]="getConfirmButtonClass()"
              (click)="confirm()"
              [disabled]="!isValid()"
            >
              @switch (operationType()) {
                @case ('deposit') { Deposit }
                @case ('withdraw') { Withdraw }
                @case ('set') { Set Balance }
              }
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

    .modal-content {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      animation: slideUp 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
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

    .balance-info {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      text-align: center;

      .info-label {
        color: #999;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }

      .info-value {
        color: #fff;
        font-size: 1.75rem;
        font-weight: 700;
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

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      .currency-symbol {
        position: absolute;
        left: 1rem;
        color: #999;
        font-size: 1.125rem;
        font-weight: 600;
        pointer-events: none;
      }
    }

    .input-field {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.875rem 0.875rem 0.875rem 2.5rem;
      color: #fff;
      font-size: 1.125rem;
      font-weight: 600;
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

    .preview-section {
      background: rgba(41, 98, 255, 0.1);
      border: 1px solid rgba(41, 98, 255, 0.3);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      text-align: center;

      .preview-label {
        color: #2962ff;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }

      .preview-value {
        font-size: 1.5rem;
        font-weight: 700;

        &.positive {
          color: #26a69a;
        }

        &.negative {
          color: #ef5350;
        }

        .change {
          font-size: 1rem;
          opacity: 0.8;
          margin-left: 0.5rem;
        }
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

    .quick-amounts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .quick-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 0.625rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: rgba(41, 98, 255, 0.1);
        border-color: #2962ff;
        color: #2962ff;
      }
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

    .btn-deposit {
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

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-withdraw {
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

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-set {
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

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `]
})
export class BalanceModalComponent {
  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (!value) this.reset();
  }

  @Input() set type(value: BalanceOperationType) {
    this.operationType.set(value);
  }

  @Input() set balance(value: number) {
    this.currentBalance.set(value);
  }

  @Output() closeModal = new EventEmitter<void>();
  @Output() operation = new EventEmitter<{ type: BalanceOperationType; amount: number }>();

  isOpen = signal(false);
  operationType = signal<BalanceOperationType>('deposit');
  currentBalance = signal(0);
  errorMessage = signal<string | null>(null);

  amountInput: number = 0;

  newBalance = signal(0);

  onInputChange() {
    const type = this.operationType();
    const current = this.currentBalance();
    const amount = this.amountInput || 0;

    switch (type) {
      case 'deposit':
        this.newBalance.set(current + amount);
        break;
      case 'withdraw':
        this.newBalance.set(current - amount);
        break;
      case 'set':
        this.newBalance.set(amount);
        break;
    }

    this.validate();
  }

  setQuickAmount(amount: number) {
    const type = this.operationType();

    if (type === 'set') {
      this.amountInput = amount;
    } else {
      this.amountInput = (this.amountInput || 0) + amount;
    }

    this.onInputChange();
  }

  validate() {
    this.errorMessage.set(null);

    if (this.amountInput <= 0) {
      this.errorMessage.set('Amount must be positive');
      return;
    }

    if (this.operationType() === 'withdraw') {
      if (this.amountInput > this.currentBalance()) {
        this.errorMessage.set('Insufficient balance');
        return;
      }
    }
  }

  isValid(): boolean {
    return this.amountInput > 0 && !this.errorMessage();
  }

  getConfirmButtonClass(): string {
    switch (this.operationType()) {
      case 'deposit': return 'btn-deposit';
      case 'withdraw': return 'btn-withdraw';
      case 'set': return 'btn-set';
    }
  }

  confirm() {
    if (this.isValid()) {
      this.operation.emit({
        type: this.operationType(),
        amount: this.amountInput
      });
      this.close();
    }
  }

  close() {
    this.reset();
    this.closeModal.emit();
  }

  reset() {
    this.amountInput = 0;
    this.newBalance.set(this.currentBalance());
    this.errorMessage.set(null);
  }
}
