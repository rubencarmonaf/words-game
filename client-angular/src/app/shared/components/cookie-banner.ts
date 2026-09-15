import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../services/cookie-consent';

@Component({
  selector: 'ww-cookie-banner',
  imports: [RouterLink],
  styleUrl: './cookie-banner.scss',
  templateUrl: './cookie-banner.html',
})
export class CookieBanner {
  protected readonly consentService = inject(CookieConsentService);
  protected readonly prefsOpen = signal(false);
  protected readonly analyticsChecked = signal(false);

  protected togglePrefs(): void {
    this.prefsOpen.update((open) => !open);
  }

  protected setAnalyticsChecked(event: Event): void {
    this.analyticsChecked.set((event.target as HTMLInputElement).checked);
  }

  protected acceptAll(): void {
    this.consentService.save(true);
  }

  protected reject(): void {
    this.consentService.save(false);
  }

  protected savePrefs(): void {
    this.consentService.save(this.analyticsChecked());
  }
}
