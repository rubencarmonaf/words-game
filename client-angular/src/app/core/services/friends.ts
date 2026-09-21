import { DestroyRef, Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import type { ApiResponse, AvatarOptions } from '@shared-types';
import { Socket } from './socket';
import { Toast } from '../../shared/services/toast';

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

/** Solicitud que envié yo y sigue sin respuesta. */
export interface SentRequest {
  id: string;
  to: { id: string; username: string };
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
  private readonly toast = inject(Toast);

  private readonly friendsSignal = signal<Friend[]>([]);
  private readonly requestsSignal = signal<FriendRequest[]>([]);
  private readonly sentSignal = signal<SentRequest[]>([]);
  readonly friends = this.friendsSignal.asReadonly();
  readonly requests = this.requestsSignal.asReadonly();
  readonly sentRequests = this.sentSignal.asReadonly();
  /** Sube cada vez que algo pide ver las solicitudes (p. ej. el botón "Ver" del aviso):
   * el widget de amigos se abre al cambiar. */
  readonly revealRequestsTick = signal(0);

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
    this.socket.on<void>('connect').subscribe(() => this.refreshAll());

    // Igual al volver a la pestaña: en móvil el navegador congela la página y los avisos en
    // vivo que llegaron mientras tanto (que te eliminaran, una solicitud…) se pierden.
    if (typeof document !== 'undefined') {
      const onVisible = (): void => {
        if (document.visibilityState === 'visible') this.refreshAll();
      };
      document.addEventListener('visibilitychange', onVisible);
      inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
    }

    // Una solicitud nueva aparece al momento y se queda en la lista hasta que se
    // acepte o rechace (también queda guardada en el servidor, así que sobrevive a recargar).
    this.socket.on<FriendRequest>('friend:request').subscribe((request) => {
      // Si alguien me manda una solicitud es que ya no somos amigos (el servidor no lo permite
      // si lo somos): si por un aviso perdido aún sale en mi lista, se quita y se re-consulta,
      // para no ver a la vez "solicitud pendiente" y "ya es tu amigo".
      this.dropFriend(request.from.id);
      this.refresh().subscribe();
      this.requestsSignal.update((list) => (list.some((r) => r.id === request.id) ? list : [...list, request]));
      this.toast.show(`${request.from.username} te ha enviado una solicitud de amistad`, 'info', {
        label: 'Ver',
        onClick: () => this.revealRequestsTick.update((n) => n + 1),
      });
    });

    // Te eliminó: desaparece de tu lista al momento (sin aviso, igual que al revés).
    this.socket.on<{ id: string }>('friend:removed').subscribe(({ id }) => this.dropFriend(id));

    // La persona que la envió la canceló: desaparece de mis solicitudes al momento.
    this.socket.on<{ id: string }>('friend:request-cancelled').subscribe(({ id }) => {
      this.requestsSignal.update((list) => list.filter((r) => r.id !== id));
    });

    this.socket.on<{ id: string; username: string }>('friend:accepted').subscribe((friend) => {
      this.refresh().subscribe();
      this.refreshSent().subscribe();
      this.toast.show(`${friend.username} ha aceptado tu solicitud de amistad`, 'success');
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

  refreshSent(): Observable<ApiResponse<SentRequest[]>> {
    return this.http.get<ApiResponse<SentRequest[]>>('/api/friends/sent').pipe(
      tap((result) => {
        if (result.success && result.data) this.sentSignal.set(result.data);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<SentRequest[]>(err))),
    );
  }

  sendRequest(friendUsername: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>('/api/friends/request', { friendUsername }).pipe(
      tap((result) => {
        if (result.success) this.refreshSent().subscribe();
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))),
    );
  }

  /** Cancela una solicitud que envié y aún no me han respondido. */
  cancelRequest(requestId: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(`/api/friends/requests/${requestId}`).pipe(
      tap((result) => {
        if (result.success) this.sentSignal.update((list) => list.filter((r) => r.id !== requestId));
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))),
    );
  }

  private refreshAll(): void {
    this.refresh().subscribe();
    this.refreshRequests().subscribe();
    this.refreshSent().subscribe();
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

  /** Elimina a un amigo: desaparece de las dos listas (la amistad es una sola). */
  remove(friendId: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(`/api/friends/${friendId}`).pipe(
      tap((result) => {
        if (result.success) this.dropFriend(friendId);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<{ message: string }>(err))),
    );
  }

  private dropFriend(friendId: string): void {
    this.friendsSignal.update((list) => list.filter((f) => f.id !== friendId));
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
