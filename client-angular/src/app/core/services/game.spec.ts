import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Game } from './game';
import { Socket } from './socket';
import { FakeSocket } from './socket.testing';
import { Toast } from '../../shared/services/toast';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

describe('Game', () => {
  let service: Game;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('authToken');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Socket, useClass: FakeSocket },
      ],
    });
    service = TestBed.inject(Game);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function start(mode: 'solo' | 'cadena' | 'friendly', players: string[], playerCount = players.length): Promise<void> {
    service.setMode(mode);
    const promise = service.start({ prefix: 'de', players, playerCount });
    httpMock.expectOne('/api/clear-cache').flush({ success: true });
    await promise;
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('start() for solo mode sets the prefix, an unlimited timer and no words', async () => {
    await start('solo', ['Jugador 1']);

    expect(service.status()).toBe('active');
    expect(service.prefix()).toBe('de');
    expect(service.timeRemaining()).toBe(-1);
    expect(service.words()).toEqual([]);
  });

  it('start() for cadena mode generates generic players from playerCount, ignoring names', async () => {
    await start('cadena', ['Ignored'], 3);

    expect(service.players().map((p) => p.username)).toEqual(['Jugador 1', 'Jugador 2', 'Jugador 3']);
    expect(service.timeRemaining()).toBe(60);
  });

  it('start() for friendly mode uses the given player names', async () => {
    await start('friendly', ['Ana', 'Beto']);

    expect(service.players().map((p) => p.username)).toEqual(['Ana', 'Beto']);
    expect(service.timeRemaining()).toBe(60);
  });

  it('submitWord() rejects a word that does not start with the prefix', async () => {
    await start('solo', ['Jugador 1']);
    const result = await service.submitWord('albergue');
    expect(result).toEqual({ success: false, message: 'La palabra debe empezar con "de"' });
  });

  it('submitWord() rejects a word already used, without hitting the network', async () => {
    await start('solo', ['Jugador 1']);
    const first = service.submitWord('decir');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await first;

    const second = await service.submitWord('decir');
    expect(second).toEqual({ success: false, message: 'Ya has usado esta palabra' });
  });

  it('submitWord() ignores accents when checking the prefix', async () => {
    service.setMode('solo');
    const promise = service.start({ prefix: 'ín', players: ['Jugador 1'], playerCount: 1 });
    httpMock.expectOne('/api/clear-cache').flush({ success: true });
    await promise;

    const result = service.submitWord('invierno');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    expect(await result).toEqual({ success: true, message: '¡"invierno" agregada!' });
  });

  it('submitWord() ignores accents when checking for a repeated word', async () => {
    await start('solo', ['Jugador 1']);
    const first = service.submitWord('detrás');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await first;

    const second = await service.submitWord('detras');
    expect(second).toEqual({ success: false, message: 'Ya has usado esta palabra' });
  });

  it('submitWord() rejects a word the dictionary marks invalid', async () => {
    await start('solo', ['Jugador 1']);
    const promise = service.submitWord('dexyz');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: false } });
    const result = await promise;

    expect(result).toEqual({ success: false, message: 'Palabra no válida en el diccionario español' });
    expect(service.words()).toEqual([]);
  });

  it('submitWord() adds a valid word and credits the local player', async () => {
    await start('friendly', ['Ana', 'Beto']);
    const promise = service.submitWord('decir');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    const result = await promise;

    expect(result.success).toBe(true);
    expect(service.words()).toEqual(['decir']);
    expect(service.players()[0]).toEqual({ id: 'player-0', username: 'Ana', words: ['decir'], score: 1 });
    expect(service.players()[1].score).toBe(0);
  });

  it('end() for solo mode always reports a win with the total word count', async () => {
    await start('solo', ['Jugador 1']);
    const promise = service.submitWord('decir');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await promise;

    const outcome = service.end();
    expect(outcome).toEqual({ results: { type: 'solo', totalWords: 1 }, won: true });
    expect(service.status()).toBe('finished');
  });

  it('end() for multiplayer modes sorts players by score and reports whether the local player won', async () => {
    await start('friendly', ['Ana', 'Beto']);
    const promise = service.submitWord('decir');
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await promise;

    const outcome = service.end();
    expect(outcome.won).toBe(true);
    expect(outcome.results).toEqual({
      type: 'multiplayer',
      players: [
        { id: 'player-0', username: 'Ana', words: ['decir'], score: 1 },
        { id: 'player-1', username: 'Beto', words: [], score: 0 },
      ],
      winner: 'Ana',
    });
  });

  it('reset() clears the game state back to setup', async () => {
    await start('solo', ['Jugador 1']);
    service.end();
    service.reset();

    expect(service.status()).toBe('setup');
    expect(service.prefix()).toBe('');
    expect(service.players()).toEqual([]);
    expect(service.words()).toEqual([]);
    expect(service.outcome()).toBeNull();
  });

  describe('versus mode', () => {
    let socket: FakeSocket;
    let toast: Toast;

    beforeEach(() => {
      socket = TestBed.inject(Socket) as unknown as FakeSocket;
      toast = TestBed.inject(Toast);
    });

    /** Auth reads its token from localStorage once, at construction — set it and
     * rebuild the injector so the fresh Auth/Game pair actually picks it up. */
    function useServiceAuthenticatedAs(userId: string): void {
      localStorage.setItem('authToken', fakeToken(userId));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: Socket, useClass: FakeSocket },
        ],
      });
      service = TestBed.inject(Game);
      httpMock = TestBed.inject(HttpTestingController);
      socket = TestBed.inject(Socket) as unknown as FakeSocket;
      toast = TestBed.inject(Toast);
    }

    it('startMatchmaking() sets mode/status and connects the socket', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'Buscando partida...' });

      expect(service.mode()).toBe('versus');
      expect(service.status()).toBe('matchmaking');
      expect(socket.connected).toBe(true);
    });

    it('matchFound sets the gameId and exposes the VS-screen info (rival, ELO at stake)', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'Buscando partida...' });

      const me = { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 1200 };
      const rival = { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 0 };
      socket.push('matchFound', { gameId: 'g1', opponent: 'Rival', me, rival, eloIfWin: 5, eloIfLose: -60 });

      expect(service.gameId()).toBe('g1');
      expect(service.matchInfo()).toEqual({ gameId: 'g1', me, rival, eloIfWin: 5, eloIfLose: -60 });
    });

    it('the previous opponent does not linger: gameEnd and a new search both clear matchInfo', () => {
      const info = {
        gameId: 'g1',
        opponent: 'Rival',
        me: { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 10 },
        rival: { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 10 },
        eloIfWin: 30,
        eloIfLose: -30,
      };
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('matchFound', info);
      expect(service.matchInfo()).not.toBeNull();

      socket.push('gameEnd', { winner: null, finalScores: [], won: false, elo: null });
      expect(service.matchInfo()).toBeNull();

      // "Nuevo Juego" desde resultados no llama a reset(): una segunda búsqueda
      // empieza limpia aunque matchInfo se hubiese quedado sin borrar.
      socket.push('matchFound', info);
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      expect(service.matchInfo()).toBeNull();
    });

    it('gameEnd carries the server-decided ELO change into the outcome', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      socket.push('gameEnd', {
        winner: 'Yo',
        finalScores: [{ username: 'Yo', score: 2 }, { username: 'Rival', score: 0 }],
        won: true,
        elo: { before: 1200, after: 1205, change: 5 },
      });

      expect(service.outcome()?.elo).toEqual({ before: 1200, after: 1205, change: 5 });
    });

    it('gameStart moves to active with the server-provided prefix and players', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'Buscando partida...' });

      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        players: [
          { userId: 'u1', username: 'Yo' },
          { userId: 'u2', username: 'Rival' },
        ],
      });

      expect(service.status()).toBe('active');
      expect(service.prefix()).toBe('con');
      expect(service.timeRemaining()).toBe(120);
      expect(service.players().map((p) => p.username)).toEqual(['Yo', 'Rival']);
    });

    it('submitWord() emits over the socket and resolves once wordSubmitted echoes back for the local player', async () => {
      useServiceAuthenticatedAs('u1');
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        players: [
          { userId: 'u1', username: 'Yo' },
          { userId: 'u2', username: 'Rival' },
        ],
      });

      const promise = service.submitWord('contar');
      expect(socket.emitted).toContainEqual({ event: 'submitWord', data: { gameId: 'g1', word: 'contar' } });

      socket.push('wordSubmitted', { word: 'contar', playerId: 'u1', score: 1 });
      const result = await promise;

      expect(result).toEqual({ success: true, message: '¡"contar" agregada!' });
      expect(service.words()).toEqual(['contar']);
      expect(service.players()[0].score).toBe(1);
    });

    it('an opponent word only updates the opponent score: no word, no notice, nothing resolved locally', () => {
      useServiceAuthenticatedAs('u1');
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        players: [
          { userId: 'u1', username: 'Yo' },
          { userId: 'u2', username: 'Rival' },
        ],
      });

      // El servidor no manda la palabra del rival, solo su marcador
      socket.push('wordSubmitted', { playerId: 'u2', score: 1 });

      expect(service.opponentScore()).toBe(1);
      expect(service.words()).toEqual([]);
      expect(service.players().find((p) => p.userId === 'u2')?.words).toEqual([]);
      expect(toast.messages()).toEqual([]);
    });

    it('submitWord() rejects when the server sends wordRejected', async () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        players: [{ userId: 'u1', username: 'Yo' }],
      });

      const promise = service.submitWord('contable');
      socket.push('wordRejected', { message: 'Ya se ha usado esta palabra' });

      expect(await promise).toEqual({ success: false, message: 'Ya se ha usado esta palabra' });
    });

    it('forfeit() emits forfeitGame with the current gameId', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('gameStart', { gameId: 'g1', prefix: 'con', players: [] });

      service.forfeit();

      expect(socket.emitted).toContainEqual({ event: 'forfeitGame', data: { gameId: 'g1' } });
    });

    it('forfeit() does nothing outside of an active versus game', () => {
      service.forfeit();
      expect(socket.emitted.some((e) => e.event === 'forfeitGame')).toBe(false);
    });

    it('gameEnd sets the outcome from the server-authoritative final scores', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        players: [
          { userId: 'u1', username: 'Yo' },
          { userId: 'u2', username: 'Rival' },
        ],
      });

      socket.push('gameEnd', {
        winner: 'Rival',
        finalScores: [
          { username: 'Rival', score: 3 },
          { username: 'Yo', score: 1 },
        ],
        won: false,
      });

      expect(service.status()).toBe('finished');
      expect(service.outcome()).toEqual({
        results: {
          type: 'multiplayer',
          players: [
            { id: 'player-0', username: 'Rival', score: 3, words: [] },
            { id: 'player-1', username: 'Yo', score: 1, words: [] },
          ],
          winner: 'Rival',
        },
        won: false,
        elo: null,
      });
    });

    it('matchCancelled goes back to searching: clears the rival and asks to be queued again', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      const me = { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 10 };
      const rival = { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 20 };
      socket.push('matchFound', { gameId: 'g1', opponent: 'Rival', me, rival, eloIfWin: 5, eloIfLose: -5 });
      expect(service.matchInfo()).not.toBeNull();

      socket.push('matchCancelled', undefined);

      expect(service.matchInfo()).toBeNull();
      expect(service.status()).toBe('matchmaking');
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
    });

    it('matchCancelled is ignored when we are not searching any more', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
      service.cancelMatchmaking();
      httpMock.expectOne('/api/matchmaking/leave').flush({ success: true });

      socket.push('matchCancelled', undefined);

      httpMock.expectNone('/api/matchmaking/join');
    });

    it('a resumed gameStart restores the words, the scores and the remaining time', () => {
      useServiceAuthenticatedAs('u1');
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      socket.push('gameStart', {
        gameId: 'g1',
        prefix: 'con',
        gameType: 'versus',
        resumed: true,
        remainingSeconds: 37,
        players: [
          { userId: 'u1', username: 'Yo', words: ['cosa', 'cono'], score: 2 },
          { userId: 'u2', username: 'Rival', words: ['corte'], score: 1 },
        ],
      });

      expect(service.status()).toBe('active');
      expect(service.timeRemaining()).toBe(37);
      expect(service.words()).toEqual(['cosa', 'cono']);
      expect(service.opponentScore()).toBe(1);
    });

    it('asks the server to resync when the game does not start after the VS screen, and stops once it does', () => {
      vi.useFakeTimers();
      try {
        service.startMatchmaking().subscribe();
        httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
        const me = { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 10 };
        const rival = { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 20 };
        socket.push('matchFound', { gameId: 'g1', opponent: 'Rival', me, rival, eloIfWin: 5, eloIfLose: -5 });
        const resyncs = (): number => socket.emitted.filter((e) => e.event === 'game:resync').length;

        vi.advanceTimersByTime(7_000);
        expect(resyncs()).toBe(0);
        vi.advanceTimersByTime(1_500);
        expect(resyncs()).toBe(1);
        vi.advanceTimersByTime(2_000);
        expect(resyncs()).toBe(2);

        socket.push('gameStart', { gameId: 'g1', prefix: 'con', players: [] });
        vi.advanceTimersByTime(10_000);
        expect(resyncs()).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('the versus timer freezes at zero instead of ending the game locally', () => {
      vi.useFakeTimers();
      try {
        service.startMatchmaking().subscribe();
        httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
        socket.push('gameStart', { gameId: 'g1', prefix: 'con', players: [] });

        vi.advanceTimersByTime(300_000);

        expect(service.timeRemaining()).toBe(0);
        expect(service.status()).toBe('active');
        expect(service.outcome()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancelMatchmaking() leaves the queue and resets to setup', () => {
      service.startMatchmaking().subscribe();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      service.cancelMatchmaking();
      httpMock.expectOne('/api/matchmaking/leave').flush({ success: true });

      expect(service.status()).toBe('setup');
      expect(service.gameId()).toBeNull();
    });
  });
});
