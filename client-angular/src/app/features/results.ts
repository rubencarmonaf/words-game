import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Game as GameService, GameMode } from '../core/services/game';
import { Lobby as LobbyService } from '../core/services/lobby';

interface VictoryParticle {
  shape: 'dot' | 'dash';
  color: 'scarlet' | 'cobalt' | 'amber' | 'lime';
  dx: number;
  dy: number;
  delay: number;
}

const PARTICLE_COLORS: VictoryParticle['color'][] = ['scarlet', 'cobalt', 'amber', 'lime'];
const PARTICLE_SHAPES: VictoryParticle['shape'][] = ['dot', 'dash'];
const FLAP_CELLS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Momento de llegada a la terminal: la línea se dibuja hasta un roundel, el
 * marcador gira como un panel de salidas y caen partículas con las formas
 * del propio sistema (roundels/paradas). Ported from UI.playVictorySequence. */
@Component({
  selector: 'ww-results',
  imports: [RouterLink],
  styleUrl: './results.scss',
  templateUrl: './results.html',
})
export class Results implements OnInit {
  private readonly game = inject(GameService);
  private readonly lobbyService = inject(LobbyService);
  private readonly router = inject(Router);

  protected readonly flapCells = FLAP_CELLS;
  protected readonly outcome = this.game.outcome;
  protected readonly won = computed(() => this.outcome()?.won ?? false);
  protected readonly finalScore = computed(() => {
    const results = this.outcome()?.results;
    if (!results) return 0;
    return results.type === 'solo' ? results.totalWords : (results.players[0]?.score ?? 0);
  });
  protected readonly digits = computed(() => String(this.finalScore()).padStart(2, '0').split('').map(Number));

  protected readonly roundelLit = signal(false);
  protected readonly revealedCount = signal(0);
  protected readonly particles = signal<VictoryParticle[]>([]);

  ngOnInit(): void {
    const outcome = this.outcome();
    if (!outcome) {
      this.router.navigateByUrl('/menu');
      return;
    }

    if (outcome.won) {
      this.triggerVictorySequence();
    }
  }

  protected playAgain(): void {
    const mode: GameMode = this.game.mode();
    // gameId se pierde en reset() — capturarlo antes de pedir la revancha,
    // ya que el servidor lo usa para encontrar/crear el lobby compartido
    // (ver Lobby.rematch) y devolver a todo el grupo original al mismo sitio.
    const gameId = this.game.gameId();
    this.game.reset();

    if (mode === 'versus') {
      this.router.navigateByUrl('/play/matchmaking');
    } else if (mode === 'lobby' && gameId) {
      this.lobbyService.rematch(gameId);
    } else if (mode === 'lobby') {
      this.router.navigateByUrl('/lobby');
    } else {
      this.router.navigateByUrl(`/play/setup/${mode}`);
    }
  }

  private triggerVictorySequence(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.roundelLit.set(true);
      this.revealedCount.set(this.digits().length);
      return;
    }

    setTimeout(() => {
      this.roundelLit.set(true);
      this.digits().forEach((_, i) => {
        setTimeout(() => this.revealedCount.update((c) => c + 1), i * 90);
      });
      this.spawnParticles();
    }, 650);
  }

  private spawnParticles(): void {
    const particles: VictoryParticle[] = Array.from({ length: 16 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4;
      const distance = 60 + Math.random() * 70;
      return {
        shape: PARTICLE_SHAPES[i % PARTICLE_SHAPES.length],
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 20,
        delay: Math.random() * 120,
      };
    });

    this.particles.set(particles);
    setTimeout(() => this.particles.set([]), 1400);
  }
}
