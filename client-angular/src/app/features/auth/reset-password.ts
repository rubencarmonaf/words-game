import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

function passwordsMatchValidator(group: {
  value: { password: string; confirmPassword: string };
}): ValidationErrors | null {
  const { password, confirmPassword } = group.value;
  return password === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'ww-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(Toast);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  private readonly token = this.route.snapshot.queryParamMap.get('token');

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.token) {
      this.toast.show('Enlace de reseteo no válido', 'error');
      return;
    }

    this.submitting.set(true);
    const { password } = this.form.getRawValue();

    this.auth.resetPassword(this.token, password).subscribe((result) => {
      this.submitting.set(false);
      if (result.success) {
        this.toast.show(result.data?.message ?? 'Contraseña actualizada. Inicia sesión.', 'success');
        this.router.navigateByUrl('/auth');
      } else {
        this.toast.show(result.message ?? 'No se pudo restablecer la contraseña', 'error');
      }
    });
  }
}
