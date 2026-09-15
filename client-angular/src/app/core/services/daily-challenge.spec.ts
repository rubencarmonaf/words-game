import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DailyChallenge } from './daily-challenge';

describe('DailyChallenge', () => {
  let service: DailyChallenge;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DailyChallenge);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('refresh() populates status for a pending challenge', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: false,
        timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
      },
    });

    expect(service.status()).toEqual({
      prefix: 'MA',
      isCompleted: false,
      wordsFound: [],
      timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
    });
  });

  it('refresh() carries the found words when already completed', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: true,
        wordsFound: ['mar', 'mano'],
        timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
      },
    });

    expect(service.status()?.isCompleted).toBe(true);
    expect(service.status()?.wordsFound).toEqual(['mar', 'mano']);
  });

  it('complete() marks the challenge completed and stores the accepted words', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: false,
        timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
      },
    });

    service.complete(['mar', 'mano', 'mano']).subscribe();
    httpMock.expectOne('/api/daily-challenge/complete').flush({
      success: true,
      data: { wordsFound: ['mar', 'mano'], message: '¡Reto completado! Encontraste 2 palabras.' },
    });

    expect(service.status()?.isCompleted).toBe(true);
    expect(service.status()?.wordsFound).toEqual(['mar', 'mano']);
  });

  it('complete() failure leaves the status untouched', () => {
    service.refresh().subscribe();
    httpMock.expectOne('/api/daily-challenge').flush({
      success: true,
      data: {
        challenge: { _id: '1', date: '2026-09-16', prefix: 'MA', createdAt: '2026-09-16T00:00:00Z' },
        isCompleted: false,
        timeUntilNext: { hours: 5, minutes: 0, seconds: 0, totalSeconds: 18000 },
      },
    });

    let result: { success: boolean; message?: string } | undefined;
    service.complete(['xy']).subscribe((r) => (result = r));
    httpMock
      .expectOne('/api/daily-challenge/complete')
      .flush({ success: false, message: 'Necesitas encontrar al menos 3 palabras válidas que empiecen con "MA"' }, { status: 400, statusText: 'Bad Request' });

    expect(result?.success).toBe(false);
    expect(service.status()?.isCompleted).toBe(false);
  });

  it('validateWord() posts to /api/validate-word', () => {
    let result: unknown;
    service.validateWord('mano').subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/validate-word');
    expect(req.request.body).toEqual({ word: 'mano' });
    req.flush({ success: true, data: { valid: true } });

    expect(result).toEqual({ success: true, data: { valid: true } });
  });
});
