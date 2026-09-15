import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface InvitableFriend {
  username: string;
  online: boolean;
}

/** Ported as-is from client/index.html's lobby-screen: a demo of the lobby UI
 * with a fixed mock friends list. The vanilla version never wired real
 * invites/friends here either (every handler was a TODO) — there's no
 * backend support to build against, so this keeps the same static shape. */
const MOCK_FRIENDS: InvitableFriend[] = [
  { username: 'Amigo1', online: true },
  { username: 'Amigo2', online: false },
];

@Component({
  selector: 'ww-lobby',
  imports: [RouterLink],
  styleUrl: './lobby.scss',
  templateUrl: './lobby.html',
})
export class Lobby {
  protected readonly friends = signal(MOCK_FRIENDS);
  protected readonly invited = signal(new Set<string>());

  protected invite(username: string): void {
    this.invited.update((current) => new Set(current).add(username));
  }

  protected isInvited(username: string): boolean {
    return this.invited().has(username);
  }
}
