import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the bearer token to /api requests when authenticated', () => {
    localStorage.setItem('authToken', 'my-token');
    setup();

    httpClient.get('/api/profile').subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('does not attach a header when there is no token', () => {
    localStorage.clear();
    setup();

    httpClient.get('/api/profile').subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.headers.has('Authorization')).toBe(false);
  });

  it('does not attach the token to non-api requests', () => {
    localStorage.setItem('authToken', 'my-token');
    setup();

    httpClient.get('/assets/logo.png').subscribe();

    const req = httpMock.expectOne('/assets/logo.png');
    expect(req.request.headers.has('Authorization')).toBe(false);
  });
});
