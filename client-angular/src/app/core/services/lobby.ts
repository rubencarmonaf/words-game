import { Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './auth';
import { Socket } from './socket';
import { Game as GameService } from './game';
import { Toast } from '../../shared/services/toast';

export interface LobbyPlayer {
  userId: string;
  username: string;
}

interface LobbyUpdatePayload {
  lobbyId: string;
  hostId: string;
  players: LobbyPlayer[];
  playerCount: number;
}

interface LobbyInvitedPayload {
  lobbyId: string;
  hostUsername: string;
}

interface LobbyRematchReadyPayload {
  lobbyId: string;
}

/** Estado del lobby "Con amigos", arbitrado por el servidor (ver server.ts:
 * lobby:create/invite/join/leave/start). Reemplaza el mock estático que
 * lobby.ts tenía antes — invitar ahora manda un evento real, y "Comenzar
 * partida" arranca una Game 'lobby' real vía el mismo motor de versus. */
@Service()
export class Lobby {
  private readonly auth = inject(Auth);
  private readonly socket = inject(Socket);
  private readonly game = inject(GameService);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  private readonly lobbyIdSignal = signal<string | null>(null);
  private readonly hostIdSignal = signal<string | null>(null);
  private readonly playersSignal = signal<LobbyPlayer[]>([]);
  private readonly invitedSignal = signal(new Set<string>());
  private readonly disbandedSignal = signal(false);

  readonly lobbyId = this.lobbyIdSignal.asReadonly();
  readonly hostId = this.hostIdSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();
  readonly disbanded = this.disbandedSignal.asReadonly();
  readonly isHost = computed(() => {
    const hostId = this.hostIdSignal();
    return hostId !== null && hostId === this.auth.getUserId();
  });

  constructor() {
    this.socket.on<LobbyUpdatePayload>('lobby:update').subscribe((data) => {
      this.lobbyIdSignal.set(data.lobbyId);
      this.hostIdSignal.set(data.hostId);
      this.playersSignal.set(data.players);
    });

    this.socket.on<LobbyInvitedPayload>('lobby:invited').subscribe((data) => {
      this.toast.show(`${data.hostUsername} te invitó a una partida con amigos`, 'info', {
        label: 'Unirse',
        onClick: () => this.router.navigateByUrl(`/lobby/${data.lobbyId}`),
      });
    });

    this.socket.on<string>('lobby:error').subscribe((message) => this.toast.show(message, 'error'));

    // Respuesta a rematch(): cualquiera de los jugadores originales que pida
    // revancha primero crea el lobby, y este evento le llega a cada quien que
    // lo pida después con ese mismo lobbyId — todos acaban en el mismo sitio
    // sin importar el orden en que pulsen "Jugar de Nuevo".
    this.socket.on<LobbyRematchReadyPayload>('lobby:rematch-ready').subscribe((data) => {
      this.router.navigateByUrl(`/lobby/${data.lobbyId}`);
    });

    this.socket.on<void>('lobby:disbanded').subscribe(() => {
      this.toast.show('El anfitrión cerró el lobby', 'info');
      this.reset();
      this.disbandedSignal.set(true);
    });
  }

  /** Crea un lobby nuevo como anfitrión. */
  create(): void {
    this.reset();
    this.game.setMode('lobby');
    this.socket.connect();
    this.socket.emit('lobby:create');
  }

  /** Se une a un lobby existente tras aceptar una invitación. */
  join(lobbyId: string): void {
    // Aceptar una invitación estando ya en otro lobby: sin salir, el jugador
    // se quedaba a la vez dentro del anterior (y, si era el anfitrión, dejaba
    // ese lobby abierto para siempre).
    const current = this.lobbyIdSignal();
    if (current && current !== lobbyId) this.socket.emit('lobby:leave', { lobbyId: current });

    this.reset();
    this.game.setMode('lobby');
    this.socket.connect();
    this.socket.emit('lobby:join', { lobbyId });
  }

  invite(friendUsername: string): void {
    const lobbyId = this.lobbyIdSignal();
    if (!lobbyId) return;
    this.invitedSignal.update((current) => new Set(current).add(friendUsername));
    this.socket.emit('lobby:invite', { lobbyId, friendUsername });
  }

  isInvited(friendUsername: string): boolean {
    return this.invitedSignal().has(friendUsername);
  }

  leave(): void {
    const lobbyId = this.lobbyIdSignal();
    if (lobbyId) this.socket.emit('lobby:leave', { lobbyId });
    this.reset();
  }

  /** Solo el anfitrión puede arrancar; el servidor valida el mínimo de 2 jugadores. */
  start(): void {
    const lobbyId = this.lobbyIdSignal();
    if (!lobbyId) return;
    this.socket.emit('lobby:start', { lobbyId });
  }

  /** Pide volver al mismo grupo tras una partida "con amigos" ya terminada —
   * responde lobby:rematch-ready (arriba), que navega al lobby compartido. */
  rematch(gameId: string): void {
    this.socket.connect();
    this.socket.emit('lobby:rematch', { gameId });
  }

  private reset(): void {
    this.lobbyIdSignal.set(null);
    this.hostIdSignal.set(null);
    this.playersSignal.set([]);
    this.invitedSignal.set(new Set());
    this.disbandedSignal.set(false);
  }
}
