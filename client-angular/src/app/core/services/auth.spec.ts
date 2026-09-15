import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';

function fakeJwt(payload: object): string {
  const base64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${base64({ alg: 'none' })}.${base64(payload)}.sig`;
}

describe('Auth', () => {
  let service: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created with no session by default', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('stores the token and user on successful login', () => {
    service.login('a@b.com', 'secret').subscribe();

    const req = httpMock.expectOne('/api/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      data: { token: 'tok123', user: { id: '1', username: 'kaven' } },
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.username).toBe('kaven');
    expect(localStorage.getItem('authToken')).toBe('tok123');
  });

  it('does not authenticate on a failed login and surfaces the server message', () => {
    let result: any;
    service.login('a@b.com', 'wrong').subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/login');
    req.flush(
      { success: false, message: 'Credenciales inválidas' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(service.isAuthenticated()).toBe(false);
    expect(result.message).toBe('Credenciales inválidas');
  });

  it('reads userId from the JWT payload without verifying the signature', () => {
    const token = fakeJwt({ userId: 'abc123' });
    localStorage.setItem('authToken', token);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const freshService = TestBed.inject(Auth);

    expect(freshService.getUserId()).toBe('abc123');
  });

  it('clears session state on logout', () => {
    service.login('a@b.com', 'secret').subscribe();
    httpMock
      .expectOne('/api/login')
      .flush({ success: true, data: { token: 't', user: { id: '1', username: 'x' } } });

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('verifySession resolves immediately when there is no stored token', async () => {
    await new Promise<void>((resolve) => {
      service.verifySession().subscribe(() => resolve());
    });
    httpMock.expectNone('/api/profile');
  });

  it('verifySession logs out if the stored token is no longer valid', async () => {
    localStorage.setItem('authToken', 'stale-token');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const freshService = TestBed.inject(Auth);
    const freshHttpMock = TestBed.inject(HttpTestingController);

    const done = new Promise<void>((resolve) => {
      freshService.verifySession().subscribe(() => resolve());
    });
    freshHttpMock
      .expectOne('/api/profile')
      .flush({ success: false, message: 'Token inválido' }, { status: 403, statusText: 'Forbidden' });
    await done;

    expect(freshService.isAuthenticated()).toBe(false);
    freshHttpMock.verify();
  });
});
