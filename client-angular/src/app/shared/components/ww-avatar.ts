import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AvatarOptions } from '@shared-types';
import { Avatar } from '../../core/services/avatar';

@Component({
  selector: 'ww-avatar',
  imports: [],
  templateUrl: './ww-avatar.html',
  styleUrl: './ww-avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WwAvatar {
  private readonly avatarService = inject(Avatar);
  private readonly sanitizer = inject(DomSanitizer);

  readonly options = input.required<AvatarOptions>();
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  // El SVG lo genera DiceBear a partir de opciones ya validadas contra listas
  // cerradas (sanitizeAvatarOptions en el servidor) — nunca contenido de
  // usuario libre, así que confiar en él aquí es seguro.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.avatarService.renderSvg(this.options())),
  );
}
