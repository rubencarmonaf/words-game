import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Friends } from '../../core/services/friends';
import { Messages } from '../../core/services/messages';
import { Socket } from '../../core/services/socket';
import { Lobby as LobbyService } from '../../core/services/lobby';
import { Toast } from '../services/toast';
import { WwAvatar } from './ww-avatar';

/** Qué muestra el cuerpo del panel: la lista de amigos, las solicitudes (recibidas y enviadas)
 * o el formulario para agregar a alguien. */
type DockView = 'friends' | 'requests' | 'add';

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
  protected readonly view = signal<DockView>('friends');
  protected readonly searchOpen = signal(false);
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });
  /** Amigo cuya eliminación espera confirmación (dentro de su propia fila). */
  protected readonly confirmRemoveId = signal<string | null>(null);
  protected readonly addFriendControl = new FormControl('', { nonNullable: true });

  protected readonly friendsList = this.friendsService.friends;
  protected readonly pendingRequests = this.friendsService.requests;
  protected readonly sentRequests = this.friendsService.sentRequests;

  /** La lista de amigos, filtrada por lo que se haya escrito en el buscador. */
  protected readonly visibleFriends = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.friendsList();
    return term ? list.filter((f) => f.username.toLowerCase().includes(term)) : list;
  });
  protected readonly unreadCounts = this.messagesService.unreadCounts;

  protected readonly totalUnread = computed(() =>
    Object.values(this.unreadCounts()).reduce((sum, n) => sum + n, 0),
  );

  /** Lo que pide atención en el botón plegado: mensajes sin leer y solicitudes pendientes. */
  protected readonly badgeCount = computed(() => this.totalUnread() + this.pendingRequests().length);

  /** Con un chat abierto, en móvil ocupa toda la pantalla y el widget se oculta (ver scss). */
  protected readonly chatOpen = computed(() => this.messagesService.activeFriendId() !== null);

  constructor() {
    effect(() => {
      if (this.friendsService.revealRequestsTick() > 0) {
        this.expanded.set(true);
        this.view.set('requests');
      }
    });

    // Si el amigo con el que se está chateando deja de estar en la lista (te eliminó, o lo
    // eliminaste tú desde otro dispositivo), su chat ya no tiene sentido: se cierra. Sin esto
    // quedaría marcado como abierto sin que se viera nada.
    effect(() => {
      const id = this.messagesService.activeFriendId();
      if (id && !this.friendsList().some((f) => f.id === id)) {
        untracked(() => this.messagesService.forgetFriend(id));
      }
    });
  }

  ngOnInit(): void {
    this.friendsService.refresh().subscribe();
    this.friendsService.refreshRequests().subscribe();
    this.friendsService.refreshSent().subscribe();
    this.messagesService.refreshUnreadCounts().subscribe();
    // Conectado aquí (no ya en /menu) para recibir invitaciones de lobby y
    // mensajes en cualquier pantalla de la app, no solo en el menú.
    this.socket.connect();
  }

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  /** Cambia entre la lista y una de las otras vistas; pulsar la que ya está abierta vuelve a la lista. */
  protected showView(view: DockView): void {
    this.view.update((current) => (current === view ? 'friends' : view));
    this.addFriendControl.setValue('');
    this.closeSearch();
  }

  protected toggleSearch(): void {
    this.view.set('friends');
    if (this.searchOpen()) {
      this.closeSearch();
    } else {
      this.searchOpen.set(true);
    }
  }

  private closeSearch(): void {
    this.searchOpen.set(false);
    this.searchControl.setValue('');
  }

  protected submitAddFriend(): void {
    const username = this.addFriendControl.value.trim();
    if (!username) return;

    this.friendsService.sendRequest(username).subscribe((result) => {
      if (result.success) {
        this.toast.show('Solicitud de amistad enviada', 'success');
        this.addFriendControl.setValue('');
        // Se pasa a las solicitudes para que se vea que ha quedado enviada.
        this.view.set('requests');
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

  protected cancelSent(requestId: string): void {
    this.friendsService.cancelRequest(requestId).subscribe((result) => {
      if (result.success) {
        this.toast.show('Solicitud cancelada', 'success');
      } else {
        this.toast.show(result.message ?? 'No se pudo cancelar la solicitud', 'error');
      }
    });
  }

  protected openChat(friendId: string): void {
    this.messagesService.openThread(friendId);
  }

  protected askRemove(friendId: string): void {
    this.confirmRemoveId.set(friendId);
  }

  protected cancelRemove(): void {
    this.confirmRemoveId.set(null);
  }

  protected removeFriend(friendId: string): void {
    this.friendsService.remove(friendId).subscribe((result) => {
      this.confirmRemoveId.set(null);
      if (result.success) {
        this.messagesService.forgetFriend(friendId);
        this.toast.show('Amigo eliminado', 'success');
      } else {
        this.toast.show(result.message ?? 'No se pudo eliminar al amigo', 'error');
      }
    });
  }
}
