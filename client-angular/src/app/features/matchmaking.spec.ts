import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { DEFAULT_AVATAR } from '@shared-types';
import { Matchmaking } from './matchmaking';
import { Game } from '../core/services/game';
import { Socket } from '../core/services/socket';
import { FakeSocket } from '../core/services/socket.testing';
import { Toast } from '../shared/services/toast';

describe('Matchmaking', () => {
  let fixture: ComponentFixture<Matchmaking>;
  let component: Matchmaking;
  let httpMock: HttpTestingController;
  let game: Game;
  let socket: FakeSocket;
  let toast: Toast;
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
      imports: [Matchmaking],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        { provide: Socket, useClass: FakeSocket },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    game = TestBed.inject(Game);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
    toast = TestBed.inject(Toast);
  }

  it('should create and join matchmaking on init', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'Buscando partida...' });

    expect(component).toBeTruthy();
    expect(game.mode()).toBe('versus');
    expect(game.status()).toBe('matchmaking');
  });

  it('shows a toast and returns to /menu when joining fails', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    fixture.detectChanges();

    httpMock.expectOne('/api/matchmaking/join').flush({ success: false, message: 'Cola llena' });
    await fixture.whenStable();

    expect(toast.messages()[0]?.text).toBe('Cola llena');
    expect(navigated).toEqual(['/menu']);
  });

  it('cancel() leaves the queue and returns to /menu', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
    component['cancel']();
    httpMock.expectOne('/api/matchmaking/leave').flush({ success: true });

    expect(navigated).toEqual(['/menu']);
    expect(game.status()).toBe('setup');
  });

  it('navigates to /play/game once a match starts', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    fixture.detectChanges();

    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });
    socket.push('gameStart', { gameId: 'g1', prefix: 'con', players: [] });
    await fixture.whenStable();

    expect(navigated).toEqual(['/play/game']);
  });

  it('shows the VS screen with both players and the ELO at stake once a match is found', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

    expect(fixture.nativeElement.querySelector('.ww-versus')).toBeFalsy();

    socket.push('matchFound', {
      gameId: 'g1',
      opponent: 'Rival',
      me: { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 1200 },
      rival: { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 0 },
      eloIfWin: 5,
      eloIfLose: -60,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const names = Array.from(el.querySelectorAll('.ww-versus-name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['Yo', 'Rival']);
    expect(el.querySelectorAll('.ww-versus ww-avatar').length).toBe(2);
    const emblems = Array.from(el.querySelectorAll('.ww-versus ww-rank-emblem img')).map((i) => i.getAttribute('src'));
    expect(emblems).toEqual(['/assets/ranks/experto.png', '/assets/ranks/aprendiz.png']);
    const tiers = Array.from(el.querySelectorAll('.ww-versus ww-tier-badge')).map((t) => t.textContent?.trim());
    expect(tiers).toEqual(['Experto', 'Aprendiz']);
    expect(el.querySelector('.ww-versus-stake--win')?.textContent).toContain('+5');
    expect(el.querySelector('.ww-versus-stake--lose')?.textContent).toContain('\u221260');
    expect(el.querySelector('.matchmaking-content')).toBeFalsy();
  });

  it('formats a zero loss (a player already at 0 ELO) without a sign', async () => {
    await setup();
    fixture = TestBed.createComponent(Matchmaking);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

    expect(component['formatDelta'](0)).toBe('0');
    expect(component['formatDelta'](5)).toBe('+5');
    expect(component['formatDelta'](-60)).toBe('\u221260');
  });

  it('counts down the VS intro until the server starts the game', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      fixture = TestBed.createComponent(Matchmaking);
      component = fixture.componentInstance;
      fixture.detectChanges();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      socket.push('matchFound', {
        gameId: 'g1',
        opponent: 'Rival',
        me: { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 10 },
        rival: { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 10 },
        eloIfWin: 30,
        eloIfLose: -30,
      });
      fixture.detectChanges();
      expect(component['countdown']()).toBe(5);

      vi.advanceTimersByTime(2000);
      expect(component['countdown']()).toBe(3);

      vi.advanceTimersByTime(10000);
      expect(component['countdown']()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second search starts with a fresh VS countdown, not the previous one', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      fixture = TestBed.createComponent(Matchmaking);
      component = fixture.componentInstance;
      fixture.detectChanges();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      const payload = (gameId: string) => ({
        gameId,
        opponent: 'Rival',
        me: { username: 'Yo', avatar: DEFAULT_AVATAR, elo: 10 },
        rival: { username: 'Rival', avatar: DEFAULT_AVATAR, elo: 10 },
        eloIfWin: 30,
        eloIfLose: -30,
      });
      socket.push('matchFound', payload('g1'));
      fixture.detectChanges();
      vi.advanceTimersByTime(3000);
      expect(component['countdown']()).toBe(2);

      socket.push('matchFound', payload('g2'));
      fixture.detectChanges();
      expect(component['countdown']()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cycles through the searching phrases while waiting', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      fixture = TestBed.createComponent(Matchmaking);
      component = fixture.componentInstance;
      fixture.detectChanges();
      httpMock.expectOne('/api/matchmaking/join').flush({ success: true, message: 'ok' });

      expect(component['phraseIndex']()).toBe(0);

      vi.advanceTimersByTime(2600);
      expect(component['fadingOut']()).toBe(true);

      vi.advanceTimersByTime(200);
      expect(component['fadingOut']()).toBe(false);
      expect(component['phraseIndex']()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
