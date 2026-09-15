import { Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, of } from 'rxjs';
import type { ApiResponse, WordValidationResponse } from '@shared-types';

export type GameMode = 'solo' | 'cadena' | 'friendly';
export type GameStatus = 'setup' | 'active' | 'finished';

export interface GamePlayer {
  id: string;
  username: string;
  words: string[];
  score: number;
}

export interface GameSetupConfig {
  prefix: string;
  players: string[];
  playerCount: number;
}

export interface SoloResults {
  type: 'solo';
  totalWords: number;
}

export interface MultiplayerResults {
  type: 'multiplayer';
  players: GamePlayer[];
}

export type GameResults = SoloResults | MultiplayerResults;

export interface GameOutcome {
  results: GameResults;
  won: boolean;
}

export interface WordSubmitResult {
  success: boolean;
  message?: string;
}

/** Estado y reglas de las partidas locales (solo/cadena/amigos). Ported from
 * client/game/WordGame.ts — la validación contra el diccionario sigue siendo
 * server-side, pero el arbitraje (turno, cronómetro, resultado) es local. */
@Service()
export class Game {
  private readonly http = inject(HttpClient);

  private readonly modeSignal = signal<GameMode>('solo');
  private readonly statusSignal = signal<GameStatus>('setup');
  private readonly prefixSignal = signal('');
  private readonly playersSignal = signal<GamePlayer[]>([]);
  private readonly wordsSignal = signal<string[]>([]);
  private readonly timeRemainingSignal = signal(0);
  private readonly outcomeSignal = signal<GameOutcome | null>(null);

  readonly mode = this.modeSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly prefix = this.prefixSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();
  readonly words = this.wordsSignal.asReadonly();
  readonly timeRemaining = this.timeRemainingSignal.asReadonly();
  readonly outcome = this.outcomeSignal.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;

  setMode(mode: GameMode): void {
    this.modeSignal.set(mode);
  }

  async start(config: GameSetupConfig): Promise<void> {
    this.prefixSignal.set(config.prefix);

    if (this.modeSignal() === 'cadena') {
      this.playersSignal.set(
        Array.from({ length: config.playerCount }, (_, i) => ({
          id: `player-${i}`,
          username: `Jugador ${i + 1}`,
          words: [],
          score: 0,
        })),
      );
    } else {
      this.playersSignal.set(
        config.players.map((username, i) => ({ id: `player-${i}`, username, words: [], score: 0 })),
      );
    }

    await this.clearDictionaryCache();

    this.wordsSignal.set([]);
    this.outcomeSignal.set(null);
    this.statusSignal.set('active');
    this.startTimer();
  }

  async submitWord(word: string): Promise<WordSubmitResult> {
    const trimmed = word.trim();
    const normalized = trimmed.toLowerCase();
    if (!normalized) return { success: false };

    if (!normalized.startsWith(this.prefixSignal().toLowerCase())) {
      return { success: false, message: `La palabra debe empezar con "${this.prefixSignal()}"` };
    }
    if (this.wordsSignal().includes(normalized)) {
      return { success: false, message: 'Ya has usado esta palabra' };
    }

    const validation = await firstValueFrom(this.validateWord(normalized));
    if (!validation.success || !validation.data?.valid) {
      return { success: false, message: 'Palabra no válida en el diccionario español' };
    }

    this.wordsSignal.update((words) => [...words, normalized]);
    this.playersSignal.update((players) => {
      if (players.length === 0) return players;
      const [first, ...rest] = players;
      return [{ ...first, words: [...first.words, normalized], score: first.score + 1 }, ...rest];
    });

    return { success: true, message: `¡"${trimmed}" agregada!` };
  }

  end(): GameOutcome {
    this.clearTimer();
    this.statusSignal.set('finished');

    const outcome: GameOutcome =
      this.modeSignal() === 'solo'
        ? { results: { type: 'solo', totalWords: this.wordsSignal().length }, won: true }
        : this.buildMultiplayerOutcome();

    this.outcomeSignal.set(outcome);
    return outcome;
  }

  reset(): void {
    this.clearTimer();
    this.statusSignal.set('setup');
    this.prefixSignal.set('');
    this.playersSignal.set([]);
    this.wordsSignal.set([]);
    this.timeRemainingSignal.set(0);
    this.outcomeSignal.set(null);
  }

  private buildMultiplayerOutcome(): GameOutcome {
    const localPlayer = this.playersSignal()[0];
    const sorted = [...this.playersSignal()].sort((a, b) => b.score - a.score);
    return { results: { type: 'multiplayer', players: sorted }, won: sorted[0] === localPlayer };
  }

  private startTimer(): void {
    if (this.modeSignal() === 'solo') {
      this.timeRemainingSignal.set(-1);
      return;
    }

    this.timeRemainingSignal.set(60);
    this.timer = setInterval(() => {
      this.timeRemainingSignal.update((t) => t - 1);
      if (this.timeRemainingSignal() <= 0) {
        this.end();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private validateWord(word: string): Observable<ApiResponse<WordValidationResponse>> {
    return this.http
      .post<ApiResponse<WordValidationResponse>>('/api/validate-word', { word })
      .pipe(
        catchError((err: HttpErrorResponse) => of(this.toApiError<WordValidationResponse>(err))),
      );
  }

  private async clearDictionaryCache(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/clear-cache', {}));
    } catch {
      // Un fallo limpiando la caché no debe impedir empezar la partida.
    }
  }

  private toApiError<T>(err: HttpErrorResponse): ApiResponse<T> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
