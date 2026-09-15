import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaticPage } from '../shared/components/static-page';

@Component({
  selector: 'ww-not-found',
  imports: [RouterLink, StaticPage],
  styleUrl: './not-found.scss',
  templateUrl: './not-found.html',
})
export class NotFound {}
