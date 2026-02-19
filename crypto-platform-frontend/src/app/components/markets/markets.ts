import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MarketService } from '../../services/market.service';
import { MarketPrice } from '../../models/markets.model';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';

interface CoinInfo {
  symbol: string;
  name: string;
  tradingPair: string;
  price?: number;
  priceChange?: number;
}

@Component({
  selector: 'app-coin-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule
  ],
  template: `
    <div [ngStyle]="containerStyle">
      <div [ngStyle]="headerStyle">
        <h2 [ngStyle]="titleStyle">Markets</h2>
        <p-button 
          icon="pi pi-refresh" 
          label="Refresh"
          [outlined]="true"
          severity="info"
          (onClick)="refreshMarkets()"
        />
      </div>

      <p-table
        #marketsTable
        [value]="coins"
        [loading]="isLoading()"
        [paginator]="false"          
        [scrollable]="true"
        scrollHeight="flex"
        [globalFilterFields]="['symbol', 'name']"
        styleClass="p-datatable-sm p-datatable-striped"
      >
        <ng-template pTemplate="caption">
          <div [ngStyle]="captionStyle">
            <span class="p-input-icon-left">
              <i class="pi pi-search"></i>
              <input 
                pInputText 
                type="text" 
                (input)="marketsTable.filterGlobal($any($event.target).value, 'contains')" 
                placeholder="Search markets..."
                [ngStyle]="searchInputStyle"
              />
            </span>
          </div>
        </ng-template>

        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="symbol" style="width: 25%">
              Asset <p-sortIcon field="symbol" />
            </th>
            <th pSortableColumn="price" style="width: 25%">
              Price <p-sortIcon field="price" />
            </th>
            <th pSortableColumn="priceChange" style="width: 25%">
              24h Change <p-sortIcon field="priceChange" />
            </th>
            <th style="width: 25%">
              Actions
            </th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-coin>
          <tr>
            <td>
              <div [ngStyle]="assetCellStyle">
                <span [ngStyle]="symbolStyle">{{ coin.symbol }}</span>
                <span [ngStyle]="nameStyle">{{ coin.name }}</span>
              </div>
            </td>
            <td>
              @if (coin.price) {
                <span [ngStyle]="priceStyle">\${{ coin.price | number:'1.2-2' }}</span>
              } @else {
                <span [ngStyle]="loadingPriceStyle">Loading...</span>
              }
            </td>
            <td>
              @if (coin.priceChange !== undefined) {
                <p-tag 
                  [value]="(coin.priceChange > 0 ? '+' : '') + (coin.priceChange | number:'1.2-2') + '%'"
                  [severity]="getChangeSeverity(coin.priceChange)"
                />
              } @else {
                <span [ngStyle]="loadingPriceStyle">-</span>
              }
            </td>
            <td>
              <div [ngStyle]="actionsStyle">
                <p-button
                  icon="pi pi-info-circle"
                  label="Info"
                  [outlined]="true"
                  size="small"
                  severity="info"
                  (onClick)="viewDetails(coin)"
                />
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="4">
              <div [ngStyle]="emptyStateStyle">
                <div [ngStyle]="emptyIconStyle">📈</div>
                <h3 [ngStyle]="emptyTitleStyle">No Market Data</h3>
                <p [ngStyle]="emptyTextStyle">Unable to load cryptocurrency markets</p>
              </div>
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="loadingbody">
          <tr>
            <td colspan="4">
              <div [ngStyle]="loadingStateStyle">
                <div [ngStyle]="spinnerStyle"></div>
                <p [ngStyle]="loadingTextStyle">Loading markets...</p>
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>

      @if (errorMessage()) {
        <div [ngStyle]="errorMessageStyle">
          <i class="pi pi-exclamation-triangle"></i>
          {{ errorMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
  /* PrimeNG Global Overrides - ALLE TRANSPARENT */
  ::ng-deep .p-datatable {
    background: transparent !important;
    color: #fff;
  }

  ::ng-deep .p-datatable .p-datatable-header {
    background: transparent !important;
    border: none;
    padding: 0 0 1rem 0;
  }

  ::ng-deep .p-datatable-wrapper {
    background: transparent !important;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  ::ng-deep .p-datatable-wrapper::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  ::ng-deep .p-datatable-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  ::ng-deep .p-datatable-wrapper::-webkit-scrollbar-thumb {
    background: rgba(255, 252, 252, 0.18);
    border-radius: 20px;
  }

  ::ng-deep .p-datatable-wrapper::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  ::ng-deep .p-datatable .p-datatable-thead > tr > th {
    background: rgba(20, 20, 20, 0.98) !important;
    color: #999;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 500;
    font-size: 0.875rem;
    text-transform: uppercase;
    padding: 1rem;
    position: sticky !important;
    top: 0;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  ::ng-deep .p-datatable .p-datatable-tbody > tr {
    background: transparent !important;
    color: #ffffff;
    transition: background 0.2s;
  }

  ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
    background: rgba(255, 255, 255, 0.02) !important;
  }

  ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding: 1.1rem 1rem;
    background: transparent !important;
  }

  ::ng-deep .p-datatable-table {
    background: transparent !important;
  }

  ::ng-deep .p-sortable-column:hover {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  ::ng-deep .p-sortable-column .p-sortable-column-icon {
    color: #999;
  }

  ::ng-deep .p-sortable-column.p-highlight {
    background: rgba(41, 98, 255, 0.1) !important;
    color: #2962ff;
  }

  ::ng-deep .p-sortable-column.p-highlight .p-sortable-column-icon {
    color: #2962ff;
  }

  ::ng-deep .p-tag.p-tag-success {
    background: rgba(38, 166, 154, 0.2) !important;
    color: #26a69a;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
  }

  ::ng-deep .p-tag.p-tag-danger {
    background: rgba(239, 83, 80, 0.2) !important;
    color: #ef5350;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
  }

  ::ng-deep .p-tag.p-tag-secondary {
    background: rgba(153, 153, 153, 0.2) !important;
    color: #999;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
  }

  ::ng-deep .p-button {
    background: transparent !important;
  }

  ::ng-deep .p-button.p-button-outlined.p-button-info {
    color: #2962ff;
    border-color: #2962ff;
    background: transparent !important;
  }

  ::ng-deep .p-button.p-button-outlined.p-button-info:hover {
    background: rgba(41, 98, 255, 0.1) !important;
  }

  ::ng-deep .p-input-icon-left > input {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding-left: 2.5rem;
  }

  ::ng-deep .p-input-icon-left > input:focus {
    border-color: #2962ff;
    box-shadow: 0 0 0 0.2rem rgba(41, 98, 255, 0.25);
    background: rgba(255, 255, 255, 0.08) !important;
  }

  ::ng-deep .p-input-icon-left > input::placeholder {
    color: #666;
  }

  ::ng-deep .p-input-icon-left > i {
    color: #999;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    ::ng-deep .p-datatable .p-datatable-thead > tr > th,
    ::ng-deep .p-datatable .p-datatable-tbody > tr > td {
      padding: 0.75rem 0.5rem;
      font-size: 0.875rem;
    }
  }
`]
})
export class Markets implements OnInit, OnDestroy {

  coins: CoinInfo[] = [
    { symbol: 'BTC', name: 'Bitcoin', tradingPair: 'BTCUSDT' },
    { symbol: 'ETH', name: 'Ethereum', tradingPair: 'ETHUSDT' },
    { symbol: 'XRP', name: 'Ripple', tradingPair: 'XRPUSDT' },
    { symbol: 'BNB', name: 'BNB', tradingPair: 'BNBUSDT' },
    { symbol: 'SOL', name: 'Solana', tradingPair: 'SOLUSDT' },
    { symbol: 'TRX', name: 'TRON', tradingPair: 'TRXUSDT' },
    { symbol: 'DOGE', name: 'Dogecoin', tradingPair: 'DOGEUSDT' },
    { symbol: 'ADA', name: 'Cardano', tradingPair: 'ADAUSDT' },
    { symbol: 'BCH', name: 'Bitcoin Cash', tradingPair: 'BCHUSDT' },
    { symbol: 'XLM', name: 'Stellar', tradingPair: 'XLMUSDT' },
    { symbol: 'SUI', name: 'Sui', tradingPair: 'SUIUSDT' },
    { symbol: 'XMR', name: 'Monero', tradingPair: 'XMRUSDT' },
    { symbol: 'AVAX', name: 'Avalanche', tradingPair: 'AVAXUSDT' },
    { symbol: 'LINK', name: 'Chainlink', tradingPair: 'LINKUSDT' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', tradingPair: 'WBTCUSDT' },
    { symbol: 'HBAR', name: 'Hedera', tradingPair: 'HBARUSDT' },
    { symbol: 'DOT', name: 'Polkadot', tradingPair: 'DOTUSDT' },
    { symbol: 'LTC', name: 'Litecoin', tradingPair: 'LTCUSDT' },
    { symbol: 'NEAR', name: 'NEAR Protocol', tradingPair: 'NEARUSDT' },
    { symbol: 'UNI', name: 'Uniswap', tradingPair: 'UNIUSDT' },
    { symbol: 'PEPE', name: 'Pepe', tradingPair: 'PEPEUSDT' },
    { symbol: 'APT', name: 'Aptos', tradingPair: 'APTUSDT' },
    { symbol: 'ETC', name: 'Ethereum Classic', tradingPair: 'ETCUSDT' },
    { symbol: 'VET', name: 'VeChain', tradingPair: 'VETUSDT' },
    { symbol: 'ICP', name: 'Internet Computer', tradingPair: 'ICPUSDT' },
    { symbol: 'POL', name: 'Polygon', tradingPair: 'POLUSDT' },
    { symbol: 'FIL', name: 'Filecoin', tradingPair: 'FILUSDT' },
    { symbol: 'RENDER', name: 'Render', tradingPair: 'RENDERUSDT' },
    { symbol: 'OM', name: 'Mantra', tradingPair: 'OMUSDT' },
    { symbol: 'ONDO', name: 'Ondo', tradingPair: 'ONDOUSDT' },
    { symbol: 'OP', name: 'Optimism', tradingPair: 'OPUSDT' },
    { symbol: 'FET', name: 'Artificial Superintelligence Alliance', tradingPair: 'FETUSDT' },
    { symbol: 'STX', name: 'Stacks', tradingPair: 'STXUSDT' },
    { symbol: 'TAO', name: 'Bittensor', tradingPair: 'TAOUSDT' },
    { symbol: 'IMX', name: 'Immutable', tradingPair: 'IMXUSDT' },
    { symbol: 'ARB', name: 'Arbitrum', tradingPair: 'ARBUSDT' },
    { symbol: 'AAVE', name: 'Aave', tradingPair: 'AAVEUSDT' },
    { symbol: 'ENA', name: 'Ethena', tradingPair: 'ENAUSDT' },
    { symbol: 'ALGO', name: 'Algorand', tradingPair: 'ALGOUSDT' },
    { symbol: 'TIA', name: 'Celestia', tradingPair: 'TIAUSDT' },
    { symbol: 'GRT', name: 'The Graph', tradingPair: 'GRTUSDT' },
    { symbol: 'THETA', name: 'Theta Network', tradingPair: 'THETAUSDT' },
    { symbol: 'FLOW', name: 'Flow', tradingPair: 'FLOWUSDT' },
  ];

  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  private pricesSub?: Subscription;

  // Inline Styles – nur containerStyle angepasst
  containerStyle = {
    'background': 'rgba(20, 20, 20, 0.3)',
    'border': '1px solid rgba(255, 255, 255, 0.15)',
    'border-radius': '12px',
    'padding': '1.5rem',
    'backdrop-filter': 'blur(15px)',
    '-webkit-backdrop-filter': 'blur(15px)',
    'display': 'flex',
    'flex-direction': 'column',
    'max-width': '1800px',
    'margin': '2rem auto',
    'max-height': 'calc(100vh - 200px)',   // passt perfekt zum Bild
    'overflow-y': 'auto',
    'height': 'auto'
  };

  headerStyle = {
    'display': 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    'margin-bottom': '1.5rem'
  };

  titleStyle = {
    'font-size': '1.5rem',
    'font-weight': '600',
    'color': '#fff',
    'margin': '0'
  };

  captionStyle = {
    'display': 'flex',
    'justify-content': 'flex-end',
    'padding-bottom': '1rem'
  };

  searchInputStyle = {
    'background': 'rgba(255, 255, 255, 0.05)',
    'border': '1px solid rgba(255, 255, 255, 0.1)',
    'color': '#fff'
  };

  assetCellStyle = {
    'display': 'flex',
    'flex-direction': 'column',
    'gap': '0.25rem'
  };

  symbolStyle = {
    'font-weight': '600',
    'font-size': '1rem',
    'color': '#fff'
  };

  nameStyle = {
    'font-size': '0.875rem',
    'color': '#94a3b8'
  };

  priceStyle = {
    'font-weight': '500',
    'font-variant-numeric': 'tabular-nums',
    'color': '#e2e8f0'
  };

  loadingPriceStyle = {
    'color': '#666',
    'font-size': '0.875rem'
  };

  actionsStyle = {
    'display': 'flex',
    'gap': '0.5rem'
  };

  emptyStateStyle = {
    'text-align': 'center',
    'padding': '3rem 2rem'
  };

  emptyIconStyle = {
    'font-size': '4rem',
    'margin-bottom': '1rem'
  };

  emptyTitleStyle = {
    'font-size': '1.5rem',
    'font-weight': '600',
    'margin-bottom': '0.5rem',
    'color': '#fff'
  };

  emptyTextStyle = {
    'color': '#999',
    'margin': '0'
  };

  loadingStateStyle = {
    'text-align': 'center',
    'padding': '3rem 2rem'
  };

  spinnerStyle = {
    'border': '3px solid #2a2a2a',
    'border-top': '3px solid #2962ff',
    'border-radius': '50%',
    'width': '40px',
    'height': '40px',
    'animation': 'spin 1s linear infinite',
    'margin': '0 auto 1rem'
  };

  loadingTextStyle = {
    'color': '#999',
    'margin': '0'
  };

  errorMessageStyle = {
    'background': 'rgba(239, 83, 80, 0.1)',
    'border': '1px solid rgba(239, 83, 80, 0.3)',
    'border-radius': '8px',
    'padding': '1rem',
    'color': '#ef5350',
    'display': 'flex',
    'align-items': 'center',
    'gap': '0.75rem',
    'margin-top': '1rem'
  };

  constructor(private marketService: MarketService) { }

  ngOnInit(): void {
    this.loadInitialPrices();
    this.startPriceRefresh();
  }

  ngOnDestroy(): void {
    this.pricesSub?.unsubscribe();
  }

  private loadInitialPrices(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const symbols = this.coins.map(c => c.tradingPair);

    this.marketService.getPrices(symbols).subscribe({
      next: (prices) => {
        this.updateCoinPrices(prices);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Initial price load failed', err);
        this.errorMessage.set('Failed to load market prices');
        this.isLoading.set(false);
      }
    });
  }

  private startPriceRefresh(): void {
    const symbols = this.coins.map(c => c.tradingPair);

    this.pricesSub = interval(5000)
      .pipe(switchMap(() => this.marketService.getPrices(symbols)))
      .subscribe({
        next: (prices) => this.updateCoinPrices(prices),
        error: (err) => console.warn('Price refresh failed', err)
      });
  }

  private updateCoinPrices(prices: MarketPrice[]): void {
    prices.forEach(price => {
      const coin = this.coins.find(c => c.tradingPair === price.symbol);
      if (coin) {
        coin.price = price.price;
        coin.priceChange = price.priceChangePercent;
      }
    });
    this.coins = [...this.coins];
  }

  refreshMarkets(): void {
    console.log('🔄 Refreshing markets...');
    this.loadInitialPrices();
  }

  viewDetails(coin: CoinInfo): void {
    console.log('ℹ️ View details:', coin.symbol);
    alert(
      `${coin.name} (${coin.symbol})\n\n` +
      `Current Price: $${coin.price?.toFixed(2) || 'N/A'}\n` +
      `24h Change: ${coin.priceChange?.toFixed(2) || 'N/A'}%\n` +
      `Trading Pair: ${coin.tradingPair}`
    );
  }

  getChangeSeverity(priceChange?: number): 'success' | 'danger' | 'secondary' {
    if (!priceChange) return 'secondary';
    return priceChange > 0 ? 'success' : 'danger';
  }
}