import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Game } from './game';

describe('Game', () => {
  let service: Game;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
