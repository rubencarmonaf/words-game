import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/services/auth';
import { Profile } from '../core/services/profile';
import { eloTier } from '../core/models/elo-tier';
import { WwAvatar } from '../shared/components/ww-avatar';

@Component({
  imports: [RouterLink, WwAvatar],
  selector: 'ww-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu implements OnInit {
  private readonly auth = inject(Auth);
  private readonly profileService = inject(Profile);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly tier = computed(() => eloTier(this.user()?.elo ?? 0));

  ngOnInit(): void {
    this.profileService.refresh().subscribe();
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
