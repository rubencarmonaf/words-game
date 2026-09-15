import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaticPage } from '../../shared/components/static-page';

@Component({
  selector: 'ww-cookies',
  imports: [RouterLink, StaticPage],
  styleUrl: './cookies.scss',
  templateUrl: './cookies.html',
})
export class Cookies {}
