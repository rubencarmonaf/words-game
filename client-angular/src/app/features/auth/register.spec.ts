import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires a username of at least 3 characters', () => {
    component['form'].controls.username.setValue('ab');
    expect(component['form'].controls.username.hasError('minlength')).toBe(true);
    component['form'].controls.username.setValue('abc');
    expect(component['form'].controls.username.hasError('minlength')).toBe(false);
  });

  it('requires a password of at least 6 characters', () => {
    component['form'].controls.password.setValue('12345');
    expect(component['form'].controls.password.hasError('minlength')).toBe(true);
  });

  it('goes to the check-email screen, without a session, when verification is required', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component['form'].setValue({ username: 'ana', email: 'ana@example.com', password: 'secret1' });

    component['submit']();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/register')
      .flush({ success: true, data: { verificationRequired: true, email: 'ana@example.com', emailSent: true } });

    const auth = TestBed.inject(Auth);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.pendingVerificationEmail()).toBe('ana@example.com');
    expect(auth.verificationSentAt()).not.toBeNull();
    expect(navigate).toHaveBeenCalledWith('/auth/check-email');
  });
});
