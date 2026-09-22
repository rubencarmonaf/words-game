import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Leaderboard } from './leaderboard';

describe('Leaderboard', () => {
  let service: Leaderboard;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Leaderboard);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('get("global") fetches the global scope', () => {
    let result: unknown;
    service.get('global').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === '/api/daily-challenge/leaderboard' && r.params.get('scope') === 'global');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        date: '2026-09-22',
        scope: 'global',
        totalPlayers: 1,
        entries: [{ userId: 'u1', username: 'Ana', avatar: DEFAULT_AVATAR, elo: 1000, wordCount: 8, completedAt: '2026-09-22T10:00:00Z', rank: 1 }],
        me: null,
      },
    });

    expect((result as { data: { totalPlayers: number } }).data.totalPlayers).toBe(1);
  });

  it('get("friends") fetches the friends scope', () => {
    service.get('friends').subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/daily-challenge/leaderboard' && r.params.get('scope') === 'friends');
    req.flush({ success: true, data: { date: '2026-09-22', scope: 'friends', totalPlayers: 0, entries: [], me: null } });
  });

  it('surfaces the server error message on failure', () => {
    let result: { success: boolean; message?: string } | undefined;
    service.get('global').subscribe((r) => (result = r));

    httpMock
      .expectOne((r) => r.url === '/api/daily-challenge/leaderboard')
      .flush({ success: false, message: 'Error del servidor' }, { status: 500, statusText: 'Server Error' });

    expect(result).toEqual({ success: false, message: 'Error del servidor' });
  });
});
