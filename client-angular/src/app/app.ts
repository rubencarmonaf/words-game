import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/components/toast-host';
import { CookieBanner } from './shared/components/cookie-banner';
import { FriendsDock } from './shared/components/friends-dock';
import { ChatPanel } from './shared/components/chat-panel';
import { Auth } from './core/services/auth';

@Component({
  imports: [RouterOutlet, ToastHost, CookieBanner, FriendsDock, ChatPanel],
  selector: 'ww-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(Auth);
}
