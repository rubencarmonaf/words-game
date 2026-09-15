import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, guestGuard } from './auth-guard';

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
