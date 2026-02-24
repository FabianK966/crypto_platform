// Service für das Trading im Replay-Modus.
// Verwaltet Cash, Positionen (Long/Short), Margin, PnL, Trade-Historie und Liquidation.
// Alle wichtigen Größen sind als Signal implementiert, sodass die UI automatisch aktualisiert wird.

import { Injectable, signal, computed } from '@angular/core';

// Schnittstelle für einen einzelnen Trade
export interface ReplayTrade {
  type: 'buy' | 'sell';            // Kauf oder Verkauf
  quantity: number;                 // Menge in Coins
  price: number;                    // Ausführungspreis
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
  replayCashBalance = signal(10000);                 // Verfügbares Cash
  replayLongQuantity = signal(0);                     // Anzahl Coins in Long-Position
  replayLongAvgPrice = signal(0);                      // Durchschnittlicher Einstiegspreis Long
  replayLongDebt = signal(0);                          // Geliehener Betrag (bei Hebel)
  replayShortQuantity = signal(0);                     // Anzahl Coins in Short-Position (positiv)
  replayShortAvgPrice = signal(0);                     // Durchschnittlicher Einstiegspreis Short
  replayRealizedPnl = signal(0);                       // Realisierter Gewinn/Verlust
  replayTradeHistory = signal<ReplayTrade[]>([]);      // Historie aller Trades
  replayDepositHistory = signal<ReplayDeposit[]>([]);  // Historie aller Einzahlungen
  replayUsedMargin = signal(0);                         // Derzeit genutzte Margin

  private replayInitialBalance = 10000;                 // Ursprüngliches Startguthaben (für Reset)
  selectedLeverage = signal(1);                          // Vom Benutzer gewählter Hebel
  private maintenanceMarginFactor = 0.05;                // Faktor für Wartungsmargin (5%)

  // --- Computed Werte (automatische Berechnungen) ---
  hasLong = computed(() => this.replayLongQuantity() > 0);
  hasShort = computed(() => this.replayShortQuantity() > 0);

  // Aktueller Marktwert der Long-Position
  longAssetValue = computed(() => this.replayLongQuantity() * this.currentPrice());
  // Aktueller Marktwert der Short-Position (negativ, da Verbindlichkeit)
  shortAssetValue = computed(() => -this.replayShortQuantity() * this.currentPrice());

  // Unrealisierter PnL Long
  longUnrealizedPnl = computed(() => {
    if (!this.hasLong()) return 0;
    return (this.currentPrice() - this.replayLongAvgPrice()) * this.replayLongQuantity();
  });
  longUnrealizedPnlPercent = computed(() => {
    if (!this.hasLong()) return 0;
    const invested = this.replayLongQuantity() * this.replayLongAvgPrice();
    return invested ? (this.longUnrealizedPnl() / invested) * 100 : 0;
  });

  // Unrealisierter PnL Short (bei Short: (Einstiegspreis - aktueller Preis) * Menge)
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

  // Gesamtkapital = Cash + Long-Wert - Long-Schulden + Short-Wert
  replayTotalBalance = computed(() => {
    return this.replayCashBalance() + this.longAssetValue() - this.replayLongDebt() + this.shortAssetValue();
  });

  // Freie Margin = Gesamtkapital - genutzte Margin
  freeMargin = computed(() => this.replayTotalBalance() - this.replayUsedMargin());

  // --- Aktuelle Marktdaten (werden von ReplayComponent gesetzt) ---
  private currentPrice = signal(0);
  private currentTimestamp = signal('');

  setCurrentPrice(price: number, timestamp: string) {
    this.currentPrice.set(price);
    this.currentTimestamp.set(timestamp);
  }

  // Setzt das Startguthaben neu (nur erlaubt, wenn keine offenen Positionen)
  setInitialBalance(amount: number) {
    this.replayInitialBalance = amount;
    this.replayCashBalance.set(amount);
  }

  // Setzt das gesamte Portfolio auf den Anfangszustand zurück
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

  // Einzahlung tätigen
  deposit(amount: number) {
    this.replayCashBalance.update(b => b + amount);
    const newBalance = this.replayCashBalance();
    this.replayDepositHistory.update(h => [
      { amount, timestamp: this.currentTimestamp(), newBalance },
      ...h // neueste oben
    ]);
  }

  // --- Long-Position erhöhen (Kauf) ---
  increaseLong(qty: number, price: number): boolean {
    const totalCost = qty * price;
    const margin = totalCost / this.selectedLeverage();   // Eigenkapitalanteil
    const loan = totalCost - margin;                       // Geliehener Betrag

    if (margin > this.replayCashBalance()) return false;   // Nicht genug Cash

    const currentQty = this.replayLongQuantity();
    const newQty = currentQty + qty;
    // Durchschnittspreis neu berechnen (gewichteter Durchschnitt)
    const newAvg = currentQty > 0
      ? (currentQty * this.replayLongAvgPrice() + qty * price) / newQty
      : price;

    this.replayLongQuantity.set(newQty);
    this.replayLongAvgPrice.set(newAvg);
    this.replayLongDebt.update(d => d + loan);
    this.replayCashBalance.update(b => b - margin);        // Cash wird um Margin reduziert

    // Trade zur Historie hinzufügen
    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, total: totalCost,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Long-Position verkleinern (Verkauf) ---
  decreaseLong(qty: number, price: number): boolean {
    if (qty > this.replayLongQuantity()) return false;     // Nicht mehr verkaufen als vorhanden

    const currentQty = this.replayLongQuantity();
    const currentAvg = this.replayLongAvgPrice();
    const currentDebt = this.replayLongDebt();
    const proportion = qty / currentQty;                    // Anteil der verkauften Menge
    const repaidDebt = currentDebt * proportion;            // Entsprechender Anteil der Schulden wird getilgt
    const proceeds = qty * price;                            // Erlös aus Verkauf
    const realizedPnl = proceeds - qty * currentAvg;        // Realisierter Gewinn/Verlust

    this.replayLongQuantity.set(currentQty - qty);
    this.replayLongAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayLongDebt.set(currentDebt - repaidDebt);
    // Cash erhöht sich um Erlös abzüglich getilgter Schulden
    this.replayCashBalance.update(b => b + (proceeds - repaidDebt));
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, total: proceeds,
      timestamp: this.currentTimestamp(), positionType: 'long'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Short-Position erhöhen (Leerverkauf) ---
  increaseShort(qty: number, price: number): boolean {
    const totalProceeds = qty * price;                       // Erlös aus Leerverkauf
    const requiredMargin = totalProceeds / this.selectedLeverage();
    // Berechne aktuelle Gesamt-Margin (Long + Short)
    const currentLongMargin = (this.replayLongQuantity() * this.replayLongAvgPrice()) / this.selectedLeverage();
    const currentShortMargin = (this.replayShortQuantity() * this.replayShortAvgPrice()) / this.selectedLeverage();
    const newTotalMargin = currentLongMargin + currentShortMargin + requiredMargin;

    if (newTotalMargin > this.replayTotalBalance()) return false; // Nicht genug Equity

    const currentQty = this.replayShortQuantity();
    const newQty = currentQty + qty;
    const newAvg = currentQty > 0
      ? (currentQty * this.replayShortAvgPrice() + qty * price) / newQty
      : price;

    this.replayShortQuantity.set(newQty);
    this.replayShortAvgPrice.set(newAvg);
    this.replayCashBalance.update(b => b + totalProceeds);   // Cash erhöht sich um Erlös

    this.replayTradeHistory.update(h => [{
      type: 'sell', quantity: qty, price, total: totalProceeds,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // --- Short-Position verkleinern (Rückkauf / Cover) ---
  decreaseShort(qty: number, price: number): boolean {
    if (qty > this.replayShortQuantity()) return false;

    const currentQty = this.replayShortQuantity();
    const currentAvg = this.replayShortAvgPrice();
    const costToCover = qty * price;                         // Kosten für Rückkauf
    const realizedPnl = (currentAvg - price) * qty;          // Realisierter PnL (bei Short: Einstieg - Ausstieg)

    this.replayShortQuantity.set(currentQty - qty);
    this.replayShortAvgPrice.set(currentQty - qty > 0 ? currentAvg : 0);
    this.replayCashBalance.update(b => b - costToCover);     // Cash wird um Rückkaufkosten reduziert
    this.replayRealizedPnl.update(p => p + realizedPnl);

    this.replayTradeHistory.update(h => [{
      type: 'buy', quantity: qty, price, total: costToCover,
      timestamp: this.currentTimestamp(), positionType: 'short'
    }, ...h]);

    this.updateUsedMargin();
    return true;
  }

  // Berechnet die aktuell genutzte Margin basierend auf aktuellem Preis und Hebel
  updateUsedMargin() {
    if (this.currentPrice() <= 0) return;
    const longMargin = (this.replayLongQuantity() * this.currentPrice()) / this.selectedLeverage();
    const shortMargin = (this.replayShortQuantity() * this.currentPrice()) / this.selectedLeverage();
    this.replayUsedMargin.set(longMargin + shortMargin);
  }

  // Prüft, ob eine Liquidation stattfinden muss (Gesamtkapital < Wartungsmargin)
  // Wenn ja, werden alle Positionen zwangsgeschlossen und true zurückgegeben.
  checkLiquidation(): boolean {
    if (this.replayTotalBalance() < this.replayUsedMargin() * this.maintenanceMarginFactor) {
      const price = this.currentPrice();
      if (price <= 0) return false;

      // Long-Position liquidieren
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

      // Short-Position liquidieren
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
      return true; // Liquidation erfolgt
    }
    return false; // Keine Liquidation
  }
}