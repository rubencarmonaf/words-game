import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
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

  it('shows the rank emblem for the current ELO', () => {
    const img = fixture.nativeElement.querySelector('.ww-profile-emblem img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/assets/ranks/experto.png');
  });

  it('startEdit() seeds the form with the current username and avatar', () => {
    component['startEdit']();
    expect(component['form'].controls.username.value).toBe('kaven');
    expect(component['editing']()).toBe(true);
  });
});

describe('Profile of a friend (/profile/:userId)', () => {
  let httpMock: HttpTestingController;

  async function setup(userId: string): Promise<ComponentFixture<Profile>> {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ userId })) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('loads the friend profile from their own endpoint and shows their stats, read-only', async () => {
    const fixture = await setup('f1');
    httpMock.expectOne('/api/users/f1/profile').flush({
      success: true,
      data: { id: 'f1', username: 'Ana', elo: 1650, gamesPlayed: 10, gamesWon: 7, winRate: 70, avatar: DEFAULT_AVATAR },
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Ana');
    expect(el.textContent).toContain('70.0%');
    expect(el.textContent).not.toContain('Editar perfil');
    httpMock.expectNone('/api/profile');
  });

  it('goes back to the menu with an error notice when the profile cannot be seen', async () => {
    const fixture = await setup('stranger');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    httpMock
      .expectOne('/api/users/stranger/profile')
      .flush({ success: false, message: 'Solo puedes ver el perfil de tus amigos' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith('/menu');
  });
});
