import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Terminos } from './terminos';

describe('Terminos', () => {
  let component: Terminos;
  let fixture: ComponentFixture<Terminos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Terminos],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Terminos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the terms heading', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Términos y Condiciones');
  });
});
