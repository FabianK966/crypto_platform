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
  template: `
    <div class="portfolio-container">
      <!-- Balance Management Section -->
      <div class="balance-section">
        <div class="balance-header">
          <h2>💰 Balance Management</h2>
          <div class="balance-actions">
            <button class="btn-deposit" (click)="openBalanceModal('deposit')">
              ➕ Deposit
            </button>
            <button class="btn-withdraw" (click)="openBalanceModal('withdraw')">
              ➖ Withdraw
            </button>
            <button class="btn-set-balance" (click)="openBalanceModal('set')">
              ⚙️ Set Balance
            </button>
          </div>
        </div>

        <div class="balance-stats-grid">
          <app-stat-card
            label="Initial Balance (Cash)"
            [value]="initialBalance()"
            prefix="$"
            subValue="Available to invest"
          />
          <app-stat-card
            label="Total Asset Value"
            [value]="totalAssetValue()"
            prefix="$"
            subValue="Current holdings"
          />
          <app-stat-card
            label="Total Balance"
            [value]="totalBalance()"
            prefix="$"
            subValue="Cash + Assets"
          />
        </div>
      </div>

      <!-- Portfolio Stats -->
      <div class="stats-grid">
        <app-stat-card
          label="Unrealized P&L"
          [value]="totalUnrealizedProfit()"
          [isPositive]="true"
          prefix="$"
        />
        <app-stat-card
          label="Realized P&L"
          [value]="totalRealizedProfit()"
          [isPositive]="true"
          prefix="$"
        />
        <app-stat-card
          label="Total P&L"
          [value]="totalUnrealizedProfit() + totalRealizedProfit()"
          [isPositive]="true"
          prefix="$"
          subValue="Realized + Unrealized"
        />
      </div>

      <!-- Portfolio Table -->
      <div class="portfolio-table">
        <div class="table-header">
          <h2>📊 My Assets</h2>
          <div class="header-actions">
            <button class="btn-add-new" (click)="openAddAssetModal()">
              ➕ Add Asset
            </button>
            <button class="btn-refresh" (click)="loadPortfolio()">
              🔄 Refresh
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading portfolio...</p>
          </div>
        } @else if (error()) {
          <div class="error">
            ❌ {{ error() }}
          </div>
        } @else if (portfolio().length === 0) {
          <div class="empty">
            <div class="empty-icon">📊</div>
            <h3>No Assets Yet</h3>
            <p>Start building your crypto portfolio today</p>
            <button class="btn-primary" (click)="openAddAssetModal()">
              ➕ Add Your First Asset
            </button>
          </div>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Avg. Buy Price</th>
                <th>Current Price</th>
                <th>Current Value</th>
                <th>Unrealized P&L</th>
                <th>Realized P&L</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (asset of portfolio(); track asset.id) {
                <tr>
                  <td>
                    <div class="asset-cell">
                      <span class="symbol">{{ asset.symbol }}</span>
                    </div>
                  </td>
                  <td>{{ asset.quantity | number:'1.0-8' }}</td>
                  <td>\${{ asset.avgBuyPriceUsd | number:'1.2-2' }}</td>
                  <td>\${{ asset.currentPriceUsd | number:'1.2-2' }}</td>
                  <td>\${{ asset.currentValueUsd | number:'1.2-2' }}</td>
                  <td [ngClass]="{
                    'positive': asset.profitLossUsd > 0,
                    'negative': asset.profitLossUsd < 0
                  }">
                    \${{ asset.profitLossUsd | number:'1.2-2' }}
                    <span class="percent">
                      ({{ asset.profitLossPercent | number:'1.2-2' }}%)
                    </span>
                  </td>
                  <td [ngClass]="{
                    'positive': asset.totalRealizedProfit > 0,
                    'negative': asset.totalRealizedProfit < 0
                  }">
                    \${{ asset.totalRealizedProfit | number:'1.2-2' }}
                  </td>
                  <td>
                    <div class="actions">
                      <button class="btn-buy" (click)="openBuyModal(asset)">Buy</button>
                      <button class="btn-sell" (click)="openSellModal(asset)">Sell</button>
                      <button class="btn-delete" (click)="deleteAsset(asset)">🗑️</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <!-- Trade Modal -->
      <app-trade-modal
        [open]="isTradeModalOpen()"
        [type]="modalType()"
        [assetData]="selectedAsset()"
        (closeModal)="closeTradeModal()"
        (trade)="executeTrade($event)"
      />

      <!-- Add Asset Modal -->
      <app-add-asset-modal
        [open]="isAddAssetModalOpen()"
        (closeModal)="closeAddAssetModal()"
        (addAsset)="executeAddAsset($event)"
      />

      <!-- Balance Modal -->
      <app-balance-modal
        [open]="isBalanceModalOpen()"
        [type]="balanceOperationType()"
        [balance]="initialBalance()"
        (closeModal)="closeBalanceModal()"
        (operation)="executeBalanceOperation($event)"
      />
    </div>
  `,
  styles: [`
    .portfolio-container {
      padding: 2rem;
      max-width: 1800px;
      margin: 0 auto;
    }

    /* Balance Section */
    .balance-section {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
      margin-bottom: 2rem;
    }

    .balance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;

      h2 {
        font-size: 1.5rem;
        font-weight: 600;
      }
    }

    .balance-actions {
      display: flex;
      gap: 0.75rem;
    }

    .btn-deposit {
      background: linear-gradient(135deg, #26a69a 0%, #1e8e7e 100%);
      border: none;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(38, 166, 154, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(38, 166, 154, 0.4);
      }
    }

    .btn-withdraw {
      background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
      border: none;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(239, 83, 80, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(239, 83, 80, 0.4);
      }
    }

    .btn-set-balance {
      background: rgba(41, 98, 255, 0.1);
      border: 1px solid #2962ff;
      color: #2962ff;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: rgba(41, 98, 255, 0.2);
      }
    }

    .balance-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .portfolio-table {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;

      h2 {
        font-size: 1.5rem;
        font-weight: 600;
      }
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .btn-add-new {
      background: linear-gradient(135deg, #2962ff 0%, #1e4ed8 100%);
      border: none;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(41, 98, 255, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(41, 98, 255, 0.4);
      }
    }

    .btn-refresh {
      background: rgba(41, 98, 255, 0.1);
      border: 1px solid #2962ff;
      color: #2962ff;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: rgba(41, 98, 255, 0.2);
      }
    }

    table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: 1rem;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      th {
        color: #999;
        font-weight: 500;
        font-size: 0.875rem;
        text-transform: uppercase;
      }

      td {
        color: #fff;
        font-size: 0.95rem;
      }

      tbody tr {
        transition: background 0.2s;

        &:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      }
    }

    .asset-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .symbol {
        font-weight: 600;
        font-size: 1rem;
      }
    }

    .positive {
      color: #26a69a !important;
    }

    .negative {
      color: #ef5350 !important;
    }

    .percent {
      font-size: 0.875rem;
      opacity: 0.8;
      margin-left: 0.25rem;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-buy {
      background: rgba(38, 166, 154, 0.1);
      border: 1px solid #26a69a;
      color: #26a69a;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: all 0.2s;

      &:hover {
        background: rgba(38, 166, 154, 0.2);
        transform: translateY(-1px);
      }
    }

    .btn-sell {
      background: rgba(239, 83, 80, 0.1);
      border: 1px solid #ef5350;
      color: #ef5350;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: all 0.2s;

      &:hover {
        background: rgba(239, 83, 80, 0.2);
        transform: translateY(-1px);
      }
    }

    .btn-delete {
      background: rgba(239, 83, 80, 0.1);
      border: 1px solid rgba(239, 83, 80, 0.3);
      color: #ef5350;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: all 0.2s;

      &:hover {
        background: rgba(239, 83, 80, 0.2);
        transform: translateY(-1px);
      }
    }

    .loading, .error, .empty {
      text-align: center;
      padding: 3rem;
      color: #999;
    }

    .empty {
      padding: 4rem 2rem;

      .empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #fff;
      }

      p {
        color: #999;
        margin-bottom: 2rem;
      }

      .btn-primary {
        background: linear-gradient(135deg, #2962ff 0%, #1e4ed8 100%);
        border: none;
        color: white;
        padding: 0.875rem 1.75rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(41, 98, 255, 0.3);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(41, 98, 255, 0.4);
        }
      }
    }

    .error {
      color: #ef5350;
    }
  `]
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
