import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-asset-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-asset-modal.html',
  styleUrl: './add-asset-modal.css',
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