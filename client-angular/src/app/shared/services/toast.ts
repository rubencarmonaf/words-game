import { Service, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  action?: ToastAction;
}

/** Reemplaza a UI.showMessage() del cliente vanilla — un único toast activo a
 * la vez, se autodestruye a los 3s, igual que el original. Un toast con
 * action (p.ej. una invitación de lobby) se mantiene el doble de tiempo, ya
 * que exige una decisión en vez de ser solo informativo. */
@Service()
export class Toast {
  private idCounter = 0;
  readonly messages = signal<ToastMessage[]>([]);

  show(text: string, type: ToastType = 'info', action?: ToastAction): void {
    const id = ++this.idCounter;
    this.messages.set([{ id, text, type, action }]);
    setTimeout(
      () => {
        this.messages.update((list) => list.filter((m) => m.id !== id));
      },
      action ? 6000 : 3000,
    );
  }
}
