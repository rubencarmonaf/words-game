import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Game } from '../core/services/game';

/** game-setup only ever handles the local modes — versus skips straight from
 * the menu to /play/matchmaking, it never has a setup form. */
type LocalGameMode = 'solo' | 'cadena' | 'friendly';

const TITLES: Record<LocalGameMode, string> = {
  solo: 'Modo Solo - Práctica',
  cadena: 'Modo Cadena - Eliminación',
  friendly: 'Juego con Amigos',
};

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

@Component({
  selector: 'ww-game-setup',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './game-setup.scss',
  templateUrl: './game-setup.html',
})
export class GameSetup {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly game = inject(Game);
  private readonly fb = inject(FormBuilder);

  protected readonly mode = signal<LocalGameMode>(
    (this.route.snapshot.paramMap.get('mode') as LocalGameMode) || 'solo',
  );
  protected readonly title = computed(() => TITLES[this.mode()]);
  protected readonly showPlayerConfig = computed(() => this.mode() !== 'solo');
  protected readonly showPlayerNames = computed(() => this.mode() === 'friendly');

  protected readonly form = this.fb.nonNullable.group({
    prefix: ['', [Validators.required, Validators.maxLength(5)]],
    playerCount: this.fb.nonNullable.control(MIN_PLAYERS, [
      Validators.min(MIN_PLAYERS),
      Validators.max(MAX_PLAYERS),
    ]),
    playerNames: this.fb.nonNullable.array<string>([]),
  });

  constructor() {
    this.game.setMode(this.mode());
    this.regeneratePlayerNames(this.form.controls.playerCount.value);
    this.form.controls.playerCount.valueChanges.subscribe((count) => this.regeneratePlayerNames(count));
  }

  protected get playerNameControls() {
    return this.form.controls.playerNames.controls;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.game
      .start({
        prefix: raw.prefix.toLowerCase().trim(),
        players: raw.playerNames.map((name, i) => name.trim() || `Jugador ${i + 1}`),
        playerCount: raw.playerCount,
      })
      .then(() => this.router.navigateByUrl('/play/game'));
  }

  private regeneratePlayerNames(count: number): void {
    const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count || MIN_PLAYERS));
    const names = this.form.controls.playerNames;

    while (names.length < clamped) {
      names.push(this.fb.nonNullable.control(`Jugador ${names.length + 1}`));
    }
    while (names.length > clamped) {
      names.removeAt(names.length - 1);
    }
  }
}
