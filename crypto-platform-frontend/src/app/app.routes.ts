import { Routes } from '@angular/router';
import { Markets } from './components/markets/markets';
import { PortfolioComponent } from './components/portfolio/portfolio';
import { ReplayComponent } from './components/replay/replay';
import { ReplayCopyComponent } from './components/replay_copy/replay-strategy';
import { LoginComponent } from './components/login/login';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/portfolio', pathMatch: 'full' },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [authGuard] },
  { path: 'markets', component: Markets, canActivate: [authGuard] },
  { path: 'replay', component: ReplayComponent, canActivate: [authGuard] },
  { path: 'replay_copy', component: ReplayCopyComponent, canActivate: [authGuard] },
];
