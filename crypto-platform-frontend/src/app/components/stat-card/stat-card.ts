import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value" [ngClass]="{
        'positive': isPositive && value > 0,
        'negative': isPositive && value < 0
      }">
        {{ prefix }}{{ value | number:'1.2-2' }}{{ suffix }}
      </div>
      @if (subValue !== undefined) {
        <div class="stat-sub">{{ subValue }}</div>
      }
    </div>
  `,
  styles: [`
    .stat-card {
      background: rgba(20, 20, 20, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      backdrop-filter: blur(10px);
    }

    .stat-label {
      color: #999;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #fff;
      
      &.positive {
        color: #26a69a;
      }
      
      &.negative {
        color: #ef5350;
      }
    }

    .stat-sub {
      color: #666;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: number = 0;
  @Input() subValue?: string;
  @Input() prefix: string = '';
  @Input() suffix: string = '';
  @Input() isPositive: boolean = false;
}