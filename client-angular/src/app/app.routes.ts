import { Routes } from '@angular/router';
import { authGuard, guestGuard, resetRedirectGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    title: 'WordWars · Juego de palabras online con validación RAE',
    data: { seo: { description: 'Forma palabras a partir de un prefijo, compite en tiempo real, sube de ELO y supera el reto diario. Validado con el diccionario de la RAE.' } },
    canActivate: [resetRedirectGuard, guestGuard],
    loadComponent: () => import('./features/landing').then((m) => m.Landing),
  },
  {
    path: 'auth',
    title: 'Iniciar sesión',
    data: { seo: { noindex: true } },
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'auth/register',
    title: 'Crear cuenta',
    data: { seo: { noindex: true } },
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'auth/forgot-password',
    title: 'Recuperar contraseña',
    data: { seo: { noindex: true } },
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // Pantalla "revisa tu correo": se llega tras registrarse o al intentar entrar sin verificar.
    path: 'auth/check-email',
    title: 'Revisa tu correo',
    data: { seo: { noindex: true } },
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/check-email').then((m) => m.CheckEmail),
  },
  {
    // Sin guestGuard: el enlace del email tiene que funcionar aunque el navegador
    // conserve otra sesión (la verificación la sustituye por la de esta cuenta).
    path: 'auth/verify-email',
    title: 'Confirmar email',
    data: { seo: { noindex: true } },
    loadComponent: () => import('./features/auth/verify-email').then((m) => m.VerifyEmail),
  },
  {
    // No guestGuard here on purpose: the reset link WordWars emails must work
    // even if the browser still has an unrelated (or stale) session logged
    // in — matches main.ts's original ?reset= handling, which never checked
    // the stored token before showing the reset form.
    path: 'auth/reset-password',
    title: 'Nueva contraseña',
    data: { seo: { noindex: true } },
    loadComponent: () =>
      import('./features/auth/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'menu',
    title: 'Menú',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/menu').then((m) => m.Menu),
  },
  {
    path: 'play/setup/:mode',
    title: 'Preparar partida',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/game-setup').then((m) => m.GameSetup),
  },
  {
    path: 'play/matchmaking',
    title: 'Buscando partida',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/matchmaking').then((m) => m.Matchmaking),
  },
  {
    path: 'play/game',
    title: 'Partida',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/game').then((m) => m.Game),
  },
  {
    path: 'play/results',
    title: 'Resultados',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/results').then((m) => m.Results),
  },
  {
    path: 'lobby',
    title: 'Lobby',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/lobby').then((m) => m.Lobby),
  },
  {
    path: 'lobby/:lobbyId',
    title: 'Lobby',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/lobby').then((m) => m.Lobby),
  },
  {
    path: 'daily-challenge',
    title: 'Reto diario',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/daily-challenge').then((m) => m.DailyChallenge),
  },
  {
    path: 'profile',
    title: 'Perfil',
    data: { seo: { noindex: true } },
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile').then((m) => m.Profile),
  },
  {
    path: 'legal/privacidad',
    title: 'Política de privacidad',
    data: { seo: { description: 'Cómo trata WordWars tus datos personales: qué información recoge, para qué la usa y qué derechos tienes sobre ella.' } },
    loadComponent: () =>
      import('./features/legal/privacidad').then((m) => m.Privacidad),
  },
  {
    path: 'legal/terminos',
    title: 'Términos y condiciones',
    data: { seo: { description: 'Condiciones de uso de WordWars: reglas de la cuenta, del juego y de la comunidad.' } },
    loadComponent: () => import('./features/legal/terminos').then((m) => m.Terminos),
  },
  {
    path: 'legal/aviso-legal',
    title: 'Aviso legal',
    data: { seo: { description: 'Información legal y datos del titular de WordWars.' } },
    loadComponent: () =>
      import('./features/legal/aviso-legal').then((m) => m.AvisoLegal),
  },
  {
    path: 'legal/cookies',
    title: 'Política de cookies',
    data: { seo: { description: 'Qué cookies y almacenamiento local usa WordWars, para qué sirven y cómo puedes gestionarlos.' } },
    loadComponent: () => import('./features/legal/cookies').then((m) => m.Cookies),
  },
  {
    path: 'contacto',
    title: 'Contacto',
    data: { seo: { description: 'Escríbenos para resolver dudas, enviar sugerencias o comunicar un problema en WordWars.' } },
    loadComponent: () => import('./features/legal/contacto').then((m) => m.Contacto),
  },
  {
    path: 'gracias',
    title: 'Gracias',
    data: { seo: { noindex: true } },
    loadComponent: () => import('./features/legal/gracias').then((m) => m.Gracias),
  },
  {
    path: '**',
    title: 'Página no encontrada',
    data: { seo: { noindex: true } },
    loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
  },
];
