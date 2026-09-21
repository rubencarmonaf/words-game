import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { FriendsDock } from './friends-dock';
import { Messages } from '../../core/services/messages';
import { Socket } from '../../core/services/socket';
import { FakeSocket } from '../../core/services/socket.testing';
import { Friends } from '../../core/services/friends';

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

  it('counts a new friend request in the badge of the collapsed button', async () => {
    await setup();
    socket.push('friend:request', { id: 'r1', from: { id: 'u2', username: 'Beto' } });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dock-badge')?.textContent?.trim()).toBe('1');
  });

  it('expands and lists the request when the notice asks to see it', async () => {
    await setup();
    socket.push('friend:request', { id: 'r1', from: { id: 'u2', username: 'Beto' } });
    TestBed.inject(Friends).revealRequestsTick.update((n) => n + 1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const requests = fixture.nativeElement.querySelector('.friend-requests') as HTMLElement;
    expect(requests.textContent).toContain('Beto quiere ser tu amigo');
  });

  it('opens the chat with a single click on the chat button, without needing a double click', async () => {
    await setup();
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.friend-row-chat') as HTMLButtonElement).click();
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });

    expect(TestBed.inject(Messages).activeFriendId()).toBe('f1');
  });

  it('marks the dock as chat-open while a conversation is active (it hides on mobile)', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('.friends-dock')?.classList.contains('chat-open')).toBe(false);

    TestBed.inject(Messages).openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.friends-dock')?.classList.contains('chat-open')).toBe(true);
  });
});
