import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Profile } from './profile';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne('/api/profile').flush({
      success: true,
      data: {
        id: '1',
        username: 'kaven',
        elo: 1200,
        gamesPlayed: 4,
        gamesWon: 1,
        winRate: 25,
        avatar: DEFAULT_AVATAR,
      },
    });
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('should create and fetch the profile on init', () => {
    expect(component).toBeTruthy();
    expect(component['user']()?.username).toBe('kaven');
  });

  it('computes the ELO tier for 1200 as Experto', () => {
    expect(component['tier']().name).toBe('Experto');
  });

  it('startEdit() seeds the form with the current username and avatar', () => {
    component['startEdit']();
    expect(component['form'].controls.username.value).toBe('kaven');
    expect(component['editing']()).toBe(true);
  });
});
