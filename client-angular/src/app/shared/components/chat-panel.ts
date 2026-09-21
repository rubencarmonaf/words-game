import { Component, ElementRef, ViewChild, computed, effect, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Friends } from '../../core/services/friends';
import { Lobby } from '../../core/services/lobby';
import { Messages } from '../../core/services/messages';
import { WwAvatar } from './ww-avatar';

/** Panel de chat flotante, aparte del widget de amigos pero en la misma
 * ventana/pestaña — se abre a su izquierda cuando hay un hilo activo
 * (Messages.activeFriendId), como los "chat heads" de Messenger, en vez de
 * abrir una ventana de navegador de verdad. La identidad del amigo (nombre,
 * avatar, en línea) se lee de Friends por ese id — una sola fuente de verdad,
 * siempre al día con la presencia en vivo, en vez de una copia propia. */
@Component({
  selector: 'ww-chat-panel',
  imports: [ReactiveFormsModule, WwAvatar],
  styleUrl: './chat-panel.scss',
  templateUrl: './chat-panel.html',
})
export class ChatPanel {
  private readonly auth = inject(Auth);
  private readonly friendsService = inject(Friends);
  private readonly messagesService = inject(Messages);
  private readonly router = inject(Router);
  private readonly lobbyService = inject(Lobby);

  @ViewChild('chatScroll') private chatScroll?: ElementRef<HTMLDivElement>;

  protected readonly myUserId = this.auth.getUserId();
  protected readonly messages = this.messagesService.messages;
  protected readonly chatControl = new FormControl('', { nonNullable: true });
  protected readonly currentLobbyId = this.lobbyService.lobbyId;

  protected readonly activeFriend = computed(() => {
    const id = this.messagesService.activeFriendId();
    return id ? (this.friendsService.friends().find((f) => f.id === id) ?? null) : null;
  });

  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => {
        const el = this.chatScroll?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  protected close(): void {
    this.messagesService.closeThread();
    this.chatControl.setValue('');
  }

  /** Abre el perfil (stats) del amigo. En pantallas estrechas el chat ocupa toda la pantalla
   * y taparía el perfil, así que ahí se cierra; en pantallas anchas queda abierto al lado. */
  protected viewProfile(friendId: string): void {
    if (window.matchMedia?.('(max-width: 820px)').matches) this.close();
    this.router.navigateByUrl(`/profile/${friendId}`);
  }

  /** Acepta una invitación del chat: la pantalla del lobby se une a él
   * por el id de la ruta (igual que el botón del aviso emergente). */
  protected joinLobby(lobbyId: string): void {
    this.router.navigateByUrl(`/lobby/${lobbyId}`);
  }

  protected sendMessage(): void {
    this.messagesService.send(this.chatControl.value);
    this.chatControl.setValue('');
  }
}
