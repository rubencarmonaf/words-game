import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Privacidad } from './privacidad';

describe('Privacidad', () => {
  let component: Privacidad;
  let fixture: ComponentFixture<Privacidad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacidad],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Privacidad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the privacy policy heading and a link to the cookies page', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Política de Privacidad');
    expect(el.querySelector('a[href="/legal/cookies"]')).toBeTruthy();
  });
});
