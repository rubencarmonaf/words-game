import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../services/cookie-consent';

@Component({
  selector: 'ww-site-footer',
  imports: [RouterLink],
  styleUrl: './site-footer.scss',
  templateUrl: './site-footer.html',
})
export class SiteFooter {
  private readonly consentService = inject(CookieConsentService);

  protected openCookiePreferences(event: Event): void {
    event.preventDefault();
    this.consentService.open();
  }
}
