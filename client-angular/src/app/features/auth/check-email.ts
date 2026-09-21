import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

/** Debe coincidir con la espera mínima entre envíos que impone el servidor. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Pantalla "revisa tu correo": se llega tras registrarse, o al intentar entrar con una
 * cuenta sin verificar. Sin el email en memoria (p. ej. tras recargar) solo ofrece ir al login. */
@Component({
  selector: 'ww-check-email',
  imports: [RouterLink, AuthCard],
  templateUrl: './check-email.html',
  styleUrl: './check-email.scss',
})
export class CheckEmail {
  private readonly auth = inject(Auth);
  private readonly toast = inject(Toast);

  protected readonly email = this.auth.pendingVerificationEmail;
  protected readonly cooldown = signal(0);
  protected readonly sending = signal(false);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.syncCooldown();
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected resend(): void {
    const email = this.email();
    if (!email || this.sending() || this.cooldown() > 0) return;

    this.sending.set(true);
    this.auth.resendVerification(email).subscribe((result) => {
      this.sending.set(false);
      if (result.success) {
        this.auth.verificationSentAt.set(Date.now());
        this.syncCooldown();
        this.toast.show('Te hemos enviado un nuevo enlace', 'success');
      } else {
        this.toast.show(result.message ?? 'No se pudo reenviar el email', 'error');
      }
    });
  }

  /** Recalcula la espera restante a partir del último envío y la deja contando atrás. */
  private syncCooldown(): void {
    clearInterval(this.timer);
    const sentAt = this.auth.verificationSentAt();
    const remaining = sentAt ? Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - sentAt) / 1000) : 0;
    this.cooldown.set(Math.max(0, remaining));
    if (this.cooldown() > 0) {
      this.timer = setInterval(() => {
        this.cooldown.update((s) => Math.max(0, s - 1));
        if (this.cooldown() === 0) clearInterval(this.timer);
      }, 1000);
    }
  }
}
