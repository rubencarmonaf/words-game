import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaticPage } from '../../shared/components/static-page';

@Component({
  selector: 'ww-privacidad',
  imports: [RouterLink, StaticPage],
  styleUrl: './privacidad.scss',
  templateUrl: './privacidad.html',
})
export class Privacidad {}
