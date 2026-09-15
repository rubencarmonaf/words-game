import { Service, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import type { ApiResponse, AvatarOptions, IUserPublic } from '@shared-types';
import { Auth } from './auth';

export interface ProfileUpdate {
  username?: string;
  avatar?: AvatarOptions;
}

@Service()
export class Profile {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  refresh(): Observable<ApiResponse<IUserPublic>> {
    return this.auth.fetchProfile().pipe(
      tap((result) => {
        if (result.success && result.data) this.auth.setUser(result.data);
      }),
    );
  }

  update(updates: ProfileUpdate): Observable<ApiResponse<IUserPublic>> {
    return this.http.put<ApiResponse<IUserPublic>>('/api/profile', updates).pipe(
      tap((result) => {
        if (result.success && result.data) this.auth.setUser(result.data);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError(err))),
    );
  }

  private toApiError(err: HttpErrorResponse): ApiResponse<IUserPublic> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
