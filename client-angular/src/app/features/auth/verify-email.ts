import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

/** Destino del enlace del email de verificación: manda el token al servidor y, si es
 * válido, deja la sesión iniciada y pasa al menú. Es una petición POST lanzada desde
 * aquí (no desde el propio enlace) para que los antivirus de correo no consuman el token. */
@Component({
  selector: 'ww-verify-email',
  imports: [RouterLink, AuthCard],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(Toast);

  protected readonly error = signal<string | null>(null);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('El enlace no es válido.');
      return;
    }

    this.auth.verifyEmail(token).subscribe((result) => {
      if (result.success) {
        this.toast.show('Email confirmado. ¡Bienvenido a WordWars!', 'success');
        this.router.navigateByUrl('/menu');
      } else {
        this.error.set(result.message ?? 'No se pudo confirmar el email.');
      }
    });
  }
}
