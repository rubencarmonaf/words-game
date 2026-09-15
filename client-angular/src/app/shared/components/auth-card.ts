import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ww-auth-card',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './auth-card.html',
  styleUrl: './auth-card.scss',
})
export class AuthCard {
  /** Oculto en forgot/reset-password, igual que .auth-tabs-hidden en el original. */
  readonly showTabs = input(true);
}
