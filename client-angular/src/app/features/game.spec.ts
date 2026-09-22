import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Game as GameFeature } from './game';
import { Game as GameService } from '../core/services/game';
import { Socket } from '../core/services/socket';
import { FakeSocket } from '../core/services/socket.testing';

describe('Game feature', () => {
  let fixture: ComponentFixture<GameFeature>;
  let component: GameFeature;
  let gameService: GameService;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;
  let navigated: string[];

  const routerStub = {
    navigateByUrl: (url: string) => {
      navigated.push(url);
      return Promise.resolve(true);
    },
  };

  async function setup(): Promise<void> {
    navigated = [];
    await TestBed.configureTestingModule({
      imports: [GameFeature],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        { provide: Socket, useClass: FakeSocket },
      ],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
  }

  async function startSoloGame(): Promise<void> {
    gameService.setMode('solo');
    const startPromise = gameService.start({ prefix: 'de', players: ['Jugador 1'], playerCount: 1 });
    httpMock.expectOne('/api/clear-cache').flush({ success: true });
    await startPromise;
  }

  it('redirects to /menu when the game is not active', async () => {
    await setup();
    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(navigated).toEqual(['/menu']);
  });

  it('shows the prefix, word count and unlimited timer for an active solo game', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(navigated).toEqual([]);
    expect(component['prefixDisplay']()).toBe('DE');
    expect(component['timerDisplay']()).toBe('∞');
  });

  it('submits a valid word and clears the input', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['wordControl'].setValue('decir');
    const submitPromise = component['submit']();
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await submitPromise;

    expect(gameService.words()).toEqual(['decir']);
    expect(component['wordControl'].value).toBe('');
  });

  it('flashes and clears the input when a word is rejected', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['wordControl'].setValue('xyz');
    await component['submit']();

    expect(gameService.words()).toEqual([]);
    expect(component['wordControl'].value).toBe('');
  });

  it('endGame() ends the round and navigates to results', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['endGame']();
    await fixture.whenStable();

    expect(navigated).toEqual(['/play/results']);
    expect(gameService.status()).toBe('finished');
  });

  async function startVersusGame(): Promise<void> {
    gameService.startMatchmaking().subscribe();
    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
    socket.push('gameStart', {
      gameId: 'g1',
      prefix: 'con',
      players: [
        { userId: 'u1', username: 'Yo' },
        { userId: 'u2', username: 'Rival' },
      ],
    });
  }

  it('shows the opponent score only in versus mode', async () => {
    await setup();
    await startVersusGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['isVersus']()).toBe(true);
    expect(component['opponentScoreDisplay']()).toBe('Rival: 0');
  });

  it('hides "Terminar Juego" in a versus match: only the clock (or the server) ends it', async () => {
    await setup();
    await startVersusGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['canEndEarly']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.game-controls')).toBeFalsy();
  });

  it('navigates to results once the server-driven gameEnd arrives', async () => {
    await setup();
    await startVersusGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    socket.push('gameEnd', {
      winner: 'Rival',
      finalScores: [
        { username: 'Rival', score: 3 },
        { username: 'Yo', score: 1 },
      ],
      won: false,
    });
    await fixture.whenStable();

    expect(navigated).toEqual(['/play/results']);
  });

  it('shows "Terminar Juego" in solo, a local mode where ending early only affects the player', async () => {
    await setup();
    await startSoloGame();
    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component['canEndEarly']()).toBe(true);
    expect(fixture.nativeElement.querySelector('.game-controls')).toBeTruthy();
  });

  it('hides "Terminar Juego" in a lobby match, since any player forfeiting would end it for everyone else for free', async () => {
    await setup();
    gameService.setMode('lobby');
    socket.push('gameStart', {
      gameId: 'g1',
      prefix: 'con',
      players: [
        { userId: 'u1', username: 'Yo' },
        { userId: 'u2', username: 'Ana' },
        { userId: 'u3', username: 'Beto' },
      ],
    });

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['canEndEarly']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.game-controls')).toBeFalsy();
  });
});
