import { Service, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

/** Reemplaza a UI.showMessage() del cliente vanilla — un único toast activo a
 * la vez, se autodestruye a los 3s, igual que el original. */
@Service()
export class Toast {
  private idCounter = 0;
  readonly messages = signal<ToastMessage[]>([]);

  show(text: string, type: ToastType = 'info'): void {
    const id = ++this.idCounter;
    this.messages.set([{ id, text, type }]);
    setTimeout(() => {
      this.messages.update((list) => list.filter((m) => m.id !== id));
    }, 3000);
  }
}
