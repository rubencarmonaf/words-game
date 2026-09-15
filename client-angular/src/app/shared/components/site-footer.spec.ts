import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteFooter } from './site-footer';
import { CookieConsentService } from '../services/cookie-consent';

describe('SiteFooter', () => {
  let fixture: ComponentFixture<SiteFooter>;
  let consentService: CookieConsentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteFooter],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteFooter);
    consentService = TestBed.inject(CookieConsentService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('reopens the cookie banner from the preferences link', () => {
    consentService.save(false);
    expect(consentService.visible()).toBe(false);

    const el: HTMLElement = fixture.nativeElement;
    const link = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.trim() === 'Preferencias de cookies')!;
    link.click();

    expect(consentService.visible()).toBe(true);
  });
});
