import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IO_CONNECT, Socket } from './socket';

function makeFakeSocket() {
  return {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

let fakeSocket: ReturnType<typeof makeFakeSocket>;

function connectHandler(): ((...args: unknown[]) => void) | undefined {
  return fakeSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1];
}

function handlerFor(event: string): ((...args: unknown[]) => void) | undefined {
  return fakeSocket.on.mock.calls.filter(([e]) => e === event).pop()?.[1];
}

describe('Socket', () => {
  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    localStorage.removeItem('authToken');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: IO_CONNECT, useValue: () => fakeSocket },
      ],
    });
  });

  it('should be created', () => {
    expect(TestBed.inject(Socket)).toBeTruthy();
  });

  it('connect() creates the underlying socket and wires the connect handler', () => {
    TestBed.inject(Socket).connect();
    expect(fakeSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('authenticates with the stored token once the socket connects', () => {
    localStorage.setItem('authToken', 'tok123');
    TestBed.inject(Socket).connect();
    connectHandler()?.();

    expect(fakeSocket.emit).toHaveBeenCalledWith('authenticate', 'tok123');
  });

  it('does not emit authenticate when there is no stored token', () => {
    TestBed.inject(Socket).connect();
    connectHandler()?.();

    expect(fakeSocket.emit).not.toHaveBeenCalledWith('authenticate', expect.anything());
  });

  it('emit() forwards immediately once the socket is connected', () => {
    const service = TestBed.inject(Socket);
    service.connect();
    fakeSocket.connected = true;
    service.emit('submitWord', { gameId: 'g1', word: 'hola' });

    expect(fakeSocket.emit).toHaveBeenCalledWith('submitWord', { gameId: 'g1', word: 'hola' });
  });

  it('emit() before connect() is a no-op rather than a throw', () => {
    const service = TestBed.inject(Socket);
    expect(() => service.emit('submitWord', {})).not.toThrow();
  });

  it('emit() called while still connecting is queued and flushed after authenticate, not via the socket.io internal buffer', () => {
    localStorage.setItem('authToken', 'tok123');
    const service = TestBed.inject(Socket);
    service.connect();

    // Not connected yet — must not reach the fake socket immediately, or it
    // could beat 'authenticate' to the server (see the bug this queue fixes).
    service.emit('lobby:create');
    expect(fakeSocket.emit).not.toHaveBeenCalledWith('lobby:create', undefined);

    fakeSocket.connected = true;
    connectHandler()?.();

    const calls = fakeSocket.emit.mock.calls.map(([event]) => event);
    expect(calls).toEqual(['authenticate', 'lobby:create']);
  });

  it('on() registered before connect() is wired onto the socket once connected', () => {
    const service = TestBed.inject(Socket);
    const received: unknown[] = [];
    service.on('matchFound').subscribe((data) => received.push(data));

    service.connect();
    handlerFor('matchFound')?.({ gameId: 'g1' });

    expect(received).toEqual([{ gameId: 'g1' }]);
  });

  it('on() registered after connect() attaches to the live socket immediately', () => {
    const service = TestBed.inject(Socket);
    service.connect();

    const received: unknown[] = [];
    service.on('gameEnd').subscribe((data) => received.push(data));
    handlerFor('gameEnd')?.({ won: true });

    expect(received).toEqual([{ won: true }]);
  });

  it('unsubscribing calls off() on the socket', () => {
    const service = TestBed.inject(Socket);
    service.connect();
    const subscription = service.on('error').subscribe();
    subscription.unsubscribe();

    expect(fakeSocket.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('disconnect() tears down the socket', () => {
    const service = TestBed.inject(Socket);
    service.connect();
    service.disconnect();

    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });
});
