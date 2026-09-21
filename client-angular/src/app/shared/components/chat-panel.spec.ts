import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DEFAULT_AVATAR } from '@shared-types';
import { ChatPanel } from './chat-panel';
import { Friends } from '../../core/services/friends';
import { Messages } from '../../core/services/messages';
import { Socket } from '../../core/services/socket';
import { FakeSocket } from '../../core/services/socket.testing';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

describe('ChatPanel', () => {
  let fixture: ComponentFixture<ChatPanel>;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;
  let messagesService: Messages;

  async function setup(): Promise<void> {
    localStorage.setItem('authToken', fakeToken('me'));

    await TestBed.configureTestingModule({
      imports: [ChatPanel],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Socket, useClass: FakeSocket },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPanel);
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
    messagesService = TestBed.inject(Messages);

    // ChatPanel reads friend identity (username/avatar/online) from Friends
    // by id, not from Messages — seed it the same way FriendsDock would.
    TestBed.inject(Friends).refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'f1', username: 'Ana', elo: 1000, online: true, avatar: DEFAULT_AVATAR }],
    });

    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.removeItem('authToken');
    httpMock.verify();
  });

  it('renders nothing when there is no active thread', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('.chat-panel')).toBeFalsy();
  });

  it('shows the panel with the friend username and online status once a thread opens', async () => {
    await setup();
    messagesService.openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-panel')).toBeTruthy();
    expect(el.querySelector('.chat-panel-title')?.textContent).toContain('Ana');
    expect(el.querySelector('.chat-panel-subtitle')?.textContent).toContain('En línea');
  });

  it('renders incoming and outgoing messages, aligning your own to the right', async () => {
    await setup();
    messagesService.openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    socket.push('dm:message', { id: 'm1', from: 'f1', to: 'me', text: 'hola', createdAt: '2026-01-01T00:00:00Z' });
    socket.push('dm:message', { id: 'm2', from: 'me', to: 'f1', text: 'qué tal', createdAt: '2026-01-01T00:01:00Z' });
    fixture.detectChanges();

    const bubbles = fixture.nativeElement.querySelectorAll('.chat-bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].classList.contains('mine')).toBe(false);
    expect(bubbles[1].classList.contains('mine')).toBe(true);
  });

  it('sendMessage() emits dm:send to the active thread and clears the input', async () => {
    await setup();
    messagesService.openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    fixture.componentInstance['chatControl'].setValue('hola Ana');
    fixture.componentInstance['sendMessage']();

    expect(socket.emitted).toContainEqual({ event: 'dm:send', data: { to: 'f1', text: 'hola Ana' } });
    expect(fixture.componentInstance['chatControl'].value).toBe('');
  });

  function invite(overrides: Record<string, unknown> = {}) {
    return {
      id: 'i1',
      from: 'f1',
      to: 'me',
      text: 'Ana te invitó a una partida con amigos',
      createdAt: '2026-01-01T00:00:00Z',
      kind: 'lobby-invite',
      lobbyId: 'L1',
      lobbyActive: true,
      ...overrides,
    };
  }

  async function openThreadWith(messages: unknown[]): Promise<void> {
    await setup();
    messagesService.openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: messages });
    fixture.detectChanges();
  }

  it('shows an open lobby invite as a card whose "Unirse" button navigates to that lobby', async () => {
    await openThreadWith([invite()]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-invite')).toBeTruthy();
    expect(el.querySelector('.chat-bubble')).toBeFalsy();

    (el.querySelector('.chat-invite-join') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith('/lobby/L1');
  });

  it('once you are inside that lobby, the invite says so instead of offering to join again', async () => {
    await openThreadWith([invite()]);
    socket.push('lobby:update', { lobbyId: 'L1', hostId: 'f1', players: [{ userId: 'me', username: 'Yo' }], playerCount: 1 });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-invite-join')).toBeFalsy();
    expect(el.querySelector('.chat-invite-status')?.textContent).toContain('Ya estás en este lobby');
  });

  it('shows a closed invite without the join button', async () => {
    await openThreadWith([invite({ lobbyActive: false })]);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-invite--closed')).toBeTruthy();
    expect(el.querySelector('.chat-invite-join')).toBeFalsy();
    expect(el.querySelector('.chat-invite-status')?.textContent).toContain('Lobby cerrado');
  });

  it('an invite you sent reads as yours and has no join button', async () => {
    await openThreadWith([invite({ from: 'me', to: 'f1' })]);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.chat-invite-text')?.textContent).toContain('Invitaste a Ana');
    expect(el.querySelector('.chat-invite-join')).toBeFalsy();
  });

  it('the join button disappears live when the lobby closes', async () => {
    await openThreadWith([invite()]);
    expect(fixture.nativeElement.querySelector('.chat-invite-join')).toBeTruthy();

    socket.push('lobby:closed', { lobbyId: 'L1' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chat-invite-join')).toBeFalsy();
  });

  it('close() clears the active thread, hiding the panel again', async () => {
    await setup();
    messagesService.openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    fixture.componentInstance['close']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chat-panel')).toBeFalsy();
    expect(messagesService.activeFriendId()).toBeNull();
  });
});
