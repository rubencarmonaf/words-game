import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Game as GameService } from '../core/services/game';
import { Toast } from '../shared/services/toast';

const MATCHMAKING_PHRASES = [
  'Buscando línea disponible…',
  'Comprobando ELO similar…',
  'Confirmando andén…',
  'Casi listo para embarcar…',
];

@Component({
  selector: 'ww-matchmaking',
  imports: [],
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

  private phraseInterval: ReturnType<typeof setInterval> | null = null;
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.game.status() === 'active') {
        this.router.navigateByUrl('/play/game');
      }
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
  }

  protected cancel(): void {
    this.game.cancelMatchmaking();
    this.router.navigateByUrl('/menu');
  }
}
