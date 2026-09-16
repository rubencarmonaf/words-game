import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Friends } from './friends';
import { Socket } from './socket';
import { FakeSocket } from './socket.testing';

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
});
