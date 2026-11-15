import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';


let refreshing$: Observable<string> | null = null;

const isAuthEndpoint = (url: string) =>
  url.includes('/api/auth/login') || url.includes('/api/auth/refresh');

const withToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/') || isAuthEndpoint(req.url)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.accessToken();
  return next(token ? withToken(req, token) : req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      refreshing$ ??= auth.refresh().pipe(
        finalize(() => { refreshing$ = null; }),
        shareReplay(1),
      );

      return refreshing$.pipe(
        switchMap(newToken => next(withToken(req, newToken))),
        catchError(refreshErr => {
          auth.signOut();
          router.navigateByUrl('/signin');
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
