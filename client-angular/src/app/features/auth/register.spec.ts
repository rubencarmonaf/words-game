import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires a username of at least 3 characters', () => {
    component['form'].controls.username.setValue('ab');
    expect(component['form'].controls.username.hasError('minlength')).toBe(true);
    component['form'].controls.username.setValue('abc');
    expect(component['form'].controls.username.hasError('minlength')).toBe(false);
  });

  it('requires a password of at least 6 characters', () => {
    component['form'].controls.password.setValue('12345');
    expect(component['form'].controls.password.hasError('minlength')).toBe(true);
  });
});
