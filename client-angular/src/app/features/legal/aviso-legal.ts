import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaticPage } from '../../shared/components/static-page';

@Component({
  selector: 'ww-aviso-legal',
  imports: [RouterLink, StaticPage],
  styleUrl: './aviso-legal.scss',
  templateUrl: './aviso-legal.html',
})
export class AvisoLegal {}
