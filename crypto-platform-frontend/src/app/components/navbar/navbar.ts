import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    BadgeModule,
    AvatarModule,
    RippleModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent {
  menuItems: MenuItem[] = [
    {
      label: 'Portfolio',
      routerLink: '/portfolio',
      routerLinkActiveOptions: { exact: true }
    },
    {
      label: 'Markets',
      routerLink: '/markets'
    },
    {
      label: 'ReplayManuell',
      routerLink: '/replay'
    },
    {
      label: 'ReplayStrategy',
      routerLink: '/replay_copy'
    }
  ];

  constructor(private router: Router) { }
}
