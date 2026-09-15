import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { AvatarOptions } from '@shared-types';
import { DEFAULT_AVATAR } from '@shared-types';
import { Auth } from '../core/services/auth';
import { Profile as ProfileService } from '../core/services/profile';
import { eloTier } from '../core/models/elo-tier';
import { Toast } from '../shared/services/toast';
import { WwAvatar } from '../shared/components/ww-avatar';
import { AvatarEditor } from '../shared/components/avatar-editor';

@Component({
  selector: 'ww-profile',
  imports: [ReactiveFormsModule, RouterLink, WwAvatar, AvatarEditor],
  styleUrl: './profile.scss',
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  private readonly auth = inject(Auth);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(Toast);
  private readonly fb = inject(FormBuilder);

  protected readonly user = this.auth.currentUser;
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly draftAvatar = signal<AvatarOptions>({ ...DEFAULT_AVATAR });

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
  });

  protected readonly tier = computed(() => eloTier(this.user()?.elo ?? 0));
  protected readonly tierProgress = computed(() => {
    const t = this.tier();
    const elo = this.user()?.elo ?? 0;
    if (t.max === null) {
      return { fill: 1, label: `${elo} ELO · nivel máximo` };
    }
    const fill = Math.max(0, Math.min(1, (elo - t.min) / (t.max - t.min)));
    return { fill, label: `${elo} ELO · ${t.max - elo} para el siguiente nivel` };
  });

  protected readonly displayedAvatar = computed<AvatarOptions>(
    () => (this.editing() ? this.draftAvatar() : this.user()?.avatar) ?? { ...DEFAULT_AVATAR },
  );

  ngOnInit(): void {
    this.profileService.refresh().subscribe();
  }

  protected startEdit(): void {
    const user = this.user();
    if (!user) return;
    this.form.setValue({ username: user.username });
    this.draftAvatar.set({ ...user.avatar });
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.profileService
      .update({ username: this.form.getRawValue().username, avatar: this.draftAvatar() })
      .subscribe((result) => {
        this.saving.set(false);
        if (result.success) {
          this.editing.set(false);
          this.toast.show('Perfil actualizado', 'success');
        } else {
          this.toast.show(result.message ?? 'Error actualizando el perfil', 'error');
        }
      });
  }
}
