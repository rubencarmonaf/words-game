import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import type {
  ApiResponse,
  AuthResponse,
  IUserPublic,
  RegisterResponse,
} from '@shared-types';

const TOKEN_KEY = 'authToken';

@Service()
export class Auth {
  private readonly http = inject(HttpClient);
  // Al prerenderizar (Node) no hay localStorage ni sesión: se trata como visitante.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly tokenSignal = signal<string | null>(
    this.isBrowser ? localStorage.getItem(TOKEN_KEY) : null,
  );
  private readonly userSignal = signal<IUserPublic | null>(null);

  readonly token = this.tokenSignal.asReadonly();
  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  /** Email al que se acaba de mandar el enlace de verificación; lo lee la pantalla
   * "revisa tu correo" para poder reenviarlo. Solo vive mientras dure la sesión de la app. */
  readonly pendingVerificationEmail = signal<string | null>(null);
  /** Cuándo se envió el último enlace (ms), para que el botón de reenviar respete la espera. */
  readonly verificationSentAt = signal<number | null>(null);

  /** userId leído del payload del JWT, sin verificar firma — solo para uso en UI local. */
  getUserId(): string | null {
    const token = this.tokenSignal();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId ?? null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http
      .post<ApiResponse<AuthResponse>>('/api/login', { email, password })
      .pipe(
        tap((result) => this.applyAuthResponse(result)),
        catchError((err: HttpErrorResponse) => of(this.toApiError<AuthResponse>(err))),
      );
  }

  register(
    username: string,
    email: string,
    password: string,
  ): Observable<ApiResponse<RegisterResponse>> {
    return this.http
      .post<ApiResponse<RegisterResponse>>('/api/register', { username, email, password })
      .pipe(
        tap((result) => {
          const data = result.data;
          if (data?.verificationRequired) {
            this.pendingVerificationEmail.set(data.email ?? email);
            if (data.emailSent !== false) this.verificationSentAt.set(Date.now());
          } else {
            this.applyAuthResponse(result as ApiResponse<AuthResponse>);
          }
        }),
        catchError((err: HttpErrorResponse) => of(this.toApiError<RegisterResponse>(err))),
      );
  }

  /** Confirma el email con el token del enlace; si es válido, deja la sesión iniciada. */
  verifyEmail(token: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>('/api/verify-email', { token }).pipe(
      tap((result) => this.applyAuthResponse(result)),
      catchError((err: HttpErrorResponse) => of(this.toApiError<AuthResponse>(err))),
    );
  }

  resendVerification(email: string): Observable<ApiResponse<{ message: string }>> {
    return this.http
      .post<ApiResponse<{ message: string }>>('/api/resend-verification', { email })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))));
  }

  forgotPassword(email: string): Observable<ApiResponse<{ message: string }>> {
    return this.http
      .post<ApiResponse<{ message: string }>>('/api/forgot-password', { email })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))));
  }

  resetPassword(
    token: string,
    password: string,
  ): Observable<ApiResponse<{ message: string }>> {
    return this.http
      .post<ApiResponse<{ message: string }>>('/api/reset-password', { token, password })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))));
  }

  fetchProfile(): Observable<ApiResponse<IUserPublic>> {
    return this.http
      .get<ApiResponse<IUserPublic>>('/api/profile')
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<IUserPublic>(err))));
  }

  /** Se ejecuta una vez al arrancar la app (ver app.config.ts) para confirmar
   * que un token guardado en localStorage sigue siendo válido antes de dejar
   * pasar a las rutas protegidas. */
  verifySession(): Observable<void> {
    if (!this.tokenSignal()) return of(void 0);
    return this.fetchProfile().pipe(
      tap((result) => {
        if (result.success && result.data) {
          this.userSignal.set(result.data);
        } else {
          this.logout();
        }
      }),
      map(() => void 0),
      catchError(() => {
        this.logout();
        return of(void 0);
      }),
    );
  }

  setUser(user: IUserPublic): void {
    this.userSignal.set(user);
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    if (this.isBrowser) localStorage.removeItem(TOKEN_KEY);
  }

  private applyAuthResponse(result: ApiResponse<AuthResponse>): void {
    if (result.success && result.data) {
      this.tokenSignal.set(result.data.token);
      if (this.isBrowser) localStorage.setItem(TOKEN_KEY, result.data.token);
      this.userSignal.set(result.data.user);
    }
  }

  private toApiError<T>(err: HttpErrorResponse): ApiResponse<T> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message, code: body.code };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
