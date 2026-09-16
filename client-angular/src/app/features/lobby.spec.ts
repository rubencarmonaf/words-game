import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Lobby } from './lobby';
import { Socket } from '../core/services/socket';
import { FakeSocket } from '../core/services/socket.testing';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

describe('Lobby', () => {
  let component: Lobby;
  let fixture: ComponentFixture<Lobby>;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;

  async function setup(lobbyId: string | null = null): Promise<void> {
    localStorage.setItem('authToken', fakeToken('me'));

    await TestBed.configureTestingModule({
      imports: [Lobby],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Socket, useClass: FakeSocket },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => lobbyId } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Lobby);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
    fixture.detectChanges();

    httpMock.expectOne('/api/friends').flush({ success: true, data: [] });
  }

  afterEach(() => {
    localStorage.removeItem('authToken');
    httpMock.verify();
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('with no lobbyId in the route, creates a new lobby as host', async () => {
    await setup(null);
    expect(socket.emitted).toContainEqual({ event: 'lobby:create', data: undefined });
  });

  it('with a lobbyId in the route, joins that lobby instead of creating one', async () => {
    await setup('abc123');
    expect(socket.emitted).toContainEqual({ event: 'lobby:join', data: { lobbyId: 'abc123' } });
  });

  it('lobby:update populates the real player list and marks the host', async () => {
    await setup();
    socket.push('lobby:update', {
      lobbyId: 'L1',
      hostId: 'me',
      players: [{ userId: 'me', username: 'Yo' }],
      playerCount: 1,
    });
    fixture.detectChanges();

    expect(component['players']()).toEqual([{ userId: 'me', username: 'Yo' }]);
    expect(component['isHost']()).toBe(true);
  });

  it('invite() emits lobby:invite for the given friend and marks them invited', async () => {
    await setup();
    socket.push('lobby:update', { lobbyId: 'L1', hostId: 'me', players: [{ userId: 'me', username: 'Yo' }], playerCount: 1 });

    expect(component['isInvited']('Amigo1')).toBe(false);
    component['invite']('Amigo1');

    expect(socket.emitted).toContainEqual({ event: 'lobby:invite', data: { lobbyId: 'L1', friendUsername: 'Amigo1' } });
    expect(component['isInvited']('Amigo1')).toBe(true);
  });

  it('"Comenzar partida" is disabled for the host until a second player joins', async () => {
    await setup();
    socket.push('lobby:update', { lobbyId: 'L1', hostId: 'me', players: [{ userId: 'me', username: 'Yo' }], playerCount: 1 });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const startBtn = el.querySelector('.lobby-actions-section .btn-primary') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
    expect(startBtn.textContent).toContain('Esperando jugadores...');

    socket.push('lobby:update', {
      lobbyId: 'L1',
      hostId: 'me',
      players: [
        { userId: 'me', username: 'Yo' },
        { userId: 'u2', username: 'Rival' },
      ],
      playerCount: 2,
    });
    fixture.detectChanges();

    expect(startBtn.disabled).toBe(false);
    expect(startBtn.textContent).toContain('Comenzar partida');
  });

  it('leaveLobby() emits lobby:leave and navigates back to the menu', async () => {
    await setup();
    socket.push('lobby:update', { lobbyId: 'L1', hostId: 'me', players: [{ userId: 'me', username: 'Yo' }], playerCount: 1 });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    component['leaveLobby']();

    expect(socket.emitted).toContainEqual({ event: 'lobby:leave', data: { lobbyId: 'L1' } });
    expect(navigateSpy).toHaveBeenCalledWith('/menu');
  });
});
