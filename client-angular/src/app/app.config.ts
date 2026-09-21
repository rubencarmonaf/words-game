import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { SeoTitleStrategy } from './core/seo/seo-title-strategy';
import { Auth } from './core/services/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: SeoTitleStrategy },
    // Reutiliza el HTML prerenderizado en vez de tirarlo y volver a pintarlo, y
    // repite los clics que el usuario hizo antes de que cargara el JavaScript.
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Confirma, una vez al arrancar, que un token guardado en localStorage
    // sigue siendo válido antes de resolver cualquier ruta protegida.
    provideAppInitializer(() => firstValueFrom(inject(Auth).verifySession())),
  ],
};
