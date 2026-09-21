import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'ww_cookie_consent';

/** Analítica cargada de forma perezosa, solo con consentimiento. Sustituye
 * GA_MEASUREMENT_ID por un ID real (formato "G-XXXXXXXXXX") cuando exista. */
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

/** Ported from client/site-notice.ts + client/analytics.ts. Mounted once,
 * globally, via the root CookieBanner component — matches main.ts importing
 * site-notice unconditionally rather than per static page. */
@Service()
export class CookieConsentService {
  // En el servidor (prerender) no hay localStorage ni banner: el HTML que ve un
  // buscador no debe llevar el aviso de cookies como si fuera contenido de la página.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly consentSignal = signal<CookieConsent | null>(this.readStored());
  private readonly visibleSignal = signal(false);
  private analyticsLoaded = false;

  readonly consent = this.consentSignal.asReadonly();
  readonly visible = this.visibleSignal.asReadonly();

  constructor() {
    if (!this.isBrowser) return;
    const consent = this.consentSignal();
    if (!consent) {
      this.visibleSignal.set(true);
    } else if (consent.analytics) {
      this.loadAnalytics();
    }
  }

  /** Reabre el banner, p.ej. desde el enlace "Preferencias de cookies" del footer. */
  open(): void {
    this.visibleSignal.set(true);
  }

  save(analytics: boolean): void {
    const consent: CookieConsent = { necessary: true, analytics, timestamp: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // localStorage no disponible (modo privado, etc.) — seguimos sin persistir la elección
    }
    this.consentSignal.set(consent);
    this.visibleSignal.set(false);
    if (analytics) this.loadAnalytics();
  }

  private readStored(): CookieConsent | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private loadAnalytics(measurementId: string = GA_MEASUREMENT_ID): void {
    if (this.analyticsLoaded || !measurementId || measurementId === 'G-XXXXXXXXXX') {
      if (measurementId === 'G-XXXXXXXXXX') {
        console.info('[WordWars] Analítica no configurada: define un GA_MEASUREMENT_ID real.');
      }
      return;
    }
    this.analyticsLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    w.gtag = (...args: unknown[]) => w.dataLayer.push(args);
    w.gtag('js', new Date());
    w.gtag('config', measurementId, { anonymize_ip: true });
  }
}
