import { Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, of } from 'rxjs';
import type { ApiResponse, AvatarOptions, WordValidationResponse } from '@shared-types';
import { Auth } from './auth';
import { Socket } from './socket';
import { Toast } from '../../shared/services/toast';

// 'friendly' is a local hotseat game (custom player names, same device, no
// networking — see game-setup.ts's "Juego con Amigos"). 'lobby' is the real
// online multiplayer started from a Lobby (server-authoritative, like versus
// but N players and no ELO) — two different things, do not conflate them.
export type GameMode = 'solo' | 'cadena' | 'friendly' | 'lobby' | 'versus';
export type GameStatus = 'setup' | 'matchmaking' | 'active' | 'finished';

export interface GamePlayer {
  id: string;
  username: string;
  words: string[];
  score: number;
  userId?: string;
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
  /** Username of the actual winner, or null on a draw. Authoritative — never
   * infer the winner from sort position, ties (or a forfeit leaving the
   * forfeiter's score untouched) make the top-scored entry unreliable. */
  winner: string | null;
}

export type GameResults = SoloResults | MultiplayerResults;

/** ELO de una partida versus, tal y como lo decidió el servidor. */
export interface EloResult {
  before: number;
  after: number;
  change: number;
}

export interface GameOutcome {
  results: GameResults;
  won: boolean;
  /** Solo en versus; null/ausente en el resto de modos. */
  elo?: EloResult | null;
}

export interface WordSubmitResult {
  success: boolean;
  message?: string;
}

export interface VersusPlayerInfo {
  username: string;
  avatar: AvatarOptions;
  elo: number;
}

/** Datos para la pantalla "VS" que se enseña entre encontrar rival y empezar. */
export interface MatchInfo {
  gameId: string;
  me: VersusPlayerInfo;
  rival: VersusPlayerInfo;
  /** Cambio de ELO propio si ganas / si pierdes (con el recorte en 0 ya aplicado). */
  eloIfWin: number;
  eloIfLose: number;
}

interface MatchFoundPayload extends MatchInfo {
  opponent: string;
}

interface GameStartPayload {
  gameId: string;
  prefix: string;
  players: { userId: string; username: string; words?: string[]; score?: number }[];
  /** Solo al reanudar una partida en curso (reconexión o petición de resincronizar). */
  resumed?: boolean;
  gameType?: 'versus' | 'lobby';
  remainingSeconds?: number;
  me?: string;
}

interface WordSubmittedPayload {
  word: string;
  playerId: string;
  score: number;
}

interface WordRejectedPayload {
  message: string;
}

interface GameEndPayload {
  winner: string | null;
  finalScores: { username: string; score: number }[];
  won: boolean;
  elo?: EloResult | null;
}

// Debe coincidir con VERSUS_DURATION_MS en server.ts — igual que el lobby,
// el servidor decide de verdad cuándo acaba; esto solo pinta el contador.
const VERSUS_DURATION_SECONDS = 120;
const LOCAL_MULTIPLAYER_DURATION_SECONDS = 60;
// Debe coincidir con LOBBY_DURATION_MS en server.ts — el servidor es quien
// realmente decide cuándo termina, esto solo pinta el contador visible.
const LOBBY_DURATION_SECONDS = 120;
// La pantalla VS dura VERSUS_INTRO_MS (5 s) en el servidor. Pasado este tiempo sin que
// llegue la partida, se le pide al servidor su estado, y se repite hasta que llegue.
const RESYNC_AFTER_MS = 8000;
const RESYNC_RETRY_MS = 2000;

/** Estado y reglas de todos los modos de partida, ported from
 * client/game/WordGame.ts. Solo/cadena/amigos se arbitran localmente contra
 * la validación server-side del diccionario; versus es server-authoritative
 * de principio a fin — este servicio solo refleja los eventos de socket. */
@Service()
export class Game {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly socket = inject(Socket);
  private readonly toast = inject(Toast);

  private readonly modeSignal = signal<GameMode>('solo');
  private readonly statusSignal = signal<GameStatus>('setup');
  private readonly prefixSignal = signal('');
  private readonly playersSignal = signal<GamePlayer[]>([]);
  private readonly wordsSignal = signal<string[]>([]);
  private readonly timeRemainingSignal = signal(0);
  private readonly outcomeSignal = signal<GameOutcome | null>(null);
  private readonly gameIdSignal = signal<string | null>(null);
  private readonly opponentScoreSignal = signal(0);
  private readonly matchInfoSignal = signal<MatchInfo | null>(null);

  readonly mode = this.modeSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly prefix = this.prefixSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();
  readonly words = this.wordsSignal.asReadonly();
  readonly timeRemaining = this.timeRemainingSignal.asReadonly();
  readonly outcome = this.outcomeSignal.asReadonly();
  readonly gameId = this.gameIdSignal.asReadonly();
  readonly opponentScore = this.opponentScoreSignal.asReadonly();
  readonly matchInfo = this.matchInfoSignal.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private resyncTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSubmit: ((result: WordSubmitResult) => void) | null = null;

  constructor() {
    this.socket.on<MatchFoundPayload>('matchFound').subscribe((data) => {
      this.gameIdSignal.set(data.gameId);
      this.matchInfoSignal.set({
        gameId: data.gameId,
        me: data.me,
        rival: data.rival,
        eloIfWin: data.eloIfWin,
        eloIfLose: data.eloIfLose,
      });
      this.scheduleResync(RESYNC_AFTER_MS);
    });

    this.socket.on<GameStartPayload>('gameStart').subscribe((data) => {
      this.cancelResync();
      // Al reanudar una partida que ya estaba en marcha, el modo puede no ser el de
      // esta pantalla (p. ej. tras perder la conexión): lo fija el propio servidor.
      if (data.gameType) this.modeSignal.set(data.gameType);

      const myId = this.auth.getUserId();
      const players: GamePlayer[] = data.players.map((p) => ({
        id: p.userId,
        userId: p.userId,
        username: p.username,
        words: p.words ?? [],
        score: p.score ?? 0,
      }));

      this.gameIdSignal.set(data.gameId);
      this.prefixSignal.set(data.prefix);
      this.playersSignal.set(players);
      this.wordsSignal.set(players.find((p) => p.userId === myId)?.words ?? []);
      this.opponentScoreSignal.set(players.find((p) => p.userId !== myId)?.score ?? 0);
      this.outcomeSignal.set(null);
      this.statusSignal.set('active');
      this.startTimer(data.remainingSeconds);
    });

    // El servidor cancela el emparejamiento (el rival se desconectó, o salió durante la pantalla VS).
    // La pantalla vuelve a "buscando"; si el servidor ya nos devolvió a la cola, volver a pedirlo
    // no cambia nada, y si nuestra propia conexión se cayó, es lo que nos vuelve a meter.
    this.socket.on<void>('matchCancelled').subscribe(() => {
      this.cancelResync();
      if (this.statusSignal() !== 'matchmaking') return;
      this.matchInfoSignal.set(null);
      this.toast.show('Tu rival se desconectó. Buscando otra partida…', 'info');
      this.http.post('/api/matchmaking/join', {}).subscribe({ error: () => undefined });
    });

    this.socket.on<WordSubmittedPayload>('wordSubmitted').subscribe((data) => {
      const normalized = data.word.toLowerCase();
      this.playersSignal.update((players) =>
        players.map((p) =>
          p.userId === data.playerId ? { ...p, words: [...p.words, normalized], score: data.score } : p,
        ),
      );

      if (data.playerId === this.auth.getUserId()) {
        this.wordsSignal.update((words) => [...words, normalized]);
        this.resolvePendingSubmit({ success: true, message: `¡"${data.word}" agregada!` });
      } else {
        this.opponentScoreSignal.set(data.score);
        this.toast.show(`Tu rival añadió "${data.word}"`, 'info');
      }
    });

    this.socket.on<WordRejectedPayload>('wordRejected').subscribe((data) => {
      this.resolvePendingSubmit({ success: false, message: data.message });
    });

    this.socket.on<GameEndPayload>('gameEnd').subscribe((data) => {
      this.clearTimer();
      this.matchInfoSignal.set(null);
      this.statusSignal.set('finished');
      this.outcomeSignal.set({
        results: {
          type: 'multiplayer',
          players: data.finalScores.map((p, i) => ({ id: `player-${i}`, username: p.username, score: p.score, words: [] })),
          winner: data.winner,
        },
        won: data.won,
        elo: data.elo ?? null,
      });
    });

    this.socket.on<string>('error').subscribe((message) => this.toast.show(message, 'error'));
  }

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

  /** Une al jugador a la cola de matchmaking y conecta el socket que recibirá
   * matchFound/gameStart. La partida en sí arranca cuando el servidor empareja
   * a dos jugadores — este método solo entra en la cola. */
  startMatchmaking(): Observable<ApiResponse<{ message: string }>> {
    // Al volver desde resultados con "Nuevo Juego" no pasa por reset(), así
    // que el rival de la partida anterior seguiría pintándose en la pantalla VS.
    this.matchInfoSignal.set(null);
    this.modeSignal.set('versus');
    this.statusSignal.set('matchmaking');
    this.socket.connect();

    return this.http.post<ApiResponse<{ message: string }>>('/api/matchmaking/join', {}).pipe(
      catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))),
    );
  }

  cancelMatchmaking(): void {
    this.http.post('/api/matchmaking/leave', {}).subscribe();
    this.reset();
  }

  /** Abandono voluntario de una partida versus/lobby en curso: el servidor
   * decide el resultado (derrota para quien abandona) y llega por gameEnd. */
  forfeit(): void {
    const gameId = this.gameIdSignal();
    const mode = this.modeSignal();
    if ((mode !== 'versus' && mode !== 'lobby') || !gameId) return;
    this.socket.emit('forfeitGame', { gameId });
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

    const mode = this.modeSignal();
    if (mode === 'versus' || mode === 'lobby') {
      return new Promise<WordSubmitResult>((resolve) => {
        this.pendingSubmit = resolve;
        this.socket.emit('submitWord', { gameId: this.gameIdSignal(), word: trimmed });
      });
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
    this.cancelResync();
    this.statusSignal.set('setup');
    this.prefixSignal.set('');
    this.playersSignal.set([]);
    this.wordsSignal.set([]);
    this.timeRemainingSignal.set(0);
    this.outcomeSignal.set(null);
    this.gameIdSignal.set(null);
    this.opponentScoreSignal.set(0);
    this.matchInfoSignal.set(null);
    this.pendingSubmit = null;
  }

  private resolvePendingSubmit(result: WordSubmitResult): void {
    this.pendingSubmit?.(result);
    this.pendingSubmit = null;
  }

  private buildMultiplayerOutcome(): GameOutcome {
    const localPlayer = this.playersSignal()[0];
    const sorted = [...this.playersSignal()].sort((a, b) => b.score - a.score);
    // A tie at the top is a draw, not a win for whoever happened to sort first.
    const winner = sorted.length && sorted[0].score > (sorted[1]?.score ?? -1) ? sorted[0] : null;
    return {
      results: { type: 'multiplayer', players: sorted, winner: winner?.username ?? null },
      won: winner === localPlayer,
    };
  }

  /** `initialSeconds` solo lo pasa una partida reanudada; si no, arranca con la duración completa. */
  private startTimer(initialSeconds?: number): void {
    this.clearTimer();
    const mode = this.modeSignal();
    if (mode === 'solo') {
      this.timeRemainingSignal.set(-1);
      return;
    }

    const serverAuthoritative = mode === 'versus' || mode === 'lobby';
    this.timeRemainingSignal.set(
      initialSeconds ??
        (mode === 'versus' ? VERSUS_DURATION_SECONDS : mode === 'lobby' ? LOBBY_DURATION_SECONDS : LOCAL_MULTIPLAYER_DURATION_SECONDS),
    );
    this.timer = setInterval(() => {
      this.timeRemainingSignal.update((t) => t - 1);
      if (this.timeRemainingSignal() <= 0) {
        if (serverAuthoritative) {
          // El servidor tiene su propio timeout corriendo en paralelo y decide
          // el final real; aquí solo se congela el contador visible.
          this.clearTimer();
        } else {
          this.end();
        }
      }
    }, 1000);
  }

  /** Si tras la pantalla VS la partida no llega (el gameStart se pudo perder con el
   * socket caído), se le pide al servidor su estado y se reintenta hasta que llegue. */
  private scheduleResync(delayMs: number): void {
    this.cancelResync();
    this.resyncTimer = setTimeout(() => {
      if (this.statusSignal() !== 'matchmaking' || !this.matchInfoSignal()) return;
      this.socket.connect();
      this.socket.emit('game:resync');
      this.scheduleResync(RESYNC_RETRY_MS);
    }, delayMs);
  }

  private cancelResync(): void {
    if (this.resyncTimer !== null) {
      clearTimeout(this.resyncTimer);
      this.resyncTimer = null;
    }
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
