import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Friends } from './friends';
import { Socket } from './socket';
import { FakeSocket } from './socket.testing';
import { Toast } from '../../shared/services/toast';

describe('Friends', () => {
  let service: Friends;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Socket, useClass: FakeSocket }],
    });
    service = TestBed.inject(Friends);
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
  });

  afterEach(() => httpMock.verify());

  it('refresh() populates the friends list from the API', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [
        { id: 'u1', username: 'Ana', elo: 1000, online: true },
        { id: 'u2', username: 'Beto', elo: 900, online: false },
      ],
    });

    expect(service.friends()).toEqual([
      { id: 'u1', username: 'Ana', elo: 1000, online: true },
      { id: 'u2', username: 'Beto', elo: 900, online: false },
    ]);
  });

  it('friend:online marks the matching friend online without a refetch', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'u2', username: 'Beto', elo: 900, online: false }],
    });

    socket.push('friend:online', { userId: 'u2' });

    expect(service.friends()).toEqual([{ id: 'u2', username: 'Beto', elo: 900, online: true }]);
  });

  it('friend:offline marks the matching friend offline without a refetch', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'u1', username: 'Ana', elo: 1000, online: true }],
    });

    socket.push('friend:offline', { userId: 'u1' });

    expect(service.friends()).toEqual([{ id: 'u1', username: 'Ana', elo: 1000, online: false }]);
  });

  it('presence events for an unknown userId are ignored', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'u1', username: 'Ana', elo: 1000, online: false }],
    });

    socket.push('friend:online', { userId: 'someone-else' });

    expect(service.friends()).toEqual([{ id: 'u1', username: 'Ana', elo: 1000, online: false }]);
  });

  it('a socket connect (including a reconnect) triggers a fresh refresh, self-healing any missed presence event', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'u1', username: 'Ana', elo: 1000, online: false }],
    });

    // Simulates socket.io-client's 'connect' firing again after a dropped
    // connection reconnects, without any explicit friend:online/offline event.
    socket.push('connect', undefined);
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'u1', username: 'Ana', elo: 1000, online: true }],
    });
    // La reconexión también recarga las solicitudes pendientes.
    httpMock.expectOne('/api/friends/requests').flush({ success: true, data: [] });

    expect(service.friends()).toEqual([{ id: 'u1', username: 'Ana', elo: 1000, online: true }]);
  });

  it('refreshRequests() populates pending friend requests', () => {
    service.refreshRequests().subscribe();
    httpMock.expectOne('/api/friends/requests').flush({
      success: true,
      data: [{ id: 'r1', from: { id: 'u3', username: 'Caro' } }],
    });

    expect(service.requests()).toEqual([{ id: 'r1', from: { id: 'u3', username: 'Caro' } }]);
  });

  it('respond() removes the request from the pending list on success', () => {
    service.refreshRequests().subscribe();
    httpMock.expectOne('/api/friends/requests').flush({
      success: true,
      data: [{ id: 'r1', from: { id: 'u3', username: 'Caro' } }],
    });

    service.respond('r1', true).subscribe();
    httpMock.expectOne('/api/friends/respond').flush({ success: true, message: 'Solicitud aceptada' });

    expect(service.requests()).toEqual([]);
  });

  it('remove() deletes the friendship on the server and drops the friend from the list', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [
        { id: 'u1', username: 'Ana', elo: 1000, online: true },
        { id: 'u2', username: 'Beto', elo: 900, online: false },
      ],
    });

    service.remove('u1').subscribe();
    const req = httpMock.expectOne('/api/friends/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Amigo eliminado' });

    expect(service.friends().map((f) => f.id)).toEqual(['u2']);
  });

  it('remove() keeps the friend in the list when the server refuses', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({ success: true, data: [{ id: 'u1', username: 'Ana', elo: 1000, online: true }] });

    service.remove('u1').subscribe();
    httpMock.expectOne('/api/friends/u1').flush({ success: false, message: 'No sois amigos' }, { status: 404, statusText: 'Not Found' });

    expect(service.friends().map((f) => f.id)).toEqual(['u1']);
  });

  it('friend:removed makes the friend disappear live, without a refetch', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [
        { id: 'u1', username: 'Ana', elo: 1000, online: true },
        { id: 'u2', username: 'Beto', elo: 900, online: false },
      ],
    });

    socket.push('friend:removed', { id: 'u2' });

    expect(service.friends().map((f) => f.id)).toEqual(['u1']);
  });

  it('friend:request adds the request live, once, and shows a notice with a "Ver" action', () => {
    const request = { id: 'r9', from: { id: 'u9', username: 'Dani' } };

    socket.push('friend:request', request);
    socket.push('friend:request', request);

    expect(service.requests()).toEqual([request]);
    const notice = TestBed.inject(Toast).messages()[0];
    expect(notice.text).toContain('Dani');
    expect(notice.action?.label).toBe('Ver');

    notice.action?.onClick();
    expect(service.revealRequestsTick()).toBe(1);
  });

  it('friend:accepted reloads the friends list and says who accepted', () => {
    socket.push('friend:accepted', { id: 'u4', username: 'Eva' });

    httpMock.expectOne('/api/friends').flush({ success: true, data: [] });
    expect(TestBed.inject(Toast).messages()[0].text).toContain('Eva');
  });

  it('a socket reconnection reloads the pending requests too, not just the friends', () => {
    socket.push('connect', undefined);

    httpMock.expectOne('/api/friends').flush({ success: true, data: [] });
    httpMock.expectOne('/api/friends/requests').flush({ success: true, data: [] });
  });
});
