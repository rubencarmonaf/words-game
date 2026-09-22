import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DailyLeaderboardEntry, LeaderboardScope } from '@shared-types';
import { Leaderboard as LeaderboardService } from '../core/services/leaderboard';
import { Auth } from '../core/services/auth';
import { Toast } from '../shared/services/toast';
import { WwAvatar } from '../shared/components/ww-avatar';
import { WwTierBadge } from '../shared/components/ww-tier-badge';

/** Ranking del reto diario de hoy: global o solo entre amigos. Sin histórico — cada día trae
 * un prefijo distinto, así que solo tiene sentido comparar dentro del mismo día. */
@Component({
  selector: 'ww-leaderboard',
  imports: [RouterLink, WwAvatar, WwTierBadge],
  styleUrl: './leaderboard.scss',
  templateUrl: './leaderboard.html',
})
export class Leaderboard implements OnInit {
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly auth = inject(Auth);
  private readonly toast = inject(Toast);

  protected readonly scope = signal<LeaderboardScope>('global');
  protected readonly loading = signal(true);
  protected readonly entries = signal<DailyLeaderboardEntry[]>([]);
  protected readonly me = signal<DailyLeaderboardEntry | null>(null);
  protected readonly totalPlayers = signal(0);

  protected readonly myUserId = this.auth.getUserId();

  /** Mi fila se pinta aparte, debajo de la lista, solo cuando queda fuera de las mostradas
   * (si ya sale entre `entries` no hace falta repetirla). */
  protected readonly showPinnedMe = computed(() => {
    const me = this.me();
    if (!me) return false;
    return !this.entries().some((e) => e.userId === me.userId);
  });

  ngOnInit(): void {
    this.load('global');
  }

  protected switchScope(scope: LeaderboardScope): void {
    if (scope === this.scope()) return;
    this.scope.set(scope);
    this.load(scope);
  }

  private load(scope: LeaderboardScope): void {
    this.loading.set(true);
    this.leaderboardService.get(scope).subscribe((result) => {
      this.loading.set(false);
      if (result.success && result.data) {
        this.entries.set(result.data.entries);
        this.me.set(result.data.me);
        this.totalPlayers.set(result.data.totalPlayers);
      } else {
        this.toast.show(result.message ?? 'No se pudo cargar el ranking', 'error');
      }
    });
  }
}
