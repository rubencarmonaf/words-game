import { RenderMode, ServerRoute } from '@angular/ssr';

/** Qué se prerenderiza al compilar. Solo las páginas públicas e informativas,
 * que son las que un buscador o una vista previa de enlace tienen que poder
 * leer sin ejecutar JavaScript. Todo lo demás (login, menú, partida, perfil…)
 * depende de la sesión o del socket y se sigue renderizando en el navegador. */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'legal/privacidad', renderMode: RenderMode.Prerender },
  { path: 'legal/terminos', renderMode: RenderMode.Prerender },
  { path: 'legal/aviso-legal', renderMode: RenderMode.Prerender },
  { path: 'legal/cookies', renderMode: RenderMode.Prerender },
  { path: 'contacto', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
