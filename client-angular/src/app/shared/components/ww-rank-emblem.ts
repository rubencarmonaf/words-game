import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { eloTier } from '../../core/models/elo-tier';

/** Insignia arcade del rango del jugador (Aprendiz … Mítico), derivada de su ELO.
 * Es una ilustración detallada: úsala grande (perfil, pantalla VS, resultados).
 * En tamaños pequeños, junto a un nombre, sigue siendo mejor ww-tier-badge. El
 * tamaño se controla con --ww-emblem-size (por defecto 96px). */
@Component({
  selector: 'ww-rank-emblem',
  imports: [],
  templateUrl: './ww-rank-emblem.html',
  styleUrl: './ww-rank-emblem.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WwRankEmblem {
  readonly elo = input.required<number>();
  protected readonly tier = computed(() => eloTier(this.elo()));
}
