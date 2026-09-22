import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DailyChallenge } from './daily-challenge';
import { Toast } from '../shared/services/toast';

describe('DailyChallenge feature', () => {
  let fixture: ComponentFixture<DailyChallenge>;
  let component: DailyChallenge;
  let httpMock: HttpTestingController;
  let toast: Toast;

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DailyChallenge],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(Toast);
  }

  function flushStatus(overrides: { isCompleted?: boolean; wordsFound?: string[] } = {}): void {
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: overrides.isCompleted ?? false,
        wordsFound: overrides.wordsFound,
        timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
      },
    });
  }

  it('loads and shows today\'s prefix', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();

    expect(component['prefix']()).toBe('MA');
    expect(component['isCompleted']()).toBe(false);
  });

  it('shows the completed state when already done today', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus({ isCompleted: true, wordsFound: ['mar', 'mano'] });

    expect(component['isCompleted']()).toBe(true);
    expect(component['words']()).toEqual(['mar', 'mano']);
  });

  it('start() activates the challenge and counts the timer down', async () => {
    vi.useFakeTimers();
    try {
      await setup();
      fixture = TestBed.createComponent(DailyChallenge);
      component = fixture.componentInstance;
      fixture.detectChanges();
      flushStatus();

      component['start']();
      expect(component['isActive']()).toBe(true);
      expect(component['timerDisplay']()).toBe('2:00');

      vi.advanceTimersByTime(1000);
      expect(component['timerDisplay']()).toBe('1:59');
    } finally {
      vi.useRealTimers();
    }
  });

  it('submit() rejects a word with the wrong prefix without hitting the network', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['wordControl'].setValue('casa');
    await component['submit']();

    expect(component['words']()).toEqual([]);
  });

  it('submit() adds a valid word', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['wordControl'].setValue('mano');
    const submitPromise = component['submit']();
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await submitPromise;

    expect(component['words']()).toEqual(['mano']);
    expect(component['wordControl'].value).toBe('');
  });

  it('submit() ignores accents when checking the prefix', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['wordControl'].setValue('Máscara');
    const submitPromise = component['submit']();
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await submitPromise;

    expect(component['words']()).toEqual(['máscara']);
  });

  it('submit() ignores accents when checking for a repeated word', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['wordControl'].setValue('maíz');
    const first = component['submit']();
    httpMock.expectOne('/api/validate-word').flush({ success: true, data: { valid: true } });
    await first;

    component['wordControl'].setValue('maiz');
    await component['submit']();

    expect(component['words']()).toEqual(['maíz']);
  });

  it('end() with fewer than 3 words shows an error and returns to the start state', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['words'].set(['mar', 'mano']);
    await component['end']();

    expect(component['isActive']()).toBe(false);
    expect(component['isCompleted']()).toBe(false);
    expect(toast.messages()[0]?.text).toBe('Necesitas al menos 3 palabras para completar el reto');
  });

  it('end() with 3+ words completes the challenge', async () => {
    await setup();
    fixture = TestBed.createComponent(DailyChallenge);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushStatus();
    component['start']();

    component['words'].set(['mar', 'mano', 'malo']);
    const endPromise = component['end']();
    httpMock.expectOne('/api/daily-challenge/complete').flush({
      success: true,
      data: { wordsFound: ['mar', 'mano', 'malo'], message: '¡Reto completado! Encontraste 3 palabras.' },
    });
    await endPromise;

    expect(component['isCompleted']()).toBe(true);
    expect(toast.messages()[0]?.text).toBe('¡Reto completado! Encontraste 3 palabras.');
  });
});
