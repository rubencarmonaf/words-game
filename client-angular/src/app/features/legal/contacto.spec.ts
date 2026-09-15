import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Contacto } from './contacto';

describe('Contacto', () => {
  let component: Contacto;
  let fixture: ComponentFixture<Contacto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contacto],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Contacto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers a mailto link to reach out', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('a[href="mailto:rubencarmonaf@gmail.com"]')).toBeTruthy();
  });
});
