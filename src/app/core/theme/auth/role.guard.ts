import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './auth.models';
import { ROLE_HOME } from './role-home';

/**
 * Lets a page open only for the roles in its route `data.roles`.
 * Signed out → /signin. Wrong role → that role's home page. No `roles` on the route → anyone signed in.
 * This only guards the screens; the server still refuses the data with 403 for the wrong role.
 */
export const roleGuard: CanActivateFn = route => {
  const router = inject(Router);
  const user = inject(AuthService).user();
  if (!user) return router.createUrlTree(['/signin']);

  const roles = route.data['roles'] as Role[] | undefined;
  return !roles || roles.includes(user.role) ? true : router.createUrlTree([ROLE_HOME[user.role]]);
};
