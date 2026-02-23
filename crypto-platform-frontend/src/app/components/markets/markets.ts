import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MarketService } from '../../services/market.service';
import { MarketPrice } from '../../models/markets.model';
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
  templateUrl: './markets.html',
  styleUrl: './markets.css',
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

  // Inline Styles Container
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
    'max-height': 'calc(100vh - 200px)',
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
