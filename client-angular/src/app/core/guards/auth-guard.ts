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

/** El backend sigue enviando el email de reseteo apuntando a "/?reset=TOKEN"
 * (server.ts no cambia en esta migración) — la landing redirige ese enlace a
 * la pantalla real de reset, en vez de intentar entenderlo ella misma. */
export const resetRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const token = route.queryParamMap.get('reset');
  return token ? router.createUrlTree(['/auth/reset-password'], { queryParams: { token } }) : true;
};
