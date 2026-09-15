import { Observable, Subject } from 'rxjs';

/** Test double for Socket, swapped in via DI so versus-flow specs can push
 * fake server events without touching the real socket.io-client module.
 * (A shared vi.mock('socket.io-client') per spec file was flaky across the
 * suite — this sidesteps module mocking entirely.) */
export class FakeSocket {
  connected = false;
  readonly emitted: { event: string; data: unknown }[] = [];

  private readonly subjects = new Map<string, Subject<unknown>>();

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  emit(event: string, data?: unknown): void {
    this.emitted.push({ event, data });
  }

  on<T>(event: string): Observable<T> {
    return this.subjectFor(event) as unknown as Observable<T>;
  }

  /** Test helper: simulate the server pushing an event down the socket. */
  push<T>(event: string, data: T): void {
    this.subjectFor(event).next(data);
  }

  private subjectFor(event: string): Subject<unknown> {
    if (!this.subjects.has(event)) this.subjects.set(event, new Subject());
    return this.subjects.get(event)!;
  }
}
