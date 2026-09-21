import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with an invalid, untouched form', () => {
    expect(component['form'].invalid).toBe(true);
    expect(component['form'].controls.email.touched).toBe(false);
  });

  it('marks all fields as touched when submitting an empty form', () => {
    component['submit']();
    expect(component['form'].controls.email.touched).toBe(true);
    expect(component['form'].controls.password.touched).toBe(true);
  });

  it('sends an account with an unverified email to the check-email screen', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component['form'].setValue({ email: 'a@b.com', password: 'secret1' });

    component['submit']();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/login')
      .flush(
        { success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Confirma tu email' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(TestBed.inject(Auth).pendingVerificationEmail()).toBe('a@b.com');
    expect(navigate).toHaveBeenCalledWith('/auth/check-email');
  });
});
