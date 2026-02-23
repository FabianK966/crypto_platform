// src/app/components/replay/components/replay-portfolio/replay-portfolio.component.ts

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplayTradingService } from '../services/replay-trading.service';
import { ReplayTradeModalComponent } from '../replay-trade-modal/replay-trade-modal';
import { ReplayDepositModalComponent } from '../replay-deposit-modal/replay-deposit-modal';
import { ReplayHistoryComponent } from '../replay-history/replay-history';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-replay-portfolio',
  standalone: true,
  imports: [CommonModule, ReplayTradeModalComponent,FormsModule, ReplayDepositModalComponent, ReplayHistoryComponent],
  templateUrl: './replay-portfolio.html',
  styleUrl: './replay-portfolio.css'
})
export class ReplayPortfolioComponent {
  @Input() selectedSymbol!: string;
  @Input() currentPrice!: number;
  @Input() isPlaying!: boolean;
  @Input() tradingService!: ReplayTradingService;

  initialBalanceInput = 10000;
  tradeModalOpen = false;
  tradeModalType: 'buy' | 'sell' = 'buy';
  tradeModalPosition: 'long' | 'short' = 'long';
  depositModalOpen = false;

  setBalance() {
    const amount = Number(this.initialBalanceInput);
    if (amount > 0) {
      this.tradingService.setInitialBalance(amount);
    }
  }

  resetPortfolio() {
    this.tradingService.resetPortfolio();
  }

  openTradeModal(type: 'buy' | 'sell', position: 'long' | 'short') {
    this.tradeModalType = type;
    this.tradeModalPosition = position;
    this.tradeModalOpen = true;
  }

  closeTradeModal() {
    this.tradeModalOpen = false;
  }

  openDepositModal() {
    this.depositModalOpen = true;
  }

  closeDepositModal() {
    this.depositModalOpen = false;
  }

  isTradeDisabled(): boolean {
    return this.isPlaying || this.currentPrice <= 0;
  }
}