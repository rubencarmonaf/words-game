import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StaticPage } from './static-page';

describe('StaticPage', () => {
  let fixture: ComponentFixture<StaticPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaticPage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(StaticPage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the back-to-home link and the shared footer', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-static-back')?.textContent).toContain('Volver al inicio');
    expect(el.querySelector('.ww-footer')).toBeTruthy();
  });
});
