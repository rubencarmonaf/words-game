import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Menu } from './menu';

describe('Menu', () => {
  let component: Menu;
  let fixture: ComponentFixture<Menu>;
  let httpMock: HttpTestingController;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Menu);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne('/api/profile').flush({
      success: true,
      data: {
        id: '1',
        username: 'kaven',
        elo: 1200,
        gamesPlayed: 0,
        gamesWon: 0,
        winRate: 0,
        avatar: DEFAULT_AVATAR,
      },
    });
  }

  function flushDailyChallenge(overrides: { isCompleted?: boolean; totalSeconds?: number } = {}): void {
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: overrides.isCompleted ?? false,
        timeUntilNext: {
          hours: 5,
          minutes: 0,
          seconds: 0,
          totalSeconds: overrides.totalSeconds ?? 18000,
        },
      },
    });
  }

  afterEach(() => httpMock.verify());

  it('should create', async () => {
    await setup();
    flushDailyChallenge();
    expect(component).toBeTruthy();
  });

  it('shows the identity chip with the fetched username', async () => {
    await setup();
    flushDailyChallenge();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-id-chip-name')?.textContent).toContain('kaven');
  });

  it('shows the default "2 min" label when the daily challenge is still pending', async () => {
    await setup();
    flushDailyChallenge({ isCompleted: false });
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    const card = el.querySelector('.mode-btn--amber');
    expect(card?.textContent).toContain('2 min');
  });

  it('shows a completed state with a live countdown once today\'s challenge is done', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      flushDailyChallenge({ isCompleted: true, totalSeconds: 3661 });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.mode-btn--completed')?.textContent).toContain('Completado');
      expect(el.textContent).toContain('01:01:01');

      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(el.textContent).toContain('01:01:00');
    } finally {
      vi.useRealTimers();
    }
  });
});
