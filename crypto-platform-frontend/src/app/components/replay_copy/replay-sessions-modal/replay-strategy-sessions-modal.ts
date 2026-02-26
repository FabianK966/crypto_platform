// Eigenständige Komponente zum Anzeigen aller gespeicherten Replay-Sessions.
// Öffnet ein Overlay-Modal mit Session-Liste und Detail-Ansicht pro Session.

import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReplayService } from '../../../services/replay.service';
import { ReplaySessionResponse } from '../../../models/replay.model';

@Component({
  selector: 'app-replay-sessions-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replay-strategy-sessions-modal.html',
  styleUrl: './replay-strategy-sessions-modal.css'
})
export class ReplaySessionsModalComponent implements OnInit {

  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  constructor(private replayService: ReplayService) {}

  sessions = signal<ReplaySessionResponse[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  expandedSessionId = signal<string | null>(null);   // Welche Session ist aufgeklappt?
  deletingId = signal<string | null>(null);

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.loading.set(true);
    this.error.set(null);
    this.replayService.getAllSessions().subscribe({
      next: (data) => {
        this.sessions.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Sessions');
        this.loading.set(false);
      }
    });
  }

  toggleExpand(id: string) {
    this.expandedSessionId.set(this.expandedSessionId() === id ? null : id);
  }

  deleteSession(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Session wirklich löschen?')) return;
    this.deletingId.set(id);
    this.replayService.deleteSession(id).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(s => s.id !== id));
        this.deletingId.set(null);
        if (this.expandedSessionId() === id) this.expandedSessionId.set(null);
      },
      error: () => this.deletingId.set(null)
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  // ── Hilfsmethoden für die Anzeige ────────────────────────────────

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  formatMoney(val: number | string): string {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  formatCrypto(val: number | string): string {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 8 }).format(n);
  }

  pnlClass(val: number | string): string {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (n > 0) return 'positive';
    if (n < 0) return 'negative';
    return 'neutral';
  }

  progressPercent(session: ReplaySessionResponse): number {
    if (!session.totalCandles) return 0;
    return Math.round((session.currentCandle / session.totalCandles) * 100);
  }

  totalPnlPercent(session: ReplaySessionResponse): number {
    const init = parseFloat(session.initialBalance as any);
    const total = parseFloat(session.totalBalance as any);
    if (!init) return 0;
    return ((total - init) / init) * 100;
  }

  hasOpenLong(session: ReplaySessionResponse): boolean {
    return parseFloat(session.longQuantity as any) > 0;
  }

  hasOpenShort(session: ReplaySessionResponse): boolean {
    return parseFloat(session.shortQuantity as any) > 0;
  }
}