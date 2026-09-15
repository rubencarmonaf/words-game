import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AvisoLegal } from './aviso-legal';

describe('AvisoLegal', () => {
  let component: AvisoLegal;
  let fixture: ComponentFixture<AvisoLegal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvisoLegal],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AvisoLegal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the legal notice heading', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Aviso Legal');
  });
});
