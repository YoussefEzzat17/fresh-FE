import { Routes } from '@angular/router';

import { authGuard } from './core/theme/auth/auth.guard';
import { CustomerSearch } from './features/customer-search/customer-search';

const placeholder = () => import('./features/placeholder/placeholder').then(m => m.Placeholder);

export const routes: Routes = [
  { path: '', redirectTo: 'signin', pathMatch: 'full' },
  { path: 'signin', loadComponent: () => import('./features/sign-in/sign-in').then(m => m.SignIn) },
  {
    // Everything signed-in lives inside the layout; only /signin is outside it.
    path: '',canActivate: [authGuard],loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    children: [
      { path: 'home', loadComponent: placeholder, data: { title: 'Home' } },
      { path: 'tickets', loadComponent: placeholder, data: { title: 'My tickets' } },
      { path: 'customer-search', component: CustomerSearch },
      { path: 'review', loadComponent: placeholder, data: { title: 'Review queue' } },
      { path: 'library', loadComponent: placeholder, data: { title: 'Guide library' } },
      { path: 'triage', loadComponent: placeholder, data: { title: 'Triage' } },
      { path: 'feedback', loadComponent: placeholder, data: { title: 'Agent feedback' } },
      { path: 'analytics', loadComponent: placeholder, data: { title: 'Guide analytics' } },
      { path: 'rules', loadComponent: placeholder, data: { title: 'Error rules & jobs' } },
      { path: 'audit', loadComponent: placeholder, data: { title: 'Audit log' } },
      { path: 'alerts', loadComponent: placeholder, data: { title: 'Notifications' } },
      
    ],
  },
  { path: '**', redirectTo: 'signin' },
];
