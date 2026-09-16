import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Friends } from '../../core/services/friends';
import { Messages } from '../../core/services/messages';
import { Socket } from '../../core/services/socket';
import { Lobby as LobbyService } from '../../core/services/lobby';
import { Toast } from '../services/toast';
import { WwAvatar } from './ww-avatar';

/** Widget flotante de amigos, montado una vez para toda la app (ver app.html)
 * en vez de vivir dentro del menú — reemplaza el antiguo panel "Amigos" que
 * solo existía en /menu. Recoge también la lista/solicitudes/alta de amigos
 * que antes tenía Menu. El chat en sí vive en su propio panel flotante aparte
 * (ver shared/components/chat-panel.ts), a la izquierda de este widget, no
 * embebido aquí — abrirlo solo actualiza Messages.activeFriendId. */
@Component({
  selector: 'ww-friends-dock',
  imports: [ReactiveFormsModule, WwAvatar],
  styleUrl: './friends-dock.scss',
  templateUrl: './friends-dock.html',
})
export class FriendsDock implements OnInit {
  private readonly friendsService = inject(Friends);
  private readonly messagesService = inject(Messages);
  private readonly socket = inject(Socket);
  private readonly toast = inject(Toast);
  /** Nunca usado directamente: instanciarlo aquí basta para que sus listeners
   * de socket (lobby:invited, etc.) estén activos en toda la app, no solo en
   * el menú como antes. */
  private readonly lobbyService = inject(LobbyService);

  protected readonly expanded = signal(false);
  protected readonly showAddFriend = signal(false);
  protected readonly addFriendControl = new FormControl('', { nonNullable: true });

  protected readonly friendsList = this.friendsService.friends;
  protected readonly pendingRequests = this.friendsService.requests;
  protected readonly unreadCounts = this.messagesService.unreadCounts;

  protected readonly totalUnread = computed(() =>
    Object.values(this.unreadCounts()).reduce((sum, n) => sum + n, 0),
  );

  ngOnInit(): void {
    this.friendsService.refresh().subscribe();
    this.friendsService.refreshRequests().subscribe();
    this.messagesService.refreshUnreadCounts().subscribe();
    // Conectado aquí (no ya en /menu) para recibir invitaciones de lobby y
    // mensajes en cualquier pantalla de la app, no solo en el menú.
    this.socket.connect();
  }

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected toggleAddFriend(): void {
    this.showAddFriend.update((v) => !v);
    this.addFriendControl.setValue('');
  }

  protected submitAddFriend(): void {
    const username = this.addFriendControl.value.trim();
    if (!username) return;

    this.friendsService.sendRequest(username).subscribe((result) => {
      if (result.success) {
        this.toast.show('Solicitud de amistad enviada', 'success');
        this.addFriendControl.setValue('');
        this.showAddFriend.set(false);
      } else {
        this.toast.show(result.message ?? 'Error enviando la solicitud', 'error');
      }
    });
  }

  protected respondToRequest(requestId: string, accept: boolean): void {
    this.friendsService.respond(requestId, accept).subscribe((result) => {
      if (result.success && accept) {
        this.friendsService.refresh().subscribe();
      }
      if (!result.success) {
        this.toast.show(result.message ?? 'Error respondiendo la solicitud', 'error');
      }
    });
  }

  protected openChat(friendId: string): void {
    this.messagesService.openThread(friendId);
  }
}
