// Service für das Trading im Replay-Modus.
// Verwaltet Cash, Positionen (Long/Short), Margin, PnL, Trade-Historie und Liquidation.
// Alle wichtigen Größen sind als Signal implementiert, sodass die UI automatisch aktualisiert wird.

import { Injectable, signal, computed } from '@angular/core';

export interface ReplayTrade {
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
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

  // --- Kernzustände (Signale) ---
  replayCashBalance    = signal(10000);
  replayLongQuantity   = signal(0);
  replayLongAvgPrice   = signal(0);
  replayLongDebt       = signal(0);
  replayShortQuantity  = signal(0);
  replayShortAvgPrice  = signal(0);
  replayRealizedPnl    = signal(0);
  replayTradeHistory   = signal<ReplayTrade[]>([]);
  replayDepositHistory = signal<ReplayDeposit[]>([]);
  replayUsedMargin     = signal(0);
  totalFees            = signal(0);
  liquidationTriggered = signal(false);
  selectedLeverage     = signal(1);

  // ── Safety Vault ─────────────────────────────────────────────────
  safetyVault  = signal(0);
  harvestCount = signal(0);

  // ── Max Drawdown ──────────────────────────────────────────────────
  // Speichert den größten beobachteten Rückgang vom Peak zum Trough.
  // Wird jedes Mal aktualisiert wenn updateDrawdown() aufgerufen wird.
  maxDrawdownPercent = signal(0);   // z.B. 23.45 für 23.45%
  maxDrawdownDollar  = signal(0);   // absoluter Betrag in $

  // Interne Tracking-Variablen (kein Signal nötig, nur Rechenwerte)
  private ddRunningPeak   = 0;   // aktueller Hochpunkt der Balance
  private ddRunningTrough = 0;   // Tiefpunkt nach dem aktuellen Peak

  replayInitialBalance = 10000;
  replayStartBalance   = 10000;

  private maintenanceMarginFactor = 0.05;
  private readonly BASE_FEE_RATE  = 0.0005;

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

  replayTotalBalance = computed(() =>
    this.replayCashBalance() + this.longAssetValue() - this.replayLongDebt() + this.shortAssetValue()
  );

  freeMargin = computed(() => this.replayTotalBalance() - this.replayUsedMargin());

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

  // ── Max Drawdown Tracking ─────────────────────────────────────────
  // Aufrufen nach jeder Balance-Änderung (wird in updateUsedMargin() gemacht).
  //
  // Algorithmus:
  //   1. Neuer Peak?  → Peak hochsetzen, Trough auf Peak zurücksetzen
  //   2. Neuer Trough unter bisherigem Trough?  → Trough aktualisieren
  //   3. Drawdown aus diesem Peak-Trough-Paar berechnen
  //   4. Größer als bisheriger Max Drawdown?  → Max Drawdown aktualisieren
  //
  // "Peak → Trough" wird also immer vom aktuellen Running-Peak aus gemessen,
  // d.h. nach einem neuen Allzeithoch fängt die Messung neu an.
  // Das Maximum über alle Zeiträume hinweg wird in den Signalen gespeichert.
  private updateDrawdown(): void {
    const total = this.replayTotalBalance();
    if (total <= 0) return;

    // ── Initialisierung beim ersten Aufruf ──
    if (this.ddRunningPeak === 0) {
      this.ddRunningPeak   = total;
      this.ddRunningTrough = total;
      return;
    }

    // ── Neuer Peak → Trough zurücksetzen ──
    if (total > this.ddRunningPeak) {
      this.ddRunningPeak   = total;
      this.ddRunningTrough = total;
      return; // Kein Drawdown wenn wir ein neues Hoch erreichen
    }

    // ── Neuer Trough unterhalb des aktuellen Troughs ──
    if (total < this.ddRunningTrough) {
      this.ddRunningTrough = total;
    }

    // ── Drawdown aus aktuellem Peak-Trough-Paar berechnen ──
    const drawdownDollar  = this.ddRunningPeak - this.ddRunningTrough;
    const drawdownPercent = (drawdownDollar / this.ddRunningPeak) * 100;

    // ── Maximalen Drawdown aktualisieren wenn größer als bisheriger ──
    if (drawdownPercent > this.maxDrawdownPercent()) {
      this.maxDrawdownPercent.set(drawdownPercent);
      this.maxDrawdownDollar.set(drawdownDollar);
    }
  }

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
    // Drawdown-Tracking zurücksetzen
    this.maxDrawdownPercent.set(0);
    this.maxDrawdownDollar.set(0);
    this.ddRunningPeak   = 0;
    this.ddRunningTrough = 0;
  }

  deposit(amount: number) {
    this.replayCashBalance.update(b => b + amount);
    const newBalance = this.replayCashBalance();
    this.replayDepositHistory.update(h => [
      { amount, timestamp: this.currentTimestamp(), newBalance }, ...h
    ]);
  }

  private calculateFee(transactionValue: number): number {
    return transactionValue * this.BASE_FEE_RATE;
  }

  calculateFeeForValue(transactionValue: number): number {
    return this.calculateFee(transactionValue);
  }

  // ── Profit Harvest ───────────────────────────────────────────────
  checkProfitHarvest(): boolean {
    const threshold = (this.harvestCount() + 1) * this.replayInitialBalance;
    if (this.replayRealizedPnl() < threshold) return false;
    const harvest = this.replayInitialBalance;
    if (this.replayCashBalance() < harvest) return false;
    this.replayCashBalance.update(b => b - harvest);
    this.safetyVault.update(v => v + harvest);
    this.harvestCount.update(c => c + 1);
    return true;
  }

  // ── Vault-Refill bei 90% Verlust ─────────────────────────────────
  // Greift VOR der Liquidation: wenn die Gesamtbilanz unter 10% des
  // Startkapitals fällt, wird aus dem Safety Vault so viel aufgefüllt,
  // dass die Balance wieder auf replayInitialBalance gebracht wird.
  // Positionen bleiben offen – keine Zwangsliquidation.
  // Gibt { injected, newVault } zurück wenn aufgefüllt, sonst null.
  checkVaultRefill(): { injected: number; newVault: number } | null {
    if (this.safetyVault() <= 0) return null;
    const refillThreshold = this.replayInitialBalance * 0.1;
    if (this.replayTotalBalance() >= refillThreshold) return null;

    // Genug injizieren um Balance auf initialBalance zu bringen
    const needed = this.replayInitialBalance - this.replayTotalBalance();
    const inject = Math.min(this.safetyVault(), needed);
    if (inject <= 0) return null;

    this.replayCashBalance.update(b => b + inject);
    this.safetyVault.update(v => v - inject);
    const newVault = this.safetyVault();
    return { injected: inject, newVault };
  }

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

  // updateUsedMargin wird nach jeder Balance-Änderung aufgerufen
  // → idealer Punkt um Drawdown zu tracken
  updateUsedMargin() {
    if (this.currentPrice() <= 0) return;
    const longMargin  = (this.replayLongQuantity()  * this.currentPrice()) / this.selectedLeverage();
    const shortMargin = (this.replayShortQuantity() * this.currentPrice()) / this.selectedLeverage();
    this.replayUsedMargin.set(longMargin + shortMargin);
    // Nach jeder Margin-Berechnung Drawdown aktualisieren
    this.updateDrawdown();
  }

  checkLiquidation(): boolean {
    if (this.replayTotalBalance() < this.replayUsedMargin() * this.maintenanceMarginFactor) {
      const price = this.currentPrice();
      if (price <= 0) return false;

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
      // Drawdown auch bei Liquidation tracken
      this.updateDrawdown();
      this.liquidationTriggered.set(true);
      return true;
    }
    return false;
  }
}