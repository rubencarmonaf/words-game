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
    httpMock.expectOne('/api/friends/sent').flush({ success: true, data: [] });
    httpMock.expectOne('/api/messages/unread-counts').flush({ success: true, data: {} });
  }

  /** Un friend:request re-consulta la lista de amigos: se responde con la lista de siempre. */
  function flushFriendsRefetch(): void {
    for (const pending of httpMock.match('/api/friends')) {
      pending.flush({ success: true, data: [{ id: 'f1', username: 'Ana', elo: 1000, online: true, avatar: DEFAULT_AVATAR }] });
    }
  }

  const tool = (name: string): HTMLButtonElement => fixture.nativeElement.querySelector(`.dock-tool-${name}`);

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
    flushFriendsRefetch();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dock-badge')?.textContent?.trim()).toBe('1');
  });

  it('expands and lists the request when the notice asks to see it', async () => {
    await setup();
    socket.push('friend:request', { id: 'r1', from: { id: 'u2', username: 'Beto' } });
    flushFriendsRefetch();
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

  it('asks for confirmation before removing a friend, and cancelling keeps them', async () => {
    await setup();
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.friend-row-remove') as HTMLButtonElement).click();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.friend-row') as HTMLElement;
    expect(row.textContent).toContain('¿Eliminar a Ana?');

    (row.querySelector('.friend-row-confirm-actions .btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.friend-row-confirm')).toBeNull();
    expect(fixture.nativeElement.querySelector('.friend-row')?.textContent).toContain('Ana');
  });

  it('removes the friend once confirmed, closing their chat', async () => {
    await setup();
    fixture.componentInstance['expanded'].set(true);
    TestBed.inject(Messages).openThread('f1');
    httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.friend-row-remove') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.friend-row-confirm-actions .btn-danger') as HTMLButtonElement).click();

    const req = httpMock.expectOne('/api/friends/f1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Amigo eliminado' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.friend-row')).toBeNull();
    expect(TestBed.inject(Messages).activeFriendId()).toBeNull();
  });

  describe('steam-style header', () => {
    async function open(): Promise<void> {
      await setup();
      fixture.componentInstance['expanded'].set(true);
      fixture.detectChanges();
    }

    it('has search, requests and add-friend icons in the header', async () => {
      await open();
      expect(tool('search')).toBeTruthy();
      expect(tool('requests')).toBeTruthy();
      expect(tool('add')).toBeTruthy();
    });

    it('the requests icon carries a count of pending received requests', async () => {
      await open();
      expect(tool('requests').querySelector('.dock-tool-badge')).toBeNull();

      socket.push('friend:request', { id: 'r1', from: { id: 'u2', username: 'Beto' } });
      flushFriendsRefetch();
      fixture.detectChanges();

      expect(tool('requests').querySelector('.dock-tool-badge')?.textContent?.trim()).toBe('1');
    });

    it('the requests view lists what I received and what I sent, and clicking the icon again goes back', async () => {
      await open();
      socket.push('friend:request', { id: 'r1', from: { id: 'u2', username: 'Beto' } });
      flushFriendsRefetch();
      TestBed.inject(Friends).refreshSent().subscribe();
      httpMock.expectOne('/api/friends/sent').flush({ success: true, data: [{ id: 's1', to: { id: 'u3', username: 'Caro' } }] });

      tool('requests').click();
      fixture.detectChanges();

      const text = (fixture.nativeElement.querySelector('.dock-body') as HTMLElement).textContent ?? '';
      expect(text).toContain('Solicitudes recibidas (1)');
      expect(text).toContain('Beto quiere ser tu amigo');
      expect(text).toContain('Solicitudes enviadas (1)');
      expect(text).toContain('Caro');
      expect(fixture.nativeElement.querySelector('.friend-row')).toBeNull();

      tool('requests').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.friend-row')).toBeTruthy();
    });

    it('cancelling a sent request calls the server and removes it from the list', async () => {
      await open();
      TestBed.inject(Friends).refreshSent().subscribe();
      httpMock.expectOne('/api/friends/sent').flush({ success: true, data: [{ id: 's1', to: { id: 'u3', username: 'Caro' } }] });
      tool('requests').click();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.friend-request--sent .btn') as HTMLButtonElement).click();
      const req = httpMock.expectOne('/api/friends/requests/s1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, message: 'Solicitud cancelada' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.friend-request--sent')).toBeNull();
    });

    it('sending a request from the add view moves to the requests view so it shows as sent', async () => {
      await open();
      tool('add').click();
      fixture.detectChanges();

      fixture.componentInstance['addFriendControl'].setValue('Caro');
      fixture.componentInstance['submitAddFriend']();
      httpMock.expectOne('/api/friends/request').flush({ success: true, message: 'Solicitud enviada' });
      httpMock.expectOne('/api/friends/sent').flush({ success: true, data: [{ id: 's1', to: { id: 'u3', username: 'Caro' } }] });
      fixture.detectChanges();

      expect(fixture.componentInstance['view']()).toBe('requests');
      expect((fixture.nativeElement.querySelector('.dock-body') as HTMLElement).textContent).toContain('Caro');
    });

    it('the search box filters the friends by name', async () => {
      await open();
      TestBed.inject(Friends).refresh().subscribe();
      httpMock.expectOne('/api/friends').flush({
        success: true,
        data: [
          { id: 'f1', username: 'Ana', elo: 1000, online: true, avatar: DEFAULT_AVATAR },
          { id: 'f2', username: 'Beto', elo: 900, online: false, avatar: DEFAULT_AVATAR },
        ],
      });
      tool('search').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.friend-row').length).toBe(2);

      fixture.componentInstance['searchControl'].setValue('be');
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.friend-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Beto');

      fixture.componentInstance['searchControl'].setValue('zzz');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.no-friends')?.textContent).toContain('Ningún amigo coincide');
    });

    it('closes the open chat when that friend disappears from the list (they removed you)', async () => {
      await open();
      TestBed.inject(Messages).openThread('f1');
      httpMock.expectOne('/api/messages/f1').flush({ success: true, data: [] });
      fixture.detectChanges();
      expect(TestBed.inject(Messages).activeFriendId()).toBe('f1');

      socket.push('friend:removed', { id: 'f1' });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(TestBed.inject(Messages).activeFriendId()).toBeNull();
    });
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
