import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaticPage } from '../../shared/components/static-page';

@Component({
  selector: 'ww-contacto',
  imports: [RouterLink, StaticPage],
  styleUrl: './contacto.scss',
  templateUrl: './contacto.html',
})
export class Contacto {}
