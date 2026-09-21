import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Messages } from './messages';
import { Socket } from './socket';
import { FakeSocket } from './socket.testing';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

describe('Messages', () => {
  let service: Messages;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;

  beforeEach(() => {
    localStorage.setItem('authToken', fakeToken('me'));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Socket, useClass: FakeSocket }],
    });
    service = TestBed.inject(Messages);
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
  });

  afterEach(() => {
    localStorage.removeItem('authToken');
    httpMock.verify();
  });

  it('openThread() fetches history and sets it as the active thread', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({
      success: true,
      data: [{ id: 'm1', from: 'friend1', to: 'me', text: 'hola', createdAt: '2026-01-01T00:00:00Z' }],
    });

    expect(service.activeFriendId()).toBe('friend1');
    expect(service.messages()).toEqual([{ id: 'm1', from: 'friend1', to: 'me', text: 'hola', createdAt: '2026-01-01T00:00:00Z' }]);
  });

  it('send() emits dm:send with the active friend and trimmed text', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({ success: true, data: [] });

    service.send('  hola  ');

    expect(socket.emitted).toContainEqual({ event: 'dm:send', data: { to: 'friend1', text: 'hola' } });
  });

  it('send() does nothing without an open thread', () => {
    service.send('hola');
    expect(socket.emitted).toEqual([]);
  });

  it('an incoming dm:message for the open thread is appended live', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({ success: true, data: [] });

    socket.push('dm:message', { id: 'm2', from: 'friend1', to: 'me', text: 'hey', createdAt: '2026-01-01T00:01:00Z' });

    expect(service.messages()).toEqual([{ id: 'm2', from: 'friend1', to: 'me', text: 'hey', createdAt: '2026-01-01T00:01:00Z' }]);
  });

  it('an incoming dm:message from a friend whose thread is not open increments the unread count', () => {
    socket.push('dm:message', { id: 'm3', from: 'friend2', to: 'me', text: 'psst', createdAt: '2026-01-01T00:02:00Z' });

    expect(service.unreadCounts()).toEqual({ friend2: 1 });
    expect(service.messages()).toEqual([]);
  });

  it('the echo of your own outgoing message never counts as unread', () => {
    socket.push('dm:message', { id: 'm4', from: 'me', to: 'friend2', text: 'hi', createdAt: '2026-01-01T00:03:00Z' });

    expect(service.unreadCounts()).toEqual({});
  });

  it('opening a thread clears its unread count', () => {
    socket.push('dm:message', { id: 'm5', from: 'friend3', to: 'me', text: 'yo', createdAt: '2026-01-01T00:04:00Z' });
    expect(service.unreadCounts()).toEqual({ friend3: 1 });

    service.openThread('friend3');
    httpMock.expectOne('/api/messages/friend3').flush({ success: true, data: [] });

    expect(service.unreadCounts()['friend3']).toBe(0);
  });

  it('a lobby invite arriving in the open thread is appended with its lobby data', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({ success: true, data: [] });

    socket.push('dm:message', {
      id: 'i1',
      from: 'friend1',
      to: 'me',
      text: 'Ana te invitó a una partida con amigos',
      createdAt: '2026-01-01T00:05:00Z',
      kind: 'lobby-invite',
      lobbyId: 'lobby9',
      lobbyActive: true,
    });

    expect(service.messages()[0]).toMatchObject({ kind: 'lobby-invite', lobbyId: 'lobby9', lobbyActive: true });
  });

  it('lobby:closed switches off the invites that point at that lobby, and only those', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({
      success: true,
      data: [
        { id: 'i1', from: 'friend1', to: 'me', text: 'a', createdAt: 'x', kind: 'lobby-invite', lobbyId: 'L1', lobbyActive: true },
        { id: 'i2', from: 'friend1', to: 'me', text: 'b', createdAt: 'x', kind: 'lobby-invite', lobbyId: 'L2', lobbyActive: true },
      ],
    });

    socket.push('lobby:closed', { lobbyId: 'L1' });

    expect(service.messages().map((m) => m.lobbyActive)).toEqual([false, true]);
  });

  it('closeThread() clears the active thread and its messages', () => {
    service.openThread('friend1');
    httpMock.expectOne('/api/messages/friend1').flush({ success: true, data: [] });

    service.closeThread();

    expect(service.activeFriendId()).toBeNull();
    expect(service.messages()).toEqual([]);
  });

  it('a socket connect (including a reconnect) refreshes the unread counts', () => {
    socket.push('connect', undefined);
    httpMock.expectOne('/api/messages/unread-counts').flush({ success: true, data: { friend4: 2 } });

    expect(service.unreadCounts()).toEqual({ friend4: 2 });
  });

  it('when a friend is removed, their open chat closes and their unread messages stop counting', () => {
    service.openThread('friend5');
    httpMock.expectOne('/api/messages/friend5').flush({ success: true, data: [] });
    socket.push('dm:message', { id: 'm9', from: 'friend6', to: 'me', text: 'hey', createdAt: '2026-01-01T00:00:00Z' });

    socket.push('friend:removed', { id: 'friend5' });
    expect(service.activeFriendId()).toBeNull();

    socket.push('friend:removed', { id: 'friend6' });
    expect(service.unreadCounts()['friend6']).toBeUndefined();
  });
});
