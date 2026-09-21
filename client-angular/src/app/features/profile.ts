import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AvatarOptions, IUserPublic } from '@shared-types';
import { DEFAULT_AVATAR } from '@shared-types';
import { Auth } from '../core/services/auth';
import { Profile as ProfileService } from '../core/services/profile';
import { eloTier } from '../core/models/elo-tier';
import { Toast } from '../shared/services/toast';
import { WwAvatar } from '../shared/components/ww-avatar';
import { WwTierBadge } from '../shared/components/ww-tier-badge';
import { WwRankEmblem } from '../shared/components/ww-rank-emblem';
import { AvatarEditor } from '../shared/components/avatar-editor';

@Component({
  selector: 'ww-profile',
  imports: [ReactiveFormsModule, RouterLink, WwAvatar, WwTierBadge, WwRankEmblem, AvatarEditor],
  styleUrl: './profile.scss',
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  private readonly auth = inject(Auth);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(Toast);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Id del amigo cuyo perfil se mira (ruta /profile/:userId); null en el perfil propio. */
  private readonly friendId = signal<string | null>(null);
  private readonly friendProfile = signal<IUserPublic | null>(null);
  /** Perfil de otra persona: solo lectura, sin editar. */
  protected readonly viewingFriend = computed(() => {
    const id = this.friendId();
    return id !== null && id !== this.auth.getUserId();
  });

  protected readonly user = computed(() => (this.viewingFriend() ? this.friendProfile() : this.auth.currentUser()));
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
    // Por la ruta y no por su instantánea: ir del perfil de un amigo al de otro reutiliza
    // este mismo componente, y solo cambia el parámetro.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.load(params.get('userId')));
  }

  private load(userId: string | null): void {
    this.friendId.set(userId);
    this.friendProfile.set(null);
    this.editing.set(false);

    if (!this.viewingFriend()) {
      this.profileService.refresh().subscribe();
      return;
    }

    this.profileService.getUserProfile(userId!).subscribe((result) => {
      if (this.friendId() !== userId) return; // ya se navegó a otro perfil
      if (result.success && result.data) {
        this.friendProfile.set(result.data);
      } else {
        this.toast.show(result.message ?? 'No se pudo cargar el perfil', 'error');
        this.router.navigateByUrl('/menu');
      }
    });
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
