import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Game as GameFeature } from './game';
import { Game as GameService } from '../core/services/game';

describe('Game feature', () => {
  let fixture: ComponentFixture<GameFeature>;
  let component: GameFeature;
  let gameService: GameService;
  let httpMock: HttpTestingController;
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
      ],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    httpMock = TestBed.inject(HttpTestingController);
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

  it('flashes the input and leaves it untouched when a word is rejected', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['wordControl'].setValue('xyz');
    await component['submit']();

    expect(gameService.words()).toEqual([]);
    expect(component['wordControl'].value).toBe('xyz');
  });

  it('endGame() ends the round and navigates to results', async () => {
    await setup();
    await startSoloGame();

    fixture = TestBed.createComponent(GameFeature);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['endGame']();

    expect(navigated).toEqual(['/play/results']);
    expect(gameService.status()).toBe('finished');
  });
});
