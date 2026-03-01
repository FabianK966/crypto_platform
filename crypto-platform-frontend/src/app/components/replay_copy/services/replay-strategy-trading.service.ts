// Service für das Trading im Replay-Modus.
// Verwaltet Cash, Positionen (Long/Short), Margin, PnL, Trade-Historie und Liquidation.
// Alle wichtigen Größen sind als Signal implementiert, sodass die UI automatisch aktualisiert wird.

import { Injectable, signal, computed } from '@angular/core';

// Schnittstelle für einen einzelnen Trade
export interface ReplayTrade {
  type: 'buy' | 'sell';             // Kauf oder Verkauf
  quantity: number;                 // Menge in Coins
  price: number;                    // Ausführungspreis
  fee: number;                      // Berechnete Gebühr für diesen Trade
  timestamp: string;                // Zeitstempel
  total: number;                    // Gesamtwert (quantity * price)
  positionType: 'long' | 'short';   // Zu welcher Position gehört der Trade
}

// Schnittstelle für eine Einzahlung
export interface ReplayDeposit {
  amount: number;                   // Einzahlungsbetrag
  timestamp: string;                // Zeitstempel
  newBalance: number;               // Neuer Cash-Bestand nach Einzahlung
}

@Injectable()
export class ReplayTradingService {

  // --- Kernzustände (Signale) ---
  replayCashBalance    = signal(10000);                  // Verfügbares Cash
  replayLongQuantity   = signal(0);                      // Anzahl Coins in Long-Position
  replayLongAvgPrice   = signal(0);                      // Durchschnittlicher Einstiegspreis Long
  replayLongDebt       = signal(0);                      // Geliehener Betrag (bei Hebel)
  replayShortQuantity  = signal(0);                      // Anzahl Coins in Short-Position (positiv)
  replayShortAvgPrice  = signal(0);                      // Durchschnittlicher Einstiegspreis Short
  replayRealizedPnl    = signal(0);                      // Realisierter Gewinn/Verlust
  replayTradeHistory   = signal<ReplayTrade[]>([]);      // Historie aller Trades
  replayDepositHistory = signal<ReplayDeposit[]>([]);    // Historie aller Einzahlungen
  replayUsedMargin     = signal(0);                      // Derzeit genutzte Margin
  totalFees            = signal(0);                      // Kumulierte Gebühren
  liquidationTriggered = signal(false);                  // Signal für Liquidation
  selectedLeverage     = signal(1);                      // Vom Benutzer gewählter Hebel

  // ── Safety Vault ─────────────────────────────────────────────────
  safetyVault  = signal(0);   // Geerntetes / gesichertes Kapital
  harvestCount = signal(0);   // Wie oft bereits geerntet

  replayInitialBalance = 10000; // Ursprüngliches Startguthaben (für Reset)
  replayStartBalance   = 10000; // Wird nur beim allerersten Start gesetzt

  private maintenanceMarginFactor = 0.05; // 5% Wartungsmargin
  private readonly BASE_FEE_RATE  = 0.0005; // 0.05%

  // --- Computed Werte ---
  hasLong  = computed(() => this.replayLongQuantity()  > 0);
  hasShort = computed(() => this.replayShortQuantity() > 0);

  longAssetValue  = computed(() =>  this.replayLongQuantity()  * this.currentPrice());
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

  replayAssetValue    = computed(() => this.longAssetValue()    + this.shortAssetValue());
  replayUnrealizedPnl = computed(() => this.longUnrealizedPnl() + this.shortUnrealizedPnl());

  // Gesamtkapital = Cash + Long-Wert - Long-Schulden + Short-Wert
  replayTotalBalance = computed(() =>
    this.replayCashBalance() + this.longAssetValue() - this.replayLongDebt() + this.shortAssetValue()
  );

  freeMargin = computed(() => this.replayTotalBalance() - this.replayUsedMargin());

  // --- Aktuelle Marktdaten ---
  private currentPrice     = signal(0);
  private currentTimestamp = signal('');

  setCurrentPrice(price: number, timestamp: string) {
    this.currentPrice.set(price);
    this.currentTimestamp.set(timestamp);
  }

  setInitialBalance(amount: number) {
    this.replayInitialBalance = amount;
    this.replayStartBalance   = amount;
    this.replayCashBalance.set(amount);
  }

  // Setzt das gesamte Portfolio auf den Anfangszustand zurück
  resetPortfolio() {
    this.replayCashBalance.set(this.replayInitialBalance);
    this.replayStartBalance = this.replayInitialBalance;
    this.replayLongQuantity.set(0);
    this.replayLongAvgPrice.set(0);
    this.replayLongDebt.set(0);
    this.replayShortQuantity.set(0);
    this.replayShortAvgPrice.set(0);
    this.replayRealizedPnl.set(0);
    this.replayTradeHistory.set([]);
    this.replayDepositHistory.set([]);
    this.replayUsedMargin.set(0);
    this.totalFees.set(0);
    this.liquidationTriggered.set(false);
    this.safetyVault.set(0);
    this.harvestCount.set(0);
  }

  deposit(amount: number) {
    this.replayCashBalance.update(b => b + amount);
    const newBalance = this.replayCashBalance();
    this.replayDepositHistory.update(h => [
      { amount, timestamp: this.currentTimestamp(), newBalance },
      ...h
    ]);
  }

  private calculateFee(transactionValue: number): number {
    return transactionValue * this.BASE_FEE_RATE;
  }

  calculateFeeForValue(transactionValue: number): number {
    return this.calculateFee(transactionValue);
  }

  // ── Profit Harvest ───────────────────────────────────────────────
  // Prüft ob realizedPnl die nächste Harvest-Schwelle erreicht hat.
  // Schwelle = (harvestCount + 1) * initialBalance
  // Wenn ja → initialBalance-Betrag aus Cash in Vault verschieben.
  // Gibt true zurück wenn geerntet wurde.
  checkProfitHarvest(): boolean {
    const threshold = (this.harvestCount() + 1) * this.replayInitialBalance;
    if (this.replayRealizedPnl() < threshold) return false;
    const harvest = this.replayInitialBalance;
    if (this.replayCashBalance() < harvest) return false; // Nicht genug Cash
    this.replayCashBalance.update(b => b - harvest);
    this.safetyVault.update(v => v + harvest);
    this.harvestCount.update(c => c + 1);
    return true;
  }

  // Bei Liquidation: maximal initialBalance aus dem Vault ins Portfolio zurückführen.
  // Überschuss verbleibt im Vault für zukünftige Liquidationen.
  injectSafetyVault(): boolean {
    const vault = this.safetyVault();
    if (vault <= 0) return false;
    const inject    = Math.min(vault, this.replayInitialBalance);
    const remaining = vault - inject;
    this.replayCashBalance.update(b => b + inject);
    this.safetyVault.set(remaining);
    return true;
  }

  // --- Long-Position erhöhen (Kauf) ---
  increaseLong(qty: number, price: number): boolean {
    const totalCost = qty * price;
    const margin    = totalCost / this.selectedLeverage();
    const loan      = totalCost - margin;
    const fee       = this.calculateFee(totalCost);

    if (margin + fee > this.replayCashBalance()) return false;

    const currentQty = this.replayLongQuantity();
    const newQty     = currentQty + qty;
    const newAvg     = currentQty > 0
      ? (currentQty * this.replayLongAvgPrice() + qty * price) / newQty
      : price;

    this.replayLongQuantity.set(newQty);
    this.replayLongAvgPrice.set(newAvg);
    this.replayLongDebt.update(d => d + loan);
    this.replayCashBalance.update(b => b - margin - fee);
    this.totalFees.update(f => f + fee);

    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, fee, total: totalCost,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Long-Position verkleinern (Verkauf) ---
  decreaseLong(qty: number, price: number): boolean {
    if (qty > this.replayLongQuantity()) return false;

    const currentQty  = this.replayLongQuantity();
    const currentAvg  = this.replayLongAvgPrice();
    const currentDebt = this.replayLongDebt();
    const proportion  = qty / currentQty;
    const repaidDebt  = currentDebt * proportion;
    const proceeds    = qty * price;
    const realizedPnl = proceeds - qty * currentAvg;
    const fee         = this.calculateFee(proceeds);

    this.replayLongQuantity.set(currentQty - qty);
    this.replayLongAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayLongDebt.set(currentDebt - repaidDebt);
    this.replayCashBalance.update(b => b + (proceeds - repaidDebt) - fee);
    this.replayRealizedPnl.update(p => p + realizedPnl);
    this.totalFees.update(f => f + fee);

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, fee, total: proceeds,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Short-Position erhöhen (Leerverkauf) ---
  increaseShort(qty: number, price: number): boolean {
    const totalProceeds  = qty * price;
    const requiredMargin = totalProceeds / this.selectedLeverage();
    const fee            = this.calculateFee(totalProceeds);

    const currentLongMargin  = (this.replayLongQuantity()  * this.replayLongAvgPrice())  / this.selectedLeverage();
    const currentShortMargin = (this.replayShortQuantity() * this.replayShortAvgPrice()) / this.selectedLeverage();
    const newTotalMargin     = currentLongMargin + currentShortMargin + requiredMargin;

    if (newTotalMargin > this.replayTotalBalance() - fee) return false;

    const currentQty = this.replayShortQuantity();
    const newQty     = currentQty + qty;
    const newAvg     = currentQty > 0
      ? (currentQty * this.replayShortAvgPrice() + qty * price) / newQty
      : price;

    this.replayShortQuantity.set(newQty);
    this.replayShortAvgPrice.set(newAvg);
    this.replayCashBalance.update(b => b + totalProceeds - fee);
    this.totalFees.update(f => f + fee);

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, fee, total: totalProceeds,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Short-Position verkleinern (Rückkauf / Cover) ---
  decreaseShort(qty: number, price: number): boolean {
    if (qty > this.replayShortQuantity()) return false;

    const currentQty  = this.replayShortQuantity();
    const currentAvg  = this.replayShortAvgPrice();
    const costToCover = qty * price;
    const realizedPnl = (currentAvg - price) * qty;
    const fee         = this.calculateFee(costToCover);

    this.replayShortQuantity.set(currentQty - qty);
    this.replayShortAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayCashBalance.update(b => b - costToCover - fee);
    this.replayRealizedPnl.update(p => p + realizedPnl);
    this.totalFees.update(f => f + fee);

    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, fee, total: costToCover,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  updateUsedMargin() {
    if (this.currentPrice() <= 0) return;
    const longMargin  = (this.replayLongQuantity()  * this.currentPrice()) / this.selectedLeverage();
    const shortMargin = (this.replayShortQuantity() * this.currentPrice()) / this.selectedLeverage();
    this.replayUsedMargin.set(longMargin + shortMargin);
  }

  checkLiquidation(): boolean {
    if (this.replayTotalBalance() < this.replayUsedMargin() * this.maintenanceMarginFactor) {
      const price = this.currentPrice();
      if (price <= 0) return false;

      // Long liquidieren
      if (this.hasLong()) {
        const qty         = this.replayLongQuantity();
        const proceeds    = qty * price;
        const realizedPnl = proceeds - qty * this.replayLongAvgPrice();
        const fee         = this.calculateFee(proceeds);
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b + (proceeds - this.replayLongDebt() - fee));
        this.replayLongQuantity.set(0);
        this.replayLongAvgPrice.set(0);
        this.replayLongDebt.set(0);
        this.totalFees.update(f => f + fee);
        this.replayTradeHistory.update(h => [{
          type: 'sell', quantity: qty, price, fee, total: proceeds,
          timestamp: this.currentTimestamp(), positionType: 'long'
        }, ...h]);
      }

      // Short liquidieren
      if (this.hasShort()) {
        const qty         = this.replayShortQuantity();
        const costToCover = qty * price;
        const fee         = this.calculateFee(costToCover);
        const realizedPnl = qty * this.replayShortAvgPrice() - costToCover;
        this.replayRealizedPnl.update(p => p + realizedPnl);
        this.replayCashBalance.update(b => b - costToCover - fee);
        this.replayShortQuantity.set(0);
        this.replayShortAvgPrice.set(0);
        this.totalFees.update(f => f + fee);
        this.replayTradeHistory.update(h => [{
          type: 'buy', quantity: qty, price, fee, total: costToCover,
          timestamp: this.currentTimestamp(), positionType: 'short'
        }, ...h]);
      }

      this.replayUsedMargin.set(0);
      this.liquidationTriggered.set(true);
      return true;
    }
    return false;
  }
}