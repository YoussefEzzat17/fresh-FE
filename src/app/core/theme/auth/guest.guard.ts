import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ROLE_HOME } from './role-home';

/** The sign-in page is for signed-out users only: a signed-in user goes to their home page instead. */
export const guestGuard: CanActivateFn = () => {
  const user = inject(AuthService).user();
  return user ? inject(Router).createUrlTree([ROLE_HOME[user.role]]) : true;
};
