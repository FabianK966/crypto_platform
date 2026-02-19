import { Routes } from '@angular/router';
import { Markets } from './components/markets/markets'; 
import { PortfolioComponent } from './components/portfolio/portfolio'; 
import { ReplayComponent } from './components/replay/replay';


export const routes: Routes = [
  { path: '', redirectTo: '/portfolio', pathMatch: 'full' }, // Standardroute auf Portfolio
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'markets', component: Markets },
  { path: 'replay', component: ReplayComponent },
];