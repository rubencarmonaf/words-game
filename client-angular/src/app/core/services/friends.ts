import { Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import type { ApiResponse, AvatarOptions } from '@shared-types';
import { Socket } from './socket';

export interface Friend {
  id: string;
  username: string;
  elo: number;
  online: boolean;
  avatar: AvatarOptions;
}

export interface FriendRequest {
  id: string;
  from: { id: string; username: string };
}

interface PresencePayload {
  userId: string;
}

/** Amigos reales (GET /api/friends) y solicitudes pendientes — reemplaza la
 * lista de amigos simulada que el menú y el lobby mostraban antes. El estado
 * "En línea" no es solo la foto fija del último fetch: friend:online/offline
 * llega en vivo por socket cada vez que un amigo se conecta o desconecta, sin
 * que haga falta recargar para verlo. */
@Service()
export class Friends {
  private readonly http = inject(HttpClient);
  private readonly socket = inject(Socket);

  private readonly friendsSignal = signal<Friend[]>([]);
  private readonly requestsSignal = signal<FriendRequest[]>([]);
  readonly friends = this.friendsSignal.asReadonly();
  readonly requests = this.requestsSignal.asReadonly();

  constructor() {
    this.socket.on<PresencePayload>('friend:online').subscribe(({ userId }) => this.setOnline(userId, true));
    this.socket.on<PresencePayload>('friend:offline').subscribe(({ userId }) => this.setOnline(userId, false));

    // Los eventos incrementales de arriba bastan mientras la conexión está
    // viva, pero si el socket se cae y se reconecta (red inestable, portátil
    // en suspensión, etc.) cualquier evento perdido durante el corte deja el
    // estado desincronizado para siempre — nada lo corrige solo. 'connect' se
    // dispara tanto en la conexión inicial como en cada reconexión automática
    // de socket.io-client, así que reconsultar aquí autocorrige la vista sin
    // que el usuario tenga que recargar la página a mano.
    this.socket.on<void>('connect').subscribe(() => {
      this.refresh().subscribe();
    });
  }

  refresh(): Observable<ApiResponse<Friend[]>> {
    return this.http.get<ApiResponse<Friend[]>>('/api/friends').pipe(
      tap((result) => {
        if (result.success && result.data) this.friendsSignal.set(result.data);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<Friend[]>(err))),
    );
  }

  refreshRequests(): Observable<ApiResponse<FriendRequest[]>> {
    return this.http.get<ApiResponse<FriendRequest[]>>('/api/friends/requests').pipe(
      tap((result) => {
        if (result.success && result.data) this.requestsSignal.set(result.data);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<FriendRequest[]>(err))),
    );
  }

  sendRequest(friendUsername: string): Observable<ApiResponse<{ message: string }>> {
    return this.http
      .post<ApiResponse<{ message: string }>>('/api/friends/request', { friendUsername })
      .pipe(catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))));
  }

  respond(requestId: string, accept: boolean): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>('/api/friends/respond', { requestId, accept }).pipe(
      tap((result) => {
        if (result.success) {
          this.requestsSignal.update((list) => list.filter((r) => r.id !== requestId));
        }
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))),
    );
  }

  private setOnline(userId: string, online: boolean): void {
    this.friendsSignal.update((list) => list.map((f) => (f.id === userId ? { ...f, online } : f)));
  }

  private toApiError<T>(err: HttpErrorResponse): ApiResponse<T> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
