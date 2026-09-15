import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CookieBanner } from './cookie-banner';
import { CookieConsentService } from '../services/cookie-consent';

describe('CookieBanner', () => {
  let component: CookieBanner;
  let fixture: ComponentFixture<CookieBanner>;
  let consentService: CookieConsentService;

  beforeEach(async () => {
    localStorage.removeItem('ww_cookie_consent');

    await TestBed.configureTestingModule({
      imports: [CookieBanner],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CookieBanner);
    component = fixture.componentInstance;
    consentService = TestBed.inject(CookieConsentService);
    fixture.detectChanges();
  });

  it('shows the banner when there is no stored consent', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-cookie-banner')).toBeTruthy();
  });

  it('acceptAll() saves analytics consent and hides the banner', () => {
    component['acceptAll']();
    fixture.detectChanges();

    expect(consentService.consent()?.analytics).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.ww-cookie-banner')).toBeFalsy();
  });

  it('reject() saves without analytics and hides the banner', () => {
    component['reject']();
    fixture.detectChanges();

    expect(consentService.consent()?.analytics).toBe(false);
  });

  it('togglePrefs() reveals the preferences panel', () => {
    expect(component['prefsOpen']()).toBe(false);
    component['togglePrefs']();
    fixture.detectChanges();

    expect(component['prefsOpen']()).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-cookie-prefs')).toBeTruthy();
  });

  it('savePrefs() persists the analytics toggle state', () => {
    component['analyticsChecked'].set(true);
    component['savePrefs']();

    expect(consentService.consent()?.analytics).toBe(true);
  });
});
