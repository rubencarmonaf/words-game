import { Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import type { ApiResponse, WordValidationResponse } from '@shared-types';

export interface TimeUntilNext {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export interface DailyChallengeStatus {
  prefix: string;
  isCompleted: boolean;
  wordsFound: string[];
  timeUntilNext: TimeUntilNext;
}

interface DailyChallengeApiResponse {
  challenge: { _id: string; date: string; prefix: string; createdAt: string };
  isCompleted: boolean;
  wordsFound?: string[];
  timeUntilNext: TimeUntilNext;
}

interface CompleteResponse {
  wordsFound: string[];
  message: string;
}

/** Estado y llamadas del reto diario, ported from AuthManager's
 * getDailyChallenge/completeDailyChallenge and main.ts's daily-challenge
 * methods. status() is also read by the menu to show the "ya completado /
 * cuenta atrás" state on the mode card without duplicating the fetch. */
@Service()
export class DailyChallenge {
  private readonly http = inject(HttpClient);

  private readonly statusSignal = signal<DailyChallengeStatus | null>(null);
  readonly status = this.statusSignal.asReadonly();

  refresh(): Observable<ApiResponse<DailyChallengeApiResponse>> {
    return this.http.get<ApiResponse<DailyChallengeApiResponse>>('/api/daily-challenge').pipe(
      tap((result) => {
        if (result.success && result.data) {
          this.statusSignal.set({
            prefix: result.data.challenge.prefix,
            isCompleted: result.data.isCompleted,
            wordsFound: result.data.wordsFound ?? [],
            timeUntilNext: result.data.timeUntilNext,
          });
        }
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<DailyChallengeApiResponse>(err))),
    );
  }

  complete(words: string[]): Observable<ApiResponse<CompleteResponse>> {
    return this.http.post<ApiResponse<CompleteResponse>>('/api/daily-challenge/complete', { words }).pipe(
      tap((result) => {
        if (result.success) {
          this.statusSignal.update((status) =>
            status ? { ...status, isCompleted: true, wordsFound: result.data?.wordsFound ?? status.wordsFound } : status,
          );
        }
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<CompleteResponse>(err))),
    );
  }

  validateWord(word: string): Observable<ApiResponse<WordValidationResponse>> {
    return this.http
      .post<ApiResponse<WordValidationResponse>>('/api/validate-word', { word })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<WordValidationResponse>(err))));
  }

  private toApiError<T>(err: HttpErrorResponse): ApiResponse<T> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
