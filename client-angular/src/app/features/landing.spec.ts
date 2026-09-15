import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing', () => {
  let fixture: ComponentFixture<Landing>;
  let component: Landing;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renders the hero heading and both primary CTAs', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-hero-title')?.textContent).toContain('Tu palabra, ya en marcha');
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toContain('Jugar ahora');
    expect(buttons).toContain('Crear cuenta gratis');
  });

  it('scrollToHowItWorks() prevents the default anchor jump and scrolls smoothly to #como', () => {
    fixture.detectChanges();
    const como = fixture.nativeElement.querySelector('#como') as HTMLElement;
    const scrollSpy = vi.fn();
    como.scrollIntoView = scrollSpy;

    const event = new Event('click', { cancelable: true });
    component['scrollToHowItWorks'](event);

    expect(event.defaultPrevented).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('reveals every [data-reveal] section when IntersectionObserver is unavailable', () => {
    const original = (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;

    try {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const revealed = Array.from(el.querySelectorAll('[data-reveal]'));
      expect(revealed.length).toBeGreaterThan(0);
      revealed.forEach((target) => expect(target.classList.contains('ww-in')).toBe(true));
    } finally {
      (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    }
  });

  it('observes every [data-reveal] section and reveals it once intersecting', () => {
    const observeSpy = vi.fn();
    const unobserveSpy = vi.fn();
    let capturedCallback: IntersectionObserverCallback | null = null;

    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        capturedCallback = callback;
      }
      observe = observeSpy;
      unobserve = unobserveSpy;
      disconnect = vi.fn();
    }

    const original = window.IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;

    try {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
      expect(observeSpy).toHaveBeenCalledTimes(targets.length);

      const first = targets[0];
      const fakeEntry = { isIntersecting: true, target: first } as unknown as IntersectionObserverEntry;
      capturedCallback!([fakeEntry], {} as IntersectionObserver);

      expect(first.classList.contains('ww-in')).toBe(true);
      expect(unobserveSpy).toHaveBeenCalledWith(first);
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
