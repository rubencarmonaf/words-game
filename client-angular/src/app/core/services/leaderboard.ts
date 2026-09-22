import { Service, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import type { ApiResponse, DailyLeaderboardResponse, LeaderboardScope } from '@shared-types';

/** Ranking del reto diario de hoy — se resetea cada día porque el prefijo cambia y no es
 * justo comparar cuántas palabras dio uno con otro. `scope` filtra a solo amigos o a todos. */
@Service()
export class Leaderboard {
  private readonly http = inject(HttpClient);

  get(scope: LeaderboardScope): Observable<ApiResponse<DailyLeaderboardResponse>> {
    return this.http
      .get<ApiResponse<DailyLeaderboardResponse>>('/api/daily-challenge/leaderboard', { params: { scope } })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError(err))));
  }

  private toApiError(err: HttpErrorResponse): ApiResponse<DailyLeaderboardResponse> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
