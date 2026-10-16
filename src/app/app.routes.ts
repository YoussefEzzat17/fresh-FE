import { Routes } from '@angular/router';



export const routes: Routes = [
  { path: '', redirectTo: 'signin', pathMatch: 'full' },
  {
    path: 'signin',
    loadComponent: () =>
      import('./features/sign-in/sign-in').then(m => m.SignIn),
  },
  { path: '**', redirectTo: 'signin' },
];