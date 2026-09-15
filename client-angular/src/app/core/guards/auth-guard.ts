import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

/** Protege las rutas que requieren sesión iniciada. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return auth.isAuthenticated() || router.createUrlTree(['/auth']);
};

/** Protege /auth/*: si ya hay sesión, no tiene sentido volver a login/registro. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return !auth.isAuthenticated() || router.createUrlTree(['/menu']);
};
