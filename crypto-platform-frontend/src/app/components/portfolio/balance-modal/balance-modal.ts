import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type BalanceOperationType = 'deposit' | 'withdraw' | 'set';

@Component({
  selector: 'app-balance-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './balance-modal.html',
  styleUrl: './balance-modal.css',
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
