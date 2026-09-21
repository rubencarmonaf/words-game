import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SeoTitleStrategy } from './seo-title-strategy';

@Component({ template: '' })
class Dummy {}

describe('SeoTitleStrategy', () => {
  let router: Router;

  const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');
  const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'legal/cookies', title: 'Política de cookies', data: { seo: { description: 'Cómo usamos las cookies.' } }, component: Dummy },
          { path: 'inicio', title: 'WordWars · Inicio', component: Dummy },
          { path: 'menu', title: 'Menú', data: { seo: { noindex: true } }, component: Dummy },
          { path: 'sin-titulo', component: Dummy },
        ]),
        { provide: TitleStrategy, useExisting: SeoTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('appends the site name to a route title and uses the route description', async () => {
    await router.navigateByUrl('/legal/cookies');
    expect(document.title).toBe('Política de cookies · WordWars');
    expect(meta('meta[name="description"]')).toBe('Cómo usamos las cookies.');
    expect(meta('meta[property="og:title"]')).toBe('Política de cookies · WordWars');
    expect(meta('meta[name="twitter:description"]')).toBe('Cómo usamos las cookies.');
  });

  it('does not repeat the site name when the route title already has it', async () => {
    await router.navigateByUrl('/inicio');
    expect(document.title).toBe('WordWars · Inicio');
  });

  it('falls back to the site defaults when a route declares no title or description', async () => {
    await router.navigateByUrl('/sin-titulo');
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(meta('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
  });

  it('marks private screens noindex and public ones indexable', async () => {
    await router.navigateByUrl('/menu');
    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow');
    await router.navigateByUrl('/legal/cookies');
    expect(meta('meta[name="robots"]')).toBe('index, follow');
  });

  it('sets a canonical URL and og:url from the current origin, ignoring query and fragment', async () => {
    await router.navigateByUrl('/legal/cookies?utm=x#seccion');
    expect(canonical()).toBe(`${location.origin}/legal/cookies`);
    expect(meta('meta[property="og:url"]')).toBe(`${location.origin}/legal/cookies`);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });
});
