import { Component, inject } from '@angular/core';
import { Toast } from '../services/toast';

@Component({
  selector: 'ww-toast-host',
  imports: [],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  protected readonly toast = inject(Toast);
}
