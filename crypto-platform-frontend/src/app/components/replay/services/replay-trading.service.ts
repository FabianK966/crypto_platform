// src/app/components/replay/services/replay-trading.service.ts

import { Injectable, signal, computed } from '@angular/core';

export interface ReplayTrade {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
  total: number;
  positionType: 'long' | 'short';
}

export interface ReplayDeposit {
  amount: number;
  timestamp: string;
  newBalance: number;
}

@Injectable()
export class ReplayTradingService {
  replayCashBalance = signal(10000);
  replayLongQuantity = signal(0);
  replayLongAvgPrice = signal(0);
  replayLongDebt = signal(0);
  replayShortQuantity = signal(0);
  replayShortAvgPrice = signal(0);
  replayRealizedPnl = signal(0);
  replayTradeHistory = signal<ReplayTrade[]>([]);
  replayDepositHistory = signal<ReplayDeposit[]>([]);
  replayUsedMargin = signal(0);

  private replayInitialBalance = 10000;
  selectedLeverage = signal(1);
  private maintenanceMarginFactor = 0.05;

  hasLong = computed(() => this.replayLongQuantity() > 0);
  hasShort = computed(() => this.replayShortQuantity() > 0);

  longAssetValue = computed(() => this.replayLongQuantity() * this.currentPrice());
  shortAssetValue = computed(() => -this.replayShortQuantity() * this.currentPrice());

  longUnrealizedPnl = computed(() => {
    if (!this.hasLong()) return 0;
    return (this.currentPrice() - this.replayLongAvgPrice()) * this.replayLongQuantity();
  });

  longUnrealizedPnlPercent = computed(() => {
    if (!this.hasLong()) return 0;
    const invested = this.replayLongQuantity() * this.replayLongAvgPrice();
    return invested ? (this.longUnrealizedPnl() / invested) * 100 : 0;
  });

  shortUnrealizedPnl = computed(() => {
    if (!this.hasShort()) return 0;
    return (this.replayShortAvgPrice() - this.currentPrice()) * this.replayShortQuantity();
  });

  shortUnrealizedPnlPercent = computed(() => {
    if (!this.hasShort()) return 0;
    const invested = this.replayShortQuantity() * this.replayShortAvgPrice();
    return invested ? (this.shortUnrealizedPnl() / invested) * 100 : 0;
  });

  replayAssetValue = computed(() => this.longAssetValue() + this.shortAssetValue());
  replayUnrealizedPnl = computed(() => this.longUnrealizedPnl() + this.shortUnrealizedPnl());

  replayTotalBalance = computed(() => {
    return this.replayCashBalance() + this.longAssetValue() - this.replayLongDebt() + this.shortAssetValue();
  });

  freeMargin = computed(() => this.replayTotalBalance() - this.replayUsedMargin());

  private currentPrice = signal(0);
private currentTimestamp = signal('');

  setCurrentPrice(price: number, timestamp: string) {
  this.currentPrice.set(price);
  this.currentTimestamp.set(timestamp);
}

  setInitialBalance(amount: number) {
    this.replayInitialBalance = amount;
    this.replayCashBalance.set(amount);
  }

  resetPortfolio() {
    this.replayCashBalance.set(this.replayInitialBalance);
    this.replayLongQuantity.set(0);
    this.replayLongAvgPrice.set(0);
    this.replayLongDebt.set(0);
    this.replayShortQuantity.set(0);
    this.replayShortAvgPrice.set(0);
    this.replayRealizedPnl.set(0);
    this.replayTradeHistory.set([]);
    this.replayDepositHistory.set([]);
    this.replayUsedMargin.set(0);
  }

  deposit(amount: number) {
    this.replayCashBalance.update(b => b + amount);
    const newBalance = this.replayCashBalance();
    this.replayDepositHistory.update(h => [
      { amount, timestamp: this.currentTimestamp(), newBalance },
      ...h
    ]);
  }

  increaseLong(qty: number, price: number): boolean {
    const totalCost = qty * price;
    const margin = totalCost / this.selectedLeverage();
    const loan = totalCost - margin;

    if (margin > this.replayCashBalance()) return false;

    const currentQty = this.replayLongQuantity();
    const newQty = currentQty + qty;
    const newAvg = currentQty > 0
      ? (currentQty * this.replayLongAvgPrice() + qty * price) / newQty
      : price;

    this.replayLongQuantity.set(newQty);
    this.replayLongAvgPrice.set(newAvg);
    this.replayLongDebt.update(d => d + loan);
    this.replayCashBalance.update(b => b - margin);

    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, total: totalCost,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  decreaseLong(qty: number, price: number): boolean {
    if (qty > this.replayLongQuantity()) return false;

    const currentQty = this.replayLongQuantity();
    const currentAvg = this.replayLongAvgPrice();
    const currentDebt = this.replayLongDebt();
    const proportion = qty / currentQty;
    const repaidDebt = currentDebt * proportion;
    const proceeds = qty * price;
    const realizedPnl = proceeds - qty * currentAvg;

    this.replayLongQuantity.set(currentQty - qty);
    this.replayLongAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayLongDebt.set(currentDebt - repaidDebt);
    this.replayCashBalance.update(b => b + (proceeds - repaidDebt));
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, total: proceeds,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  increaseShort(qty: number, price: number): boolean {
    const totalProceeds = qty * price;
    const requiredMargin = totalProceeds / this.selectedLeverage();
    const currentLongMargin = (this.replayLongQuantity() * this.replayLongAvgPrice()) / this.selectedLeverage();
    const currentShortMargin = (this.replayShortQuantity() * this.replayShortAvgPrice()) / this.selectedLeverage();
    const newTotalMargin = currentLongMargin + currentShortMargin + requiredMargin;

    if (newTotalMargin > this.replayTotalBalance()) return false;

    const currentQty = this.replayShortQuantity();
    const newQty = currentQty + qty;
    const newAvg = currentQty > 0
      ? (currentQty * this.replayShortAvgPrice() + qty * price) / newQty
      : price;

    this.replayShortQuantity.set(newQty);
    this.replayShortAvgPrice.set(newAvg);
    this.replayCashBalance.update(b => b + totalProceeds);

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, total: totalProceeds,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  decreaseShort(qty: number, price: number): boolean {
    if (qty > this.replayShortQuantity()) return false;

    const currentQty = this.replayShortQuantity();
    const currentAvg = this.replayShortAvgPrice();
    const costToCover = qty * price;
    const realizedPnl = (currentAvg - price) * qty;

    this.replayShortQuantity.set(currentQty - qty);
    this.replayShortAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayCashBalance.update(b => b - costToCover);
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, total: costToCover,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  updateUsedMargin() {
    if (this.currentPrice() <= 0) return;
    const longMargin = (this.replayLongQuantity() * this.currentPrice()) / this.selectedLeverage();
    const shortMargin = (this.replayShortQuantity() * this.currentPrice()) / this.selectedLeverage();
    this.replayUsedMargin.set(longMargin + shortMargin);
  }

  checkLiquidation(): boolean {
    if (this.replayTotalBalance() < this.replayUsedMargin() * this.maintenanceMarginFactor) {
      const price = this.currentPrice();
      if (price <= 0) return false;

      if (this.hasLong()) {
        const qty = this.replayLongQuantity();
        const proceeds = qty * price;
        const realizedPnl = proceeds - qty * this.replayLongAvgPrice();
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b + (proceeds - this.replayLongDebt()));
        this.replayLongQuantity.set(0);
        this.replayLongAvgPrice.set(0);
        this.replayLongDebt.set(0);
        this.replayTradeHistory.update(h => [{
          type: 'sell', quantity: qty, price, total: proceeds,
          timestamp: this.currentTimestamp(), positionType: 'long'
        }, ...h]);
      }

      if (this.hasShort()) {
        const qty = this.replayShortQuantity();
        const costToCover = qty * price;
        const realizedPnl = qty * this.replayShortAvgPrice() - costToCover;
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b - costToCover);
        this.replayShortQuantity.set(0);
        this.replayShortAvgPrice.set(0);
        this.replayTradeHistory.update(h => [{
          type: 'buy', quantity: qty, price, total: costToCover,
          timestamp: this.currentTimestamp(), positionType: 'short'
        }, ...h]);
      }

      this.replayUsedMargin.set(0);
      return true;
    }
    return false;
  }
}