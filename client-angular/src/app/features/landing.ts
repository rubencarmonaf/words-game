import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteFooter } from '../shared/components/site-footer';

/** Ported from client/index.html's landing-screen + main.ts's scroll-reveal
 * setup. The hero's live-looking route panel (typing cursor, ELO bars) is
 * entirely static/CSS-driven in the original — no JS animates it. */
@Component({
  selector: 'ww-landing',
  imports: [RouterLink, SiteFooter],
  styleUrl: './landing.scss',
  templateUrl: './landing.html',
})
export class Landing implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer: IntersectionObserver | null = null;

  /** Menú desplegable del header en móvil; en escritorio los enlaces van siempre visibles. */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected scrollToHowItWorks(event: Event): void {
    event.preventDefault();
    const root: HTMLElement = this.elementRef.nativeElement;
    root.querySelector('#como')?.scrollIntoView({ behavior: 'smooth' });
  }

  ngAfterViewInit(): void {
    // El "revelar al hacer scroll" solo tiene sentido en el navegador; al
    // prerenderizar, el contenido queda en el HTML y el observer lo revela luego.
    if (!this.isBrowser) return;
    const root: HTMLElement = this.elementRef.nativeElement;
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el: HTMLElement) => el.classList.add('ww-in'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('ww-in');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    targets.forEach((el: HTMLElement) => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
