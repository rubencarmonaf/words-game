import { Service, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import type { ApiResponse } from '@shared-types';
import { Auth } from './auth';
import { Socket } from './socket';

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  /** Ausente en mensajes antiguos: se trata como 'text'. */
  kind?: 'text' | 'lobby-invite';
  /** Solo en invitaciones: el lobby al que apuntan y si sigue abierto. */
  lobbyId?: string;
  lobbyActive?: boolean;
}

/** Chat 1:1 con amigos — siempre persistido (ver Message en el backend), así
 * que un mensaje mandado mientras el destinatario está desconectado no se
 * pierde: al reabrir el hilo (o al reconectar, para el contador de no
 * leídos) sigue ahí. Solo lleva el hilo ACTIVO en memoria; el resto del
 * historial se pide de nuevo si hace falta, no vale la pena cachear todo. */
@Service()
export class Messages {
  private readonly http = inject(HttpClient);
  private readonly socket = inject(Socket);
  private readonly auth = inject(Auth);

  private readonly activeFriendIdSignal = signal<string | null>(null);
  private readonly messagesSignal = signal<ChatMessage[]>([]);
  private readonly unreadCountsSignal = signal<Record<string, number>>({});

  readonly activeFriendId = this.activeFriendIdSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly unreadCounts = this.unreadCountsSignal.asReadonly();

  constructor() {
    this.socket.on<ChatMessage>('dm:message').subscribe((message) => this.handleIncoming(message));

    // Una invitación solo se puede aceptar mientras su lobby siga abierto: el
    // servidor avisa cuando arranca o se disuelve para apagar el botón sin
    // esperar a que el usuario lo pulse y se lleve un error.
    this.socket.on<{ lobbyId: string }>('lobby:closed').subscribe(({ lobbyId }) => {
      this.messagesSignal.update((list) =>
        list.map((m) => (m.lobbyId === lobbyId ? { ...m, lobbyActive: false } : m)),
      );
    });

    // Si te eliminan, su chat deja de existir para ti: se cierra si estaba abierto.
    this.socket.on<{ id: string }>('friend:removed').subscribe(({ id }) => this.forgetFriend(id));

    // Igual que Friends: al (re)conectar se repite el conteo de no leídos,
    // así un aviso perdido durante un corte no deja el badge desactualizado.
    this.socket.on<void>('connect').subscribe(() => this.refreshUnreadCounts().subscribe());
  }

  /** Abre el hilo con un amigo: trae su historial (que de paso lo marca como
   * leído en el servidor) y lo deja como el hilo activo. Solo guarda el id —
   * username/avatar/estado en línea se leen de Friends por ese id (una sola
   * fuente de verdad, siempre al día con la presencia en vivo). */
  openThread(friendId: string): void {
    this.activeFriendIdSignal.set(friendId);
    this.messagesSignal.set([]);
    this.unreadCountsSignal.update((counts) => ({ ...counts, [friendId]: 0 }));

    this.http.get<ApiResponse<ChatMessage[]>>(`/api/messages/${friendId}`).subscribe((result) => {
      if (result.success && result.data && this.activeFriendIdSignal() === friendId) {
        this.messagesSignal.set(result.data);
      }
    });
  }

  closeThread(): void {
    this.activeFriendIdSignal.set(null);
    this.messagesSignal.set([]);
  }

  /** Deja de mostrar todo lo de un amigo eliminado: cierra su chat si estaba abierto
   * y quita sus mensajes sin leer del contador. */
  forgetFriend(friendId: string): void {
    if (this.activeFriendIdSignal() === friendId) this.closeThread();
    this.unreadCountsSignal.update((counts) => {
      const { [friendId]: _removed, ...rest } = counts;
      return rest;
    });
  }

  send(text: string): void {
    const to = this.activeFriendIdSignal();
    const trimmed = text.trim();
    if (!to || !trimmed) return;
    this.socket.emit('dm:send', { to, text: trimmed });
  }

  refreshUnreadCounts(): Observable<ApiResponse<Record<string, number>>> {
    return this.http.get<ApiResponse<Record<string, number>>>('/api/messages/unread-counts').pipe(
      tap((result) => {
        if (result.success && result.data) this.unreadCountsSignal.set(result.data);
      }),
      catchError((err: HttpErrorResponse) => of(this.toApiError<Record<string, number>>(err))),
    );
  }

  private handleIncoming(message: ChatMessage): void {
    const myUserId = this.auth.getUserId();
    const other = message.from === myUserId ? message.to : message.from;

    if (this.activeFriendIdSignal() === other) {
      this.messagesSignal.update((list) => [...list, message]);
      return;
    }

    // Solo cuenta como "no leído" lo que llega de otra persona mientras su
    // hilo no está abierto — el eco de tus propios mensajes no debe sumar.
    if (message.from !== myUserId) {
      this.unreadCountsSignal.update((counts) => ({ ...counts, [other]: (counts[other] ?? 0) + 1 }));
    }
  }

  private toApiError<T>(err: HttpErrorResponse): ApiResponse<T> {
    const body = err.error;
    if (body && typeof body === 'object' && 'message' in body) {
      return { success: false, message: body.message };
    }
    return { success: false, message: 'Error de conexión' };
  }
}
