import { Component, computed, inject, model, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AvatarOptions } from '@shared-types';
import { Avatar, AvatarCategory } from '../../core/services/avatar';

@Component({
  selector: 'ww-avatar-editor',
  imports: [],
  templateUrl: './avatar-editor.html',
  styleUrl: './avatar-editor.scss',
})
export class AvatarEditor {
  private readonly avatarService = inject(Avatar);
  private readonly sanitizer = inject(DomSanitizer);

  readonly value = model.required<AvatarOptions>();

  protected readonly groups = this.avatarService.groups;
  protected readonly activeGroupKey = signal(this.groups[0].key);

  protected readonly activeFields = computed<AvatarCategory[]>(() => {
    const group = this.groups.find((g) => g.key === this.activeGroupKey())!;
    return group.fields.map(
      (field) => this.avatarService.categories.find((c) => c.field === field)!,
    );
  });

  protected selectGroup(key: string): void {
    this.activeGroupKey.set(key);
  }

  protected select(field: keyof AvatarOptions, val: string): void {
    this.value.update((current) => ({ ...current, [field]: val }));
  }

  protected previewSvg(field: keyof AvatarOptions, val: string) {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.avatarService.renderPreview(this.value(), field, val),
    );
  }
}
