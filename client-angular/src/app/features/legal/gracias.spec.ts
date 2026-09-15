import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Gracias } from './gracias';

function activatedRouteStub(tipo: string | null) {
  return { snapshot: { queryParamMap: convertToParamMap(tipo ? { tipo } : {}) } };
}

describe('Gracias', () => {
  let fixture: ComponentFixture<Gracias>;
  let component: Gracias;

  async function setup(tipo: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Gracias],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: activatedRouteStub(tipo) }],
    }).compileComponents();

    fixture = TestBed.createComponent(Gracias);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows the generic thank-you message with no tipo param', async () => {
    await setup(null);
    expect(component['content'].title).toBe('¡Gracias!');
  });

  it('shows the password-reset message and links to /auth', async () => {
    await setup('reset');
    expect(component['content'].title).toBe('Revisa tu correo');
    expect(component['content'].ctaLink).toBe('/auth');
  });

  it('shows the welcome message after registration', async () => {
    await setup('registro');
    expect(component['content'].title).toBe('¡Bienvenido a WordWars!');
  });

  it('shows the message-sent confirmation after contact', async () => {
    await setup('contacto');
    expect(component['content'].title).toBe('¡Mensaje enviado!');
  });
});
