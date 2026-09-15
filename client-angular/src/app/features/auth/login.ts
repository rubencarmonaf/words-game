import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

@Component({
  selector: 'ww-login',
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe((result) => {
      this.submitting.set(false);

      if (result.success) {
        this.router.navigateByUrl('/menu');
      } else if (result.message === 'Credenciales inválidas') {
        this.form.controls.email.markAsTouched();
        this.form.controls.password.setErrors({ server: 'Email o contraseña incorrectos' });
        this.form.controls.password.markAsTouched();
      } else {
        this.toast.show(result.message ?? 'Error en el login', 'error');
      }
    });
  }
}
