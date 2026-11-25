import { Routes } from '@angular/router';

import { authGuard } from './core/theme/auth/auth.guard';
import { lockedGuard } from './core/theme/auth/locked.guard';
import { guestGuard } from './core/theme/auth/guest.guard';
import { roleGuard } from './core/theme/auth/role.guard';
import { Role } from './core/theme/auth/auth.models';

/** Who may open each page. Matches the sidebar per role in layout/nav-items.ts. */
const AGENT: Role[] = ['agent'];
const GUIDES: Role[] = ['guide', 'reviewer'];
const GUIDE_ONLY: Role[] = ['guide'];

const placeholder = () => import('./features/placeholder/placeholder').then(m => m.Placeholder);

export const routes: Routes = [
  { path: '', redirectTo: 'signin', pathMatch: 'full' },
  { path: 'signin', canActivate: [guestGuard], canDeactivate: [lockedGuard], loadComponent: () => import('./features/sign-in/sign-in').then(m => m.SignIn) },
  {
    // Everything signed-in lives inside the layout; only /signin is outside it.
    path: '', canActivate: [authGuard], canActivateChild: [authGuard, roleGuard],loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    children: [
      { path: 'home', data: { roles: AGENT }, loadComponent: () => import('./features/home/home').then(m => m.Home) },
      { path: 'tickets', data: { roles: AGENT }, loadComponent: () => import('./features/my-tickets/my-tickets').then(m => m.MyTickets) },
      { path: 'tickets/:id', data: { roles: AGENT }, loadComponent: () => import('./features/ticket-workspace/ticket-workspace').then(m => m.TicketWorkspace) },
      { path: 'customer-search', data: { roles: AGENT }, loadComponent: () => import('./features/customer-search/customer-search').then(m => m.CustomerSearch) },
      { path: 'customer-search/:cif', data: { roles: AGENT }, loadComponent: () => import('./features/customer-360/customer-360').then(m => m.Customer360) },
      { path: 'customer-search/:cif/new-ticket', data: { roles: AGENT }, loadComponent: () => import('./features/new-ticket/new-ticket').then(m => m.NewTicket) },
      { path: 'review', loadComponent: placeholder, data: { roles: GUIDES, title: 'Review queue' } },
      { path: 'library', loadComponent: placeholder, data: { roles: GUIDES, title: 'Guide library' } },
      { path: 'triage', loadComponent: placeholder, data: { roles: GUIDES, title: 'Triage' } },
      { path: 'feedback', loadComponent: placeholder, data: { roles: GUIDE_ONLY, title: 'Agent feedback' } },
      { path: 'analytics', loadComponent: placeholder, data: { roles: GUIDES, title: 'Guide analytics' } },
      { path: 'rules', loadComponent: placeholder, data: { roles: GUIDE_ONLY, title: 'Error rules & jobs' } },
      { path: 'audit', loadComponent: placeholder, data: { roles: GUIDES, title: 'Audit log' } },
      { path: 'alerts', loadComponent: placeholder, data: { roles: AGENT, title: 'Notifications' } },
      // A page of another role: roleGuard shows this instead (no roles, so every signed-in user may see it).
      { path: 'forbidden', loadComponent: () => import('./features/forbidden/forbidden').then(m => m.Forbidden) },
      
    ],
  },
  // Any address that matches nothing above → the Not found page (not a silent redirect).
  { path: '**', loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound) },
];
