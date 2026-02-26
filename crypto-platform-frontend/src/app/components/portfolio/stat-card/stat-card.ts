import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: number = 0;
  @Input() subValue?: string;
  @Input() prefix: string = '';
  @Input() suffix: string = '';
  @Input() isPositive: boolean = false;
}