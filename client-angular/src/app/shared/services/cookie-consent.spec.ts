import { TestBed } from '@angular/core/testing';
import { CookieConsentService } from './cookie-consent';

describe('CookieConsentService', () => {
  beforeEach(() => {
    localStorage.removeItem('ww_cookie_consent');
    document.querySelectorAll('script[src*="googletagmanager"]').forEach((el) => el.remove());
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;

    TestBed.configureTestingModule({});
  });

  it('shows the banner when there is no stored consent yet', () => {
    const service = TestBed.inject(CookieConsentService);
    expect(service.visible()).toBe(true);
    expect(service.consent()).toBeNull();
  });

  it('stays hidden and does not load analytics when stored consent rejected it', () => {
    localStorage.setItem(
      'ww_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, timestamp: 1 }),
    );

    const service = TestBed.inject(CookieConsentService);
    expect(service.visible()).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('open() shows the banner again', () => {
    localStorage.setItem(
      'ww_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, timestamp: 1 }),
    );
    const service = TestBed.inject(CookieConsentService);

    service.open();
    expect(service.visible()).toBe(true);
  });

  it('save(true) persists the choice, hides the banner, and records the decision', () => {
    const service = TestBed.inject(CookieConsentService);
    service.save(true);

    expect(service.visible()).toBe(false);
    expect(service.consent()?.analytics).toBe(true);

    const stored = JSON.parse(localStorage.getItem('ww_cookie_consent')!);
    expect(stored.analytics).toBe(true);
  });

  it('save(false) persists rejection and hides the banner', () => {
    const service = TestBed.inject(CookieConsentService);
    service.save(false);

    expect(service.visible()).toBe(false);
    expect(service.consent()?.analytics).toBe(false);
  });
});
