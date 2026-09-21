import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { eloTier } from '../../core/models/elo-tier';

/** Nivel del jugador (Aprendiz … Mítico, ver ELO_TIERS) derivado de su ELO. */
@Component({
  selector: 'ww-tier-badge',
  imports: [],
  templateUrl: './ww-tier-badge.html',
  styleUrl: './ww-tier-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WwTierBadge {
  readonly elo = input.required<number>();
  protected readonly tier = computed(() => eloTier(this.elo()));
}
