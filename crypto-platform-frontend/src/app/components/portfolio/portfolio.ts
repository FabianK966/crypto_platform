import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioService } from '../../services/portfolio.service';
import {
  PortfolioAssetDto,
  PortfolioSummaryDto,
  BuyRequestDto,
  TransactionResponseDto,
  AccountDto
} from '../../models/portfolio.model';
import { StatCardComponent } from '../stat-card/stat-card';
import { TradeModalComponent } from '../trade-modal/trade-modal';
import { AddAssetModalComponent } from '../add-asset-modal/add-asset-modal';
import { BalanceModalComponent, BalanceOperationType } from '../balance-modal/balance-modal';
import { switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    StatCardComponent,
    TradeModalComponent,
    AddAssetModalComponent,
    BalanceModalComponent,
  ],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.css'
})
export class PortfolioComponent implements OnInit {
  private portfolioService = inject(PortfolioService);

  portfolio = signal<PortfolioAssetDto[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Balance Signals
  initialBalance = signal(0);
  totalAssetValue = signal(0);
  totalBalance = signal(0);
  totalUnrealizedProfit = signal(0);
  totalRealizedProfit = signal(0);

  // Trade Modal State
  isTradeModalOpen = signal(false);
  modalType = signal<'buy' | 'sell'>('buy');
  selectedAsset = signal<PortfolioAssetDto | null>(null);

  // Add Asset Modal State
  isAddAssetModalOpen = signal(false);

  // Balance Modal State
  isBalanceModalOpen = signal(false);
  balanceOperationType = signal<BalanceOperationType>('deposit');

  ngOnInit() {
    this.loadPortfolio();
  }

  loadPortfolio() {
    this.loading.set(true);
    this.error.set(null);

    this.portfolioService.getPortfolioSummary().subscribe({
      next: (data: PortfolioSummaryDto) => {
        this.portfolio.set(data.assets);
        this.initialBalance.set(data.initialBalance);
        this.totalAssetValue.set(data.totalAssetValue);
        this.totalBalance.set(data.totalBalance);
        this.totalUnrealizedProfit.set(data.totalUnrealizedProfit);
        this.totalRealizedProfit.set(data.totalRealizedProfit);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load portfolio');
        this.loading.set(false);
        console.error('Portfolio error:', err);
      }
    });
  }

  // Balance Modal Methods
  openBalanceModal(type: BalanceOperationType) {
    this.balanceOperationType.set(type);
    this.isBalanceModalOpen.set(true);
  }

  closeBalanceModal() {
    this.isBalanceModalOpen.set(false);
  }

  executeBalanceOperation(data: { type: BalanceOperationType; amount: number }) {
    let observable;

    switch (data.type) {
      case 'deposit':
        observable = this.portfolioService.depositMoney(data.amount);
        break;
      case 'withdraw':
        observable = this.portfolioService.withdrawMoney(data.amount);
        break;
      case 'set':
        observable = this.portfolioService.setInitialBalance(data.amount);
        break;
    }

    observable.subscribe({
      next: (account) => {
        console.log('✅ Balance operation successful:', account);
        this.loadPortfolio(); // Refresh everything
      },
      error: (err) => {
        console.error('❌ Balance operation failed:', err);
        alert(err.error?.message || 'Balance operation failed');
      }
    });
  }

  // Trade Modal Methods
  openBuyModal(asset: PortfolioAssetDto) {
    this.selectedAsset.set(asset);
    this.modalType.set('buy');
    this.isTradeModalOpen.set(true);
  }

  openSellModal(asset: PortfolioAssetDto) {
    this.selectedAsset.set(asset);
    this.modalType.set('sell');
    this.isTradeModalOpen.set(true);
  }

  closeTradeModal() {
    this.isTradeModalOpen.set(false);
    this.selectedAsset.set(null);
  }

  executeTrade(data: { quantity: number; price: number }) {
    const asset = this.selectedAsset();
    if (!asset) return;

    const type = this.modalType();
    const totalAmount = data.quantity * data.price;
    let tradeObservable: Observable<TransactionResponseDto>;
    let balanceObservable: Observable<AccountDto>;

    if (type === 'buy') {
      tradeObservable = this.portfolioService.buyAsset({
        symbol: asset.symbol,
        quantity: data.quantity,
        pricePerCoin: data.price
      });
      balanceObservable = this.portfolioService.withdrawMoney(totalAmount);
    } else {
      tradeObservable = this.portfolioService.sellAsset({
        symbol: asset.symbol,
        quantity: data.quantity,
        pricePerCoin: data.price
      });
      balanceObservable = this.portfolioService.depositMoney(totalAmount);
    }

    tradeObservable.pipe(
      switchMap(() => balanceObservable)
    ).subscribe({
      next: () => {
        console.log(`${type.toUpperCase()} erfolgreich + Balance um $${totalAmount.toFixed(2)} angepasst`);
        this.loadPortfolio();
      },
      error: (err) => {
        console.error(`${type} oder Balance-Update fehlgeschlagen:`, err);
        alert(err.error?.message || `${type} fehlgeschlagen`);
      }
    });

    this.closeTradeModal();
  }

  openAddAssetModal() {
    this.isAddAssetModalOpen.set(true);
  }

  closeAddAssetModal() {
    this.isAddAssetModalOpen.set(false);
  }

  executeAddAsset(data: { symbol: string; quantity: number; price: number }) {
    const request: BuyRequestDto = {
      symbol: data.symbol,
      quantity: data.quantity,
      pricePerCoin: data.price
    };

    const cost = data.quantity * data.price;   // Betrag, der abgezogen werden soll

    this.portfolioService.createAsset(request).pipe(
      switchMap(() => this.portfolioService.withdrawMoney(cost))   // ← Balance abziehen
    ).subscribe({
      next: (account) => {
        console.log('✅ Neues Asset hinzugefügt + Balance abgezogen:', account);
        this.loadPortfolio();
      },
      error: (err) => {
        console.error('❌ Fehler beim Hinzufügen oder Balance-Update:', err);
        alert(err.error?.error || 'Fehler beim Hinzufügen des Assets');
      }
    });
  }

  // Delete Asset Method
  deleteAsset(asset: PortfolioAssetDto) {
    const confirmed = confirm(
      `Are you sure you want to delete ${asset.symbol}?\n\n` +
      `This will remove ${asset.quantity} ${asset.symbol} from your portfolio.\n` +
      `Current value of $${(asset.quantity * asset.currentPriceUsd).toFixed(2)} will be added back to your initial balance.`
    );

    if (!confirmed) return;

    const currentValue = asset.quantity * (asset.currentPriceUsd || 0);

    this.portfolioService.deleteAsset(asset.symbol).pipe(
      switchMap(() => this.portfolioService.depositMoney(currentValue))
    ).subscribe({
      next: (account) => {
        console.log(`✅ Asset ${asset.symbol} deleted + $${currentValue.toFixed(2)} added back to balance:`, account);
        this.loadPortfolio();
      },
      error: (err) => {
        this.error.set('Failed to delete asset or update balance');
        console.error('Delete / Balance error:', err);
        alert(err.error?.error || err.error?.message || 'Delete failed');
      }
    });
  }
}
