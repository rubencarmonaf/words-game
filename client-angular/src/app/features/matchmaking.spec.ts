import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
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
