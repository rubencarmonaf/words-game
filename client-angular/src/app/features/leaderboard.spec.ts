import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Leaderboard } from './leaderboard';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

const entry = (userId: string, username: string, rank: number, wordCount: number) => ({
  userId,
  username,
  avatar: DEFAULT_AVATAR,
  elo: 1000,
  wordCount,
  completedAt: '2026-09-22T10:00:00Z',
  rank,
});

describe('Leaderboard', () => {
  let fixture: ComponentFixture<Leaderboard>;
  let httpMock: HttpTestingController;

  async function setup(): Promise<void> {
    localStorage.setItem('authToken', fakeToken('me'));
    await TestBed.configureTestingModule({
      imports: [Leaderboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Leaderboard);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  function flushGlobal(data: { totalPlayers: number; entries: ReturnType<typeof entry>[]; me: ReturnType<typeof entry> | null }): void {
    httpMock
      .expectOne((r) => r.url === '/api/daily-challenge/leaderboard' && r.params.get('scope') === 'global')
      .flush({ success: true, data: { date: '2026-09-22', scope: 'global', ...data } });
    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.removeItem('authToken');
    httpMock.verify();
  });

  it('loads the global ranking on init and lists the entries', async () => {
    await setup();
    flushGlobal({ totalPlayers: 2, entries: [entry('u1', 'Ana', 1, 8), entry('me', 'Yo', 2, 5)], me: entry('me', 'Yo', 2, 5) });

    const rows = fixture.nativeElement.querySelectorAll('.leaderboard-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Ana');
  });

  it('highlights my own row among the entries', async () => {
    await setup();
    flushGlobal({ totalPlayers: 2, entries: [entry('u1', 'Ana', 1, 8), entry('me', 'Yo', 2, 5)], me: entry('me', 'Yo', 2, 5) });

    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.leaderboard-row');
    expect(rows[1].classList.contains('leaderboard-row--me')).toBe(true);
    expect(fixture.nativeElement.querySelector('.leaderboard-pinned')).toBeNull();
  });

  it('pins my row separately when I am outside the shown entries', async () => {
    await setup();
    flushGlobal({ totalPlayers: 60, entries: [entry('u1', 'Ana', 1, 20)], me: entry('me', 'Yo', 55, 2) });

    const pinned = fixture.nativeElement.querySelector('.leaderboard-pinned');
    expect(pinned).toBeTruthy();
    expect(pinned.textContent).toContain('Yo');
    expect(pinned.textContent).toContain('55');
  });

  it('switching to the Amigos tab requests the friends scope', async () => {
    await setup();
    flushGlobal({ totalPlayers: 0, entries: [], me: null });

    (fixture.nativeElement.querySelectorAll('.leaderboard-tab')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/daily-challenge/leaderboard' && r.params.get('scope') === 'friends')
      .flush({ success: true, data: { date: '2026-09-22', scope: 'friends', totalPlayers: 1, entries: [entry('f1', 'Beto', 1, 4)], me: null } });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Beto');
  });

  it('clicking the already-active tab does not refetch', async () => {
    await setup();
    flushGlobal({ totalPlayers: 0, entries: [], me: null });

    (fixture.nativeElement.querySelectorAll('.leaderboard-tab')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url === '/api/daily-challenge/leaderboard');
  });

  it('shows an empty state with a CTA to play when nobody has completed it yet and I have not either', async () => {
    await setup();
    flushGlobal({ totalPlayers: 0, entries: [], me: null });

    expect(fixture.nativeElement.querySelector('.leaderboard-empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/daily-challenge"]')).toBeTruthy();
  });
});
