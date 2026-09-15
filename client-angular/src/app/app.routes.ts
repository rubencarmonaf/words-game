import { Routes } from '@angular/router';

// authGuard se añade en la Fase 2 (Auth). Por ahora las rutas navegan libres
// para poder verificar el esqueleto de routing de la Fase 1.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing').then((m) => m.Landing),
  },
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'menu',
    loadComponent: () => import('./features/menu').then((m) => m.Menu),
  },
  {
    path: 'play/setup/:mode',
    loadComponent: () => import('./features/game-setup').then((m) => m.GameSetup),
  },
  {
    path: 'play/matchmaking',
    loadComponent: () => import('./features/matchmaking').then((m) => m.Matchmaking),
  },
  {
    path: 'play/game',
    loadComponent: () => import('./features/game').then((m) => m.Game),
  },
  {
    path: 'play/results',
    loadComponent: () => import('./features/results').then((m) => m.Results),
  },
  {
    path: 'lobby',
    loadComponent: () => import('./features/lobby').then((m) => m.Lobby),
  },
  {
    path: 'daily-challenge',
    loadComponent: () =>
      import('./features/daily-challenge').then((m) => m.DailyChallenge),
  },
  {
    path: 'profile',
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
