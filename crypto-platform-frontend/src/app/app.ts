import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  template: `
    <div class="app-container">
      @if (auth.isLoggedIn()) {
        <app-navbar />
      }
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      flex-direction: column;
      display: block;
      position: relative;
      z-index: 1;
    }
    .main-content {
      flex: 1;
      overflow-y: auto;
    }
  `]
})
export class App {
  auth = inject(AuthService);
}
