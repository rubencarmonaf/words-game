import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Results } from './results';
import { Game } from '../core/services/game';
import { Socket } from '../core/services/socket';
import { FakeSocket } from '../core/services/socket.testing';

describe('Results', () => {
  let fixture: ComponentFixture<Results>;
  let component: Results;
  let game: Game;
  let httpMock: HttpTestingController;
  let navigated: string[];
  let socket: FakeSocket;

  beforeEach(() => {
    // jsdom doesn't implement matchMedia; stub it as "no reduced-motion preference".
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  async function setup(): Promise<void> {
    navigated = [];
    await TestBed.configureTestingModule({
      imports: [Results],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Socket, useClass: FakeSocket },
      ],
    }).compileComponents();

    game = TestBed.inject(Game);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
    httpMock = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url: unknown) => {
      navigated.push(url as string);
      return Promise.resolve(true);
    });
  }

  async function finishSoloGame(word: string): Promise<void> {
    game.setMode('solo');
    const startPromise = game.start({ prefix: 'de', players: ['Jugador 1'], playerCount: 1 });
    httpMock.expectOne('/api/clear-cache').flush({ success: true });
    await startPromise;

    const submitPromise = game.submitWord(word);
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await submitPromise;

    game.end();
  }

  it('redirects to /menu when there is no outcome yet', async () => {
    await setup();
    fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(navigated).toEqual(['/menu']);
  });

  it('shows the solo result with the total word count', async () => {
    await setup();
    await finishSoloGame('decir');

    fixture = TestBed.createComponent(Results);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(navigated).toEqual([]);
    expect(component['finalScore']()).toBe(1);
    expect(component['won']()).toBe(true);
  });

  it('reveals the flap digits and lights the roundel after the victory delay', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      await finishSoloGame('decir');

      fixture = TestBed.createComponent(Results);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['roundelLit']()).toBe(false);
      expect(component['revealedCount']()).toBe(0);

      vi.advanceTimersByTime(650);
      expect(component['roundelLit']()).toBe(true);

      vi.advanceTimersByTime(90 * component['digits']().length);
      expect(component['revealedCount']()).toBe(component['digits']().length);
    } finally {
      vi.useRealTimers();
    }
  });

  function endVersusGame(won: boolean, elo: { before: number; after: number; change: number } | null): void {
    game.setMode('versus');
    socket.push('gameEnd', {
      winner: won ? 'Yo' : 'Rival',
      finalScores: [
        { username: won ? 'Yo' : 'Rival', score: 2 },
        { username: won ? 'Rival' : 'Yo', score: 0 },
      ],
      won,
      elo,
    });
  }

  it('animates the ELO up to the new value for a versus winner', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      endVersusGame(true, { before: 1200, after: 1205, change: 5 });

      fixture = TestBed.createComponent(Results);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ww-elo')?.classList.contains('ww-elo--up')).toBe(true);
      expect(component['displayedElo']()).toBe(1200);
      expect(component['eloShown']()).toBe(false);

      vi.advanceTimersByTime(1700 + 1100);
      fixture.detectChanges();

      expect(component['eloShown']()).toBe(true);
      expect(component['displayedElo']()).toBe(1205);
      expect(el.querySelector('.ww-elo-delta')?.textContent).toContain('+5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('swaps the emblem and announces the new rank when the ELO crosses a tier boundary', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      endVersusGame(true, { before: 495, after: 525, change: 30 });

      fixture = TestBed.createComponent(Results);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ww-elo-emblem img')?.getAttribute('src')).toBe('/assets/ranks/aprendiz.png');
      expect(el.querySelector('.ww-elo-rankchange')).toBeFalsy();

      vi.advanceTimersByTime(1700 + 1100);
      fixture.detectChanges();

      expect(el.querySelector('.ww-elo-emblem img')?.getAttribute('src')).toBe('/assets/ranks/aficionado.png');
      expect(el.querySelector('.ww-elo-rankchange--up')?.textContent).toContain('Subes a Aficionado');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the emblem but no rank-change message when the tier stays the same', async () => {
    await setup();
    endVersusGame(false, { before: 1200, after: 1140, change: -60 });

    fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ww-elo-emblem img')?.getAttribute('src')).toBe('/assets/ranks/experto.png');
    expect(fixture.nativeElement.querySelector('.ww-elo-rankchange')).toBeFalsy();
  });

  it('animates the ELO down for a versus loser', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      endVersusGame(false, { before: 1200, after: 1140, change: -60 });

      fixture = TestBed.createComponent(Results);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ww-elo')?.classList.contains('ww-elo--down')).toBe(true);

      vi.advanceTimersByTime(500 + 1100);
      fixture.detectChanges();

      expect(component['displayedElo']()).toBe(1140);
      expect(el.querySelector('.ww-elo-delta')?.textContent).toContain('\u221260');
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains a zero change for a loser who is already at the 0 ELO floor', async () => {
    await setup();
    endVersusGame(false, { before: 0, after: 0, change: 0 });

    fixture = TestBed.createComponent(Results);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ww-elo-note')?.textContent).toContain('mínimo');
    expect(fixture.nativeElement.querySelector('.ww-elo')?.classList.contains('ww-elo--flat')).toBe(true);
  });

  it('shows no ELO panel outside versus', async () => {
    await setup();
    await finishSoloGame('decir');

    fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ww-elo')).toBeFalsy();
  });

  it('playAgain() resets the game and navigates back to setup for the same mode', async () => {
    await setup();
    await finishSoloGame('decir');

    fixture = TestBed.createComponent(Results);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component['playAgain']();

    expect(navigated).toContain('/play/setup/solo');
    expect(game.status()).toBe('setup');
  });
});
