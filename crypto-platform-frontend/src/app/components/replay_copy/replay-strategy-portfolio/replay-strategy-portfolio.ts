// Zeigt das Portfolio für den Strategy-Replay an.
// Wie replay-portfolio, aber ohne manuelle Trade-Buttons und mit Safety Vault Anzeige.

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReplayTradingService } from '../services/replay-strategy-trading.service';
import { ReplayHistoryComponent } from '../replay-history/replay-strategy-history';

@Component({
  selector: 'app-replay-strategy-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule, ReplayHistoryComponent],
  templateUrl: './replay-strategy-portfolio.html',
  styleUrl: './replay-strategy-portfolio.css'
})
export class ReplayStrategyPortfolioComponent {
  @Input() selectedSymbol!: string;
  @Input() currentPrice!: number;
  @Input() isPlaying!: boolean;
  @Input() tradingService!: ReplayTradingService;

  initialBalanceInput = 10000;

  setBalance() {
    const amount = Number(this.initialBalanceInput);
    if (amount > 0) {
      this.tradingService.setInitialBalance(amount);
    }
  }

  resetPortfolio() {
    this.tradingService.resetPortfolio();
  }
}