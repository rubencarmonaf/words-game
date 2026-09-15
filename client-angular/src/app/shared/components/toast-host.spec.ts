import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastHost } from './toast-host';
import { Toast } from '../services/toast';

describe('ToastHost', () => {
  let component: ToastHost;
  let fixture: ComponentFixture<ToastHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHost],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastHost);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a toast pushed through the Toast service', async () => {
    const toast = TestBed.inject(Toast);
    toast.show('Hola', 'success');
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Hola');
    expect(el.querySelector('.ww-toast--success')).toBeTruthy();
  });
});
