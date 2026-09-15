import { TestBed } from '@angular/core/testing';
import { UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, guestGuard, resetRedirectGuard } from './auth-guard';

function configureTestBed(): void {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
}

describe('authGuard / guestGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    configureTestBed();
  });

  afterEach(() => localStorage.clear());

  it('authGuard allows navigation when authenticated', () => {
    localStorage.setItem('authToken', 't');
    TestBed.resetTestingModule();
    configureTestBed();
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('authGuard redirects to /auth when not authenticated', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).not.toBe(true);
  });

  it('guestGuard allows navigation when not authenticated', () => {
    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('guestGuard redirects to /menu when already authenticated', () => {
    localStorage.setItem('authToken', 't');
    TestBed.resetTestingModule();
    configureTestBed();
    const result = TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any));
    expect(result).not.toBe(true);
  });
});

describe('resetRedirectGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    configureTestBed();
  });

  afterEach(() => localStorage.clear());

  function routeWithResetParam(reset: string | null) {
    return { queryParamMap: convertToParamMap(reset ? { reset } : {}) } as any;
  }

  it('allows navigation when there is no reset query param', () => {
    const result = TestBed.runInInjectionContext(() => resetRedirectGuard(routeWithResetParam(null), {} as any));
    expect(result).toBe(true);
  });

  it('redirects to /auth/reset-password with the token when a reset param is present', () => {
    const result = TestBed.runInInjectionContext(() =>
      resetRedirectGuard(routeWithResetParam('abc123'), {} as any),
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/auth/reset-password?token=abc123');
  });

  it('redirects even when the browser still has an unrelated session logged in', () => {
    localStorage.setItem('authToken', 'some-other-session');
    TestBed.resetTestingModule();
    configureTestBed();

    const result = TestBed.runInInjectionContext(() =>
      resetRedirectGuard(routeWithResetParam('abc123'), {} as any),
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/auth/reset-password?token=abc123');
  });
});
