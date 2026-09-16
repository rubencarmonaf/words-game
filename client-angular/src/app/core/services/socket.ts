import { InjectionToken, Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket as IoSocket } from 'socket.io-client';
import { Auth } from './auth';

/** The io() connect function, injected rather than imported directly so specs
 * can swap in a fake via DI instead of mocking the socket.io-client module
 * (module mocks proved unreliable across this suite's parallel test files). */
export const IO_CONNECT = new InjectionToken<typeof io>('IO_CONNECT', {
  providedIn: 'root',
  factory: () => io,
});

/** Thin wrapper around socket.io-client, ported from client/socket/SocketManager.ts.
 * Listeners can be registered via on() before connect() is ever called — they're
 * queued and wired onto the real socket once it exists, same tolerance the
 * vanilla manual event-handler map gave WordGame's constructor. */
@Service()
export class Socket {
  private readonly auth = inject(Auth);
  private readonly ioConnect = inject(IO_CONNECT);

  private socket: IoSocket | null = null;
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>();
  // emit() calls made before authenticate has actually gone out are queued
  // here instead of relying on socket.io-client's own pre-connect buffer,
  // which flushes before our 'connect' handler runs and would let e.g.
  // lobby:create reach the server ahead of authenticate — silently dropped
  // server-side since the socket has no userId yet at that point.
  private readonly pendingEmits: { event: string; data?: unknown }[] = [];

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = this.ioConnect({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      const token = this.auth.token();
      if (token) this.socket!.emit('authenticate', token);

      const queued = this.pendingEmits.splice(0);
      for (const { event, data } of queued) this.socket!.emit(event, data);
    });

    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.pendingEmits.length = 0;
  }

  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else if (this.socket) {
      this.pendingEmits.push({ event, data });
    }
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (data: T) => subscriber.next(data);
      const typedHandler = handler as (data: unknown) => void;

      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event)!.add(typedHandler);
      this.socket?.on(event, handler);

      return () => {
        this.listeners.get(event)?.delete(typedHandler);
        this.socket?.off(event, handler);
      };
    });
  }
}
