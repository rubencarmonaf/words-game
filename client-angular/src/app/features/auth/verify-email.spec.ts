import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';
import { VerifyEmail } from './verify-email';

describe('VerifyEmail', () => {
  let fixture: ComponentFixture<VerifyEmail>;

  // La sesión que deja un test válido vive en localStorage y no debe pasar al siguiente.
  afterEach(() => localStorage.removeItem('authToken'));

  async function setup(token: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyEmail);
    await fixture.whenStable();
  }

  it('logs the user in and goes to the menu when the token is valid', async () => {
    await setup('abc123');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    TestBed.inject(HttpTestingController)
      .expectOne('/api/verify-email')
      .flush({
        success: true,
        data: { token: 'jwt', user: { id: '1', username: 'ana', elo: 0, gamesPlayed: 0, gamesWon: 0, winRate: 0 } },
      });

    expect(TestBed.inject(Auth).isAuthenticated()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/menu');
  });

  it('shows the server message and a login link when the token is invalid', async () => {
    await setup('caducado');

    TestBed.inject(HttpTestingController)
      .expectOne('/api/verify-email')
      .flush(
        { success: false, code: 'INVALID_TOKEN', message: 'El enlace no es válido o ha caducado.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('ha caducado');
    expect(fixture.nativeElement.querySelector('a[href="/auth"]')).not.toBeNull();
    expect(TestBed.inject(Auth).isAuthenticated()).toBe(false);
  });

  it('does not call the server when the link has no token', async () => {
    await setup(null);
    TestBed.inject(HttpTestingController).expectNone('/api/verify-email');
    expect(fixture.nativeElement.textContent).toContain('no es válido');
  });
});
