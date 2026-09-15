import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cookies } from './cookies';

describe('Cookies', () => {
  let component: Cookies;
  let fixture: ComponentFixture<Cookies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cookies],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Cookies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the cookies policy heading', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Política de Cookies');
  });
});
