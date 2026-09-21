import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '../../core/services/auth';
import { CheckEmail, RESEND_COOLDOWN_SECONDS } from './check-email';

describe('CheckEmail', () => {
  let fixture: ComponentFixture<CheckEmail>;
  let auth: Auth;

  async function setup(email: string | null, sentSecondsAgo: number | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CheckEmail],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    auth = TestBed.inject(Auth);
    auth.pendingVerificationEmail.set(email);
    auth.verificationSentAt.set(sentSecondsAgo === null ? null : Date.now() - sentSecondsAgo * 1000);

    fixture = TestBed.createComponent(CheckEmail);
    await fixture.whenStable();
  }

  const resendButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('.check-email button');

  afterEach(() => vi.useRealTimers());

  it('shows the address the link was sent to', async () => {
    await setup('ana@example.com', 0);
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
  });

  it('keeps resend disabled, counting down, right after the first send', async () => {
    await setup('ana@example.com', 5);
    expect(resendButton().disabled).toBe(true);
    expect(resendButton().textContent).toContain(`${RESEND_COOLDOWN_SECONDS - 5}`);
  });

  it('resends the link when the wait is over and starts a new wait', async () => {
    await setup('ana@example.com', 120);
    expect(resendButton().disabled).toBe(false);

    resendButton().click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/resend-verification')
      .flush({ success: true, data: { message: 'ok' } });
    await fixture.whenStable();

    expect(fixture.componentInstance['cooldown']()).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it('offers only the login link when the address is not in memory (e.g. after a reload)', async () => {
    await setup(null, null);
    expect(fixture.nativeElement.querySelector('.check-email button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('iniciar sesión');
  });
});
