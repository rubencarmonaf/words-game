import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/services/auth';
import { Profile } from '../core/services/profile';
import { DailyChallenge } from '../core/services/daily-challenge';
import { Socket } from '../core/services/socket';
import { eloTier } from '../core/models/elo-tier';
import { WwAvatar } from '../shared/components/ww-avatar';

@Component({
  imports: [RouterLink, WwAvatar],
  selector: 'ww-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly profileService = inject(Profile);
  private readonly dailyChallenge = inject(DailyChallenge);
  private readonly socket = inject(Socket);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly tier = computed(() => eloTier(this.user()?.elo ?? 0));

  protected readonly dailyStatus = this.dailyChallenge.status;
  protected readonly dailyCountdown = signal<number | null>(null);
  protected readonly dailyCountdownDisplay = computed(() => {
    const seconds = this.dailyCountdown();
    if (seconds === null) return '--:--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.profileService.refresh().subscribe();
    this.dailyChallenge.refresh().subscribe((result) => {
      if (result.success && result.data?.isCompleted) {
        this.startDailyCountdown(result.data.timeUntilNext.totalSeconds);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  protected logout(): void {
    // Auth.logout() solo borra el token; sin esto el socket seguía vivo en
    // el servidor y los amigos te veían "En línea" indefinidamente tras
    // cerrar sesión, porque nadie le avisaba al socket de que la sesión terminó.
    this.socket.disconnect();
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }

  private startDailyCountdown(totalSeconds: number): void {
    this.dailyCountdown.set(totalSeconds);
    this.countdownTimer = setInterval(() => {
      const next = (this.dailyCountdown() ?? 1) - 1;
      if (next <= 0) {
        this.clearCountdown();
        this.dailyChallenge.refresh().subscribe((result) => {
          if (result.success && result.data?.isCompleted) {
            this.startDailyCountdown(result.data.timeUntilNext.totalSeconds);
          } else {
            this.dailyCountdown.set(null);
          }
        });
        return;
      }
      this.dailyCountdown.set(next);
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
