import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Every signed-in page goes through here, on every navigation (canActivate + canActivateChild).
 * - No session → /signin.
 * - Access token still valid (15 minutes) → open the page.
 * - Access token expired → ask the server for a new one first. If it refuses
 *   (logged out, or 30 minutes without a refresh), sign out → /signin.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const toSignIn = inject(Router).createUrlTree(['/signin']);

  if (!auth.isSignIn()) return toSignIn;
  if (auth.hasValidAccessToken()) return true;

  return auth.refresh().pipe(
    map(() => true),
    catchError(() => {
      auth.signOut();
      return of(toSignIn);
    }),
  );
};
