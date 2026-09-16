import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DailyChallenge as DailyChallengeService } from '../core/services/daily-challenge';
import { Toast } from '../shared/services/toast';

const CHALLENGE_DURATION_SECONDS = 120;
const MIN_WORDS = 3;

/** Ported from main.ts's daily challenge methods. Word validation stays
 * server-side per word for immediate feedback; the final set is re-validated
 * in bulk by /api/daily-challenge/complete, which is the real source of truth. */
@Component({
  selector: 'ww-daily-challenge',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './daily-challenge.scss',
  templateUrl: './daily-challenge.html',
})
export class DailyChallenge implements OnInit, OnDestroy {
  private readonly dailyChallenge = inject(DailyChallengeService);
  private readonly toast = inject(Toast);

  protected readonly prefix = signal('');
  protected readonly isActive = signal(false);
  protected readonly isCompleted = signal(false);
  protected readonly timeLeft = signal(CHALLENGE_DURATION_SECONDS);
  protected readonly words = signal<string[]>([]);
  protected readonly submitting = signal(false);
  protected readonly shakeWord = signal(false);

  protected readonly wordControl = new FormControl('', { nonNullable: true });
  private readonly typedWord = toSignal(this.wordControl.valueChanges, {
    initialValue: this.wordControl.value,
  });
  protected readonly typedLetters = computed(() => this.typedWord().toUpperCase().split(''));

  protected readonly timerDisplay = computed(() => {
    const t = this.timeLeft();
    const minutes = Math.floor(t / 60);
    const seconds = t % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.dailyChallenge.refresh().subscribe((result) => {
      if (!result.success || !result.data) {
        this.toast.show('Error cargando el reto diario', 'error');
        return;
      }

      this.prefix.set(result.data.challenge.prefix);
      if (result.data.isCompleted) {
        this.isCompleted.set(true);
        this.words.set(result.data.wordsFound ?? []);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  protected start(): void {
    this.isActive.set(true);
    this.timeLeft.set(CHALLENGE_DURATION_SECONDS);
    this.words.set([]);
    this.wordControl.setValue('');

    this.timer = setInterval(() => {
      this.timeLeft.update((t) => t - 1);
      if (this.timeLeft() <= 0) {
        this.end();
      }
    }, 1000);
  }

  protected async submit(): Promise<void> {
    const word = this.wordControl.value.trim().toLowerCase();
    if (!word) return;

    if (!word.startsWith(this.prefix().toLowerCase())) {
      this.toast.show(`La palabra debe empezar con "${this.prefix()}"`, 'error');
      this.flashWordError();
      return;
    }
    if (this.words().includes(word)) {
      this.toast.show('Ya has usado esta palabra', 'error');
      this.flashWordError();
      return;
    }

    this.submitting.set(true);
    const validation = await firstValueFrom(this.dailyChallenge.validateWord(word));
    this.submitting.set(false);

    if (!validation.success || !validation.data?.valid) {
      this.toast.show('Palabra no válida en el diccionario español', 'error');
      this.flashWordError();
      return;
    }

    this.words.update((words) => [...words, word]);
    this.toast.show('¡Palabra válida!', 'success');
    this.wordControl.setValue('');
  }

  protected async end(): Promise<void> {
    this.isActive.set(false);
    this.clearTimer();

    if (this.words().length < MIN_WORDS) {
      this.toast.show(`Necesitas al menos ${MIN_WORDS} palabras para completar el reto`, 'error');
      return;
    }

    const result = await firstValueFrom(this.dailyChallenge.complete(this.words()));
    if (result.success && result.data) {
      this.toast.show(result.data.message, 'success');
      this.isCompleted.set(true);
    } else {
      this.toast.show(result.message ?? 'Error completando el reto', 'error');
    }
  }

  protected wordDelay(index: number): number {
    return Math.min(index, 24) * 25;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private flashWordError(): void {
    this.shakeWord.set(false);
    setTimeout(() => {
      this.shakeWord.set(true);
      setTimeout(() => this.shakeWord.set(false), 900);
    });
  }
}
