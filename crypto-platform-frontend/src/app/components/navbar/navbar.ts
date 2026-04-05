import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    BadgeModule,
    AvatarModule,
    RippleModule,
    ButtonModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent {
  auth = inject(AuthService);

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

  logout() {
    this.auth.logout();
  }
}
