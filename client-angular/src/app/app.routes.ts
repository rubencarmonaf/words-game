import { Routes } from '@angular/router';
import { authGuard, guestGuard, resetRedirectGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [resetRedirectGuard, guestGuard],
    loadComponent: () => import('./features/landing').then((m) => m.Landing),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'auth/register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'auth/forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // No guestGuard here on purpose: the reset link WordWars emails must work
    // even if the browser still has an unrelated (or stale) session logged
    // in — matches main.ts's original ?reset= handling, which never checked
    // the stored token before showing the reset form.
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () => import('./features/menu').then((m) => m.Menu),
  },
  {
    path: 'play/setup/:mode',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game-setup').then((m) => m.GameSetup),
  },
  {
    path: 'play/matchmaking',
    canActivate: [authGuard],
    loadComponent: () => import('./features/matchmaking').then((m) => m.Matchmaking),
  },
  {
    path: 'play/game',
    canActivate: [authGuard],
    loadComponent: () => import('./features/game').then((m) => m.Game),
  },
  {
    path: 'play/results',
    canActivate: [authGuard],
    loadComponent: () => import('./features/results').then((m) => m.Results),
  },
  {
    path: 'lobby',
    canActivate: [authGuard],
    loadComponent: () => import('./features/lobby').then((m) => m.Lobby),
  },
  {
    path: 'daily-challenge',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/daily-challenge').then((m) => m.DailyChallenge),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile').then((m) => m.Profile),
  },
  {
    path: 'legal/privacidad',
    loadComponent: () =>
      import('./features/legal/privacidad').then((m) => m.Privacidad),
  },
  {
    path: 'legal/terminos',
    loadComponent: () => import('./features/legal/terminos').then((m) => m.Terminos),
  },
  {
    path: 'legal/aviso-legal',
    loadComponent: () =>
      import('./features/legal/aviso-legal').then((m) => m.AvisoLegal),
  },
  {
    path: 'legal/cookies',
    loadComponent: () => import('./features/legal/cookies').then((m) => m.Cookies),
  },
  {
    path: 'contacto',
    loadComponent: () => import('./features/legal/contacto').then((m) => m.Contacto),
  },
  {
    path: 'gracias',
    loadComponent: () => import('./features/legal/gracias').then((m) => m.Gracias),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
  },
];
