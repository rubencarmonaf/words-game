import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHost } from './shared/components/toast-host';

@Component({
  imports: [RouterOutlet, ToastHost],
  selector: 'ww-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
