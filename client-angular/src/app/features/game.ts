import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Game as GameService } from '../core/services/game';
import { Toast } from '../shared/services/toast';

@Component({
  selector: 'ww-game',
  imports: [ReactiveFormsModule],
  styleUrl: './game.scss',
  templateUrl: './game.html',
})
export class Game implements OnInit {
  protected readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly wordControl = new FormControl('', { nonNullable: true });
  private readonly typedWord = toSignal(this.wordControl.valueChanges, {
    initialValue: this.wordControl.value,
  });
  protected readonly typedLetters = computed(() => this.typedWord().toUpperCase().split(''));
  protected readonly submitting = signal(false);
  protected readonly shakeWord = signal(false);

  protected readonly prefixDisplay = computed(() => this.game.prefix().toUpperCase());
  protected readonly wordCountDisplay = computed(() => `Palabras: ${this.game.words().length}`);
  protected readonly isVersus = computed(() => this.game.mode() === 'versus');
  /** En las partidas online (versus y "con amigos") no hay forma de salir
   * antes de tiempo: si cualquiera pudiera cortarla cuando quisiera,
   * terminaría la partida para el resto y solo el reloj debe decidir. El
   * botón queda para los modos locales (solo, cadena, amigos en un mismo
   * dispositivo), donde terminar solo afecta a quien juega. */
  protected readonly canEndEarly = computed(() => {
    const mode = this.game.mode();
    return mode !== 'lobby' && mode !== 'versus';
  });
  protected readonly opponentScoreDisplay = computed(() => `Rival: ${this.game.opponentScore()}`);

  protected readonly timerDisplay = computed(() => {
    const t = this.game.timeRemaining();
    if (t === -1) return '∞';
    const minutes = Math.floor(t / 60);
    const seconds = t % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });
  protected readonly timerWarning = computed(() => {
    const t = this.game.timeRemaining();
    return t !== -1 && t <= 30;
  });
  protected readonly timerDanger = computed(() => {
    const t = this.game.timeRemaining();
    return t !== -1 && t <= 10;
  });

  constructor() {
    // Cubre tanto el fin local (temporizador/botón) como el fin server-authoritative
    // de una partida versus (gameEnd llega de forma asíncrona por socket).
    effect(() => {
      if (this.game.status() === 'finished') {
        this.router.navigateByUrl('/play/results');
      }
    });
  }

  ngOnInit(): void {
    if (this.game.status() !== 'active') {
      this.router.navigateByUrl('/menu');
    }
  }

  protected async submit(): Promise<void> {
    const word = this.wordControl.value;
    if (!word.trim()) return;

    this.submitting.set(true);
    const result = await this.game.submitWord(word);
    this.submitting.set(false);

    // Se vacía tanto si se acepta como si se rechaza: dejar la palabra errónea invita a
    // reenviarla tal cual, y una vez rechazada seguirá siéndolo (no vale reintentar sin cambiarla).
    this.wordControl.setValue('');

    if (result.success) {
      if (result.message) this.toast.show(result.message, 'success');
    } else if (result.message) {
      this.toast.show(result.message, 'error');
      this.flashWordError();
    }
  }

  protected endGame(): void {
    this.game.end();
  }

  private flashWordError(): void {
    this.shakeWord.set(false);
    setTimeout(() => {
      this.shakeWord.set(true);
      setTimeout(() => this.shakeWord.set(false), 900);
    });
  }
}
