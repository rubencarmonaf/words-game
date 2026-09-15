import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteFooter } from './site-footer';

/** Shared shell for every legal/utility page (privacidad, términos, aviso
 * legal, cookies, contacto, gracias, 404): logo + "Volver al inicio" header,
 * projected content, shared footer. Ported from the identical header/footer
 * markup repeated across client/*.html. */
@Component({
  selector: 'ww-static-page',
  imports: [RouterLink, SiteFooter],
  styleUrl: './static-page.scss',
  templateUrl: './static-page.html',
})
export class StaticPage {}
