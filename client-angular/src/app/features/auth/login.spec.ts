import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with an invalid, untouched form', () => {
    expect(component['form'].invalid).toBe(true);
    expect(component['form'].controls.email.touched).toBe(false);
  });

  it('marks all fields as touched when submitting an empty form', () => {
    component['submit']();
    expect(component['form'].controls.email.touched).toBe(true);
    expect(component['form'].controls.password.touched).toBe(true);
  });
});
