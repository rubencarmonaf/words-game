import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StaticPage } from '../../shared/components/static-page';

interface GraciasContent {
  title: string;
  text: string;
  cta: string;
  ctaLink: string;
}

const DEFAULT_CONTENT: GraciasContent = {
  title: '¡Gracias!',
  text: 'Gracias por pasarte por WordWars.',
  cta: 'Jugar ahora',
  ctaLink: '/',
};

const CONTENT_BY_TYPE: Record<string, GraciasContent> = {
  reset: {
    title: 'Revisa tu correo',
    text: 'Si el email que has introducido está registrado, te hemos enviado un enlace para crear una nueva contraseña. Revisa también la carpeta de spam por si acaso.',
    cta: 'Volver a iniciar sesión',
    ctaLink: '/auth',
  },
  registro: {
    title: '¡Bienvenido a WordWars!',
    text: 'Tu cuenta se ha creado correctamente. Ya puedes formar palabras, subir en el ranking ELO y retar a tus amigos.',
    cta: 'Empezar a jugar',
    ctaLink: '/',
  },
  contacto: {
    title: '¡Mensaje enviado!',
    text: 'Gracias por escribir. Te responderemos lo antes posible al email que nos hayas indicado.',
    cta: 'Volver al inicio',
    ctaLink: '/',
  },
};

@Component({
  selector: 'ww-gracias',
  imports: [RouterLink, StaticPage],
  styleUrl: './gracias.scss',
  templateUrl: './gracias.html',
})
export class Gracias {
  private readonly route = inject(ActivatedRoute);

  protected readonly content: GraciasContent =
    CONTENT_BY_TYPE[this.route.snapshot.queryParamMap.get('tipo') ?? ''] ?? DEFAULT_CONTENT;
}
