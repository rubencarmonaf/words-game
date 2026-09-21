import { Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Game as GameService } from '../core/services/game';
import { Toast } from '../shared/services/toast';
import { WwAvatar } from '../shared/components/ww-avatar';
import { WwTierBadge } from '../shared/components/ww-tier-badge';
import { WwRankEmblem } from '../shared/components/ww-rank-emblem';

const MATCHMAKING_PHRASES = [
  'Buscando línea disponible…',
  'Comprobando ELO similar…',
  'Confirmando andén…',
  'Casi listo para embarcar…',
];

// Debe coincidir con VERSUS_INTRO_MS en server.ts (lo que tarda en arrancar la
// partida tras mostrarse la pantalla VS); el servidor manda, esto solo cuenta.
const VERSUS_INTRO_SECONDS = 5;

@Component({
  selector: 'ww-matchmaking',
  imports: [WwAvatar, WwTierBadge, WwRankEmblem],
  styleUrl: './matchmaking.scss',
  templateUrl: './matchmaking.html',
})
export class Matchmaking implements OnInit, OnDestroy {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly phrases = MATCHMAKING_PHRASES;
  protected readonly phraseIndex = signal(0);
  protected readonly fadingOut = signal(false);
  protected readonly match = this.game.matchInfo;
  protected readonly countdown = signal(VERSUS_INTRO_SECONDS);

  private phraseInterval: ReturnType<typeof setInterval> | null = null;
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.game.status() === 'active') {
        this.router.navigateByUrl('/play/game');
      }
    });

    effect(() => {
      if (this.match()) untracked(() => this.startCountdown());
    });
  }

  ngOnInit(): void {
    this.game.startMatchmaking().subscribe((result) => {
      if (!result.success) {
        this.toast.show(result.message ?? 'Error uniéndose a matchmaking', 'error');
        this.router.navigateByUrl('/menu');
      }
    });

    this.phraseInterval = setInterval(() => {
      this.fadingOut.set(true);
      this.fadeTimeout = setTimeout(() => {
        this.phraseIndex.update((i) => (i + 1) % this.phrases.length);
        this.fadingOut.set(false);
      }, 200);
    }, 2600);
  }

  ngOnDestroy(): void {
    if (this.phraseInterval !== null) clearInterval(this.phraseInterval);
    if (this.fadeTimeout !== null) clearTimeout(this.fadeTimeout);
    if (this.countdownInterval !== null) clearInterval(this.countdownInterval);
  }

  /** "+5" / "−60" (con el signo menos tipográfico); 0 sin signo. */
  protected formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `−${Math.abs(delta)}`;
    return '0';
  }

  private startCountdown(): void {
    if (this.countdownInterval !== null) clearInterval(this.countdownInterval);
    this.countdown.set(VERSUS_INTRO_SECONDS);
    this.countdownInterval = setInterval(() => {
      this.countdown.update((n) => Math.max(1, n - 1));
    }, 1000);
  }

  protected cancel(): void {
    this.game.cancelMatchmaking();
    this.router.navigateByUrl('/menu');
  }
}
