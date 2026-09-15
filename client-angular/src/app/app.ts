import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/components/toast-host';
import { CookieBanner } from './shared/components/cookie-banner';

@Component({
  imports: [RouterOutlet, ToastHost, CookieBanner],
  selector: 'ww-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
