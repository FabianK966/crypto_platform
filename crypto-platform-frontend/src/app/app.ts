import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // <-- importieren
import { NavbarComponent } from './components/navbar/navbar';
// PortfolioComponent wird nicht mehr direkt importiert, sondern über Router geladen

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent], // RouterOutlet hinzugefügt
  template: `
    <div class="app-container">
      <app-navbar />
      <main class="main-content">
        <router-outlet></router-outlet>  <!-- Hier werden die gerouteten Komponenten angezeigt -->
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
export class App {}