import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthCard } from './auth-card';

describe('AuthCard', () => {
  let component: AuthCard;
  let fixture: ComponentFixture<AuthCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the login/register tabs by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.auth-tabs')).toBeTruthy();
  });

  it('hides the tabs when showTabs is false', async () => {
    fixture.componentRef.setInput('showTabs', false);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.auth-tabs')).toBeFalsy();
  });
});
