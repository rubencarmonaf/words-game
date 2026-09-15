import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../core/services/auth';

@Component({
  imports: [],
  selector: 'ww-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
