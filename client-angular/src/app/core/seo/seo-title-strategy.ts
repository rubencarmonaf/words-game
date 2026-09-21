import { DOCUMENT, isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Metadatos de búsqueda que una ruta declara en `data.seo`. */
export interface RouteSeo {
  description?: string;
  /** Pantallas privadas o sin valor propio: no deben aparecer en buscadores. */
  noindex?: boolean;
}

export const SITE_NAME = 'WordWars';
export const DEFAULT_TITLE = 'WordWars · Juego de palabras online con validación RAE';
export const DEFAULT_DESCRIPTION =
  'Forma palabras a partir de un prefijo, compite en tiempo real, sube de ELO y supera el reto diario. Validado con el diccionario de la RAE.';

/** Al prerenderizar no se conoce el dominio público; el servidor lo sustituye al
 * servir el HTML (ver server.ts). En el navegador se usa el origen real. */
export const SITE_URL_PLACEHOLDER = '__SITE_URL__';

/** Fija en cada navegación el título, la descripción, la URL canónica, las
 * etiquetas Open Graph / Twitter y la directiva robots de la página, a partir del
 * `title` y `data.seo` de la ruta. Sustituye al TitleStrategy por defecto de Angular. */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    const seo = this.deepestSeo(snapshot);

    const title = routeTitle
      ? routeTitle.includes(SITE_NAME)
        ? routeTitle
        : `${routeTitle} · ${SITE_NAME}`
      : DEFAULT_TITLE;
    const description = seo?.description ?? DEFAULT_DESCRIPTION;
    const path = snapshot.url.split(/[?#]/)[0] || '/';
    const url = `${this.origin()}${path}`;

    this.title.setTitle(title);
    this.setName('description', description);
    this.setName('robots', seo?.noindex ? 'noindex, nofollow' : 'index, follow');
    this.setProperty('og:title', title);
    this.setProperty('og:description', description);
    this.setProperty('og:url', url);
    this.setName('twitter:title', title);
    this.setName('twitter:description', description);
    this.setCanonical(url);
  }

  private origin(): string {
    return this.isServer ? SITE_URL_PLACEHOLDER : this.document.location.origin;
  }

  private deepestSeo(snapshot: RouterStateSnapshot): RouteSeo | undefined {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['seo'] as RouteSeo | undefined;
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
