import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { FriendsDock } from './friends-dock';
import { Messages } from '../../core/services/messages';
import { Socket } from '../../core/services/socket';
import { FakeSocket } from '../../core/services/socket.testing';

function fakeToken(userId: string): string {
  return `header.${btoa(JSON.stringify({ userId }))}.sig`;
}

describe('FriendsDock', () => {
  let fixture: ComponentFixture<FriendsDock>;
  let httpMock: HttpTestingController;
  let socket: FakeSocket;

  async function setup(): Promise<void> {
    localStorage.setItem('authToken', fakeToken('me'));

    await TestBed.configureTestingModule({
      imports: [FriendsDock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Socket, useClass: FakeSocket },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FriendsDock);
    httpMock = TestBed.inject(HttpTestingController);
    socket = TestBed.inject(Socket) as unknown as FakeSocket;
    fixture.detectChanges();

    httpMock.expectOne('/api/friends').flush({
      success: true,
      data: [{ id: 'f1', username: 'Ana', elo: 1000, online: true, avatar: DEFAULT_AVATAR }],
    });
    httpMock.expectOne('/api/friends/requests').flush({ success: true, data: [] });
    httpMock.expectOne('/api/messages/unread-counts').flush({ success: true, data: {} });
  }

  afterEach(() => {
    localStorage.removeItem('authToken');
    httpMock.verify();
  });

  it('starts collapsed, showing only the toggle button', async () => {
    await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.dock-toggle')).toBeTruthy();
    expect(el.querySelector('.dock-panel')).toBeFalsy();
  });

  it('expands to show the friend list on toggle', async () => {
    await setup();
    (fixture.nativeElement.querySelector('.dock-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.dock-panel')).toBeTruthy();
    expect(el.querySelector('.friend-row')?.textContent).toContain('Ana');
  });

  it('double-clicking a friend opens their thread in the Messages service (chat-panel picks it up)', async () => {
    await setup();
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.friend-row') as HTMLElement;
    row.dispatchEvent(new Event('dblclick', { bubbles: true }));

    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });

    const messagesService = TestBed.inject(Messages);
    expect(messagesService.activeFriendId()).toBe('f1');
  });

  it('shows a badge with the total unread count across friends', async () => {
    await setup();
    socket.push('dm:message', { id: 'm1', from: 'f1', to: 'me', text: 'hi', createdAt: '2026-01-01T00:00:00Z' });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.dock-badge');
    expect(badge?.textContent?.trim()).toBe('1');
  });
});
