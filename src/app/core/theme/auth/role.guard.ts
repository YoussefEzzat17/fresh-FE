import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './auth.models';

/**
 * Lets a page open only for the roles in its route `data.roles`.
 * - Signed out → /signin.
 * - Wrong role → the "Not available for your role" page. The address bar keeps what was typed
 *   (skipLocationChange), so the user sees which address was refused.
 * - No `roles` on the route → anyone signed in.
 * This only guards the screens; the server still refuses the data with 403 for the wrong role.
 */
export const roleGuard: CanActivateFn = route => {
  const router = inject(Router);
  const user = inject(AuthService).user();
  if (!user) return router.createUrlTree(['/signin']);

  const roles = route.data['roles'] as Role[] | undefined;
  if (!roles || roles.includes(user.role)) return true;

  return new RedirectCommand(router.createUrlTree(['/forbidden']), { skipLocationChange: true });
};
