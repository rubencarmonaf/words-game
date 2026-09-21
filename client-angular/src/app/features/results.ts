import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Game as GameService, GameMode } from '../core/services/game';
import { Lobby as LobbyService } from '../core/services/lobby';
import { eloTier } from '../core/models/elo-tier';
import { WwRankEmblem } from '../shared/components/ww-rank-emblem';

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
  imports: [RouterLink, WwRankEmblem],
  styleUrl: './results.scss',
  templateUrl: './results.html',
})
export class Results implements OnInit, OnDestroy {
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

  /** Solo versus trae ELO. Se anima de before a after una vez que la
   * partida ya se ha leído: tras la secuencia de victoria si se ganó, casi
   * de inmediato si se perdió (no hay nada que celebrar antes). */
  protected readonly elo = computed(() => this.outcome()?.elo ?? null);
  protected readonly eloShown = signal(false);
  protected readonly displayedElo = signal(0);
  protected readonly eloDirection = computed<'up' | 'down' | 'flat'>(() => {
    const change = this.elo()?.change ?? 0;
    return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  });
  protected readonly eloDeltaLabel = computed(() => {
    const e = this.elo();
    if (!e) return '';
    if (e.change > 0) return `+${e.change}`;
    if (e.change < 0) return `−${Math.abs(e.change)}`;
    return '0';
  });
  protected readonly eloNote = computed(() => {
    const e = this.elo();
    if (!e || e.change !== 0) return '';
    return this.won() || e.before > 0 ? 'Sin cambios de ELO' : 'Ya estás en el mínimo';
  });

  /** El emblema sigue al ELO mientras cuenta: cruza el límite de un rango y se
   * cambia en ese instante. */
  protected readonly displayedRankName = computed(() => eloTier(this.displayedElo()).name);
  protected readonly eloSettled = signal(false);
  protected readonly rankChange = computed(() => {
    const e = this.elo();
    if (!e) return null;
    const before = eloTier(e.before);
    const after = eloTier(e.after);
    if (before.name === after.name) return null;
    return {
      direction: e.after > e.before ? ('up' as const) : ('down' as const),
      label: e.after > e.before ? `¡Subes a ${after.name}!` : `Bajas a ${after.name}`,
    };
  });

  private eloDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private eloTween: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const outcome = this.outcome();
    if (!outcome) {
      this.router.navigateByUrl('/menu');
      return;
    }

    if (outcome.won) {
      this.triggerVictorySequence();
    }
    this.revealElo(outcome.won ? 1700 : 500);
  }

  ngOnDestroy(): void {
    if (this.eloDelayTimer !== null) clearTimeout(this.eloDelayTimer);
    if (this.eloTween !== null) clearInterval(this.eloTween);
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

  private revealElo(delayMs: number): void {
    const elo = this.elo();
    if (!elo) return;

    this.displayedElo.set(elo.before);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.displayedElo.set(elo.after);
      this.eloShown.set(true);
      this.eloSettled.set(true);
      return;
    }

    this.eloDelayTimer = setTimeout(() => {
      this.eloShown.set(true);
      const started = Date.now();
      const duration = 1000;
      this.eloTween = setInterval(() => {
        const progress = Math.min(1, (Date.now() - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.displayedElo.set(Math.round(elo.before + (elo.after - elo.before) * eased));
        if (progress >= 1 && this.eloTween !== null) {
          clearInterval(this.eloTween);
          this.eloTween = null;
          this.eloSettled.set(true);
        }
      }, 32);
    }, delayMs);
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
