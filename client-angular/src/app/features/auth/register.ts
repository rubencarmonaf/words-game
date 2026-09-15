import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Toast } from '../../shared/services/toast';
import { AuthCard } from '../../shared/components/auth-card';

@Component({
  selector: 'ww-register',
  imports: [ReactiveFormsModule, AuthCard],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
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
    const { username, email, password } = this.form.getRawValue();

    this.auth.register(username, email, password).subscribe((result) => {
      this.submitting.set(false);

      if (result.success) {
        this.router.navigateByUrl('/menu');
      } else if (result.message === 'Usuario ya existe') {
        this.form.controls.username.setErrors({
          server: 'Ese usuario o email ya está registrado',
        });
        this.form.controls.username.markAsTouched();
        this.form.controls.email.markAsTouched();
      } else {
        this.toast.show(result.message ?? 'Error en el registro', 'error');
      }
    });
  }
}
