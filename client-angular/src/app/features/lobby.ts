import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Lobby as LobbyService } from '../core/services/lobby';
import { Friends } from '../core/services/friends';
import { Game as GameService } from '../core/services/game';
import { Auth } from '../core/services/auth';

/** Reemplaza el lobby-demo con amigos/jugadores simulados por uno real:
 * crea/une un lobby de verdad en el servidor (server.ts: lobby:create/join),
 * invita a amigos reales y arranca una partida 'friendly' server-authoritative
 * cuando hay al menos 2 jugadores — ver core/services/lobby.ts. */
@Component({
  selector: 'ww-lobby',
  imports: [RouterLink],
  styleUrl: './lobby.scss',
  templateUrl: './lobby.html',
})
export class Lobby implements OnInit, OnDestroy {
  private readonly lobbyService = inject(LobbyService);
  private readonly friendsService = inject(Friends);
  private readonly game = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  protected readonly players = this.lobbyService.players;
  protected readonly hostId = this.lobbyService.hostId;
  protected readonly isHost = this.lobbyService.isHost;
  protected readonly friends = this.friendsService.friends;
  protected readonly myUserId = this.auth.getUserId();

  protected readonly invitableFriends = computed(() => {
    const inLobby = new Set(this.players().map((p) => p.userId));
    return this.friends().filter((f) => f.online && !inLobby.has(f.id));
  });

  constructor() {
    effect(() => {
      if (this.lobbyService.disbanded()) {
        this.router.navigateByUrl('/menu');
      }
    });
    effect(() => {
      if (this.game.status() === 'active') {
        this.router.navigateByUrl('/play/game');
      }
    });
  }

  ngOnInit(): void {
    this.friendsService.refresh().subscribe();

    const lobbyId = this.route.snapshot.paramMap.get('lobbyId');
    if (lobbyId) {
      this.lobbyService.join(lobbyId);
    } else {
      this.lobbyService.create();
    }
  }

  ngOnDestroy(): void {
    // Salir de la vista no siempre significa abandonar el lobby (p.ej. al
    // navegar a /play/game cuando la partida arranca) — solo lo hacemos
    // explícitamente desde el botón "Salir del Lobby".
  }

  protected invite(username: string): void {
    this.lobbyService.invite(username);
  }

  protected isInvited(username: string): boolean {
    return this.lobbyService.isInvited(username);
  }

  protected startGame(): void {
    this.lobbyService.start();
  }

  protected leaveLobby(): void {
    this.lobbyService.leave();
    this.router.navigateByUrl('/menu');
  }
}
