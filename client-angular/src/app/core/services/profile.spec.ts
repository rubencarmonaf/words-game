import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Profile } from './profile';
import { Auth } from './auth';

describe('Profile', () => {
  let service: Profile;
  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Profile);
    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getUserProfile() fetches the public profile of another user', () => {
    let result: unknown;
    service.getUserProfile('f1').subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/users/f1/profile');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { id: 'f1', username: 'Ana', elo: 900, gamesPlayed: 3, gamesWon: 1, winRate: 33.3, avatar: DEFAULT_AVATAR } });

    expect((result as { data: { username: string } }).data.username).toBe('Ana');
  });

  it('getUserProfile() reports the server message when the profile is not allowed', () => {
    let result: { success: boolean; message?: string } | undefined;
    service.getUserProfile('x').subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/users/x/profile')
      .flush({ success: false, message: 'Solo puedes ver el perfil de tus amigos' }, { status: 403, statusText: 'Forbidden' });

    expect(result).toEqual({ success: false, message: 'Solo puedes ver el perfil de tus amigos' });
  });

  it('refresh() fetches /api/profile and stores the user on Auth', () => {
    service.refresh().subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        id: '1',
        username: 'kaven',
        elo: 1200,
        gamesPlayed: 3,
        gamesWon: 1,
        winRate: 33.3,
        avatar: DEFAULT_AVATAR,
      },
    });

    expect(auth.currentUser()?.username).toBe('kaven');
  });

  it('update() PUTs the changes and stores the returned user on Auth', () => {
    service.update({ username: 'nuevo' }).subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ username: 'nuevo' });
    req.flush({
      success: true,
      data: {
        id: '1',
        username: 'nuevo',
        elo: 1200,
        gamesPlayed: 3,
        gamesWon: 1,
        winRate: 33.3,
        avatar: DEFAULT_AVATAR,
      },
    });

    expect(auth.currentUser()?.username).toBe('nuevo');
  });

  it('update() surfaces a server error without touching Auth state', () => {
    let result: any;
    service.update({ username: 'x' }).subscribe((r) => (result = r));

    httpMock
      .expectOne('/api/profile')
      .flush(
        { success: false, message: 'Ese nombre de usuario ya está en uso' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(result.message).toBe('Ese nombre de usuario ya está en uso');
    expect(auth.currentUser()).toBeNull();
  });
});
