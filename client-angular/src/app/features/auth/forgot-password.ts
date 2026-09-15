import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

@Component({
  selector: 'ww-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email } = this.form.getRawValue();

    this.auth.forgotPassword(email).subscribe((result) => {
      this.submitting.set(false);
      if (result.success) {
        this.router.navigate(['/gracias'], { queryParams: { tipo: 'reset' } });
      } else {
        this.toast.show(result.message ?? 'No se pudo procesar la solicitud', 'error');
      }
    });
  }
}
