import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/theme/auth/auth.service';
import { ROLE_HOME } from '../../core/theme/auth/role-home';
import { SignInError, SignInRequest } from '../../core/theme/auth/auth.models';
import { BrandPanel } from './components/brand-panel/brand-panel';
import { SignInForm } from './components/sign-in-form/sign-in-form';
import { finalize } from 'rxjs';


@Component({
  selector: 'app-sign-in',
  imports: [BrandPanel, SignInForm],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})

export class SignIn {
  private auth = inject(AuthService);
  private router = inject(Router);


  loading = signal(false);
  error = signal<SignInError>(null);


  onSubmit(req: SignInRequest) {
    

    this.loading.set(true);
    this.error.set(null);

    this.auth.SignIn(req)
    .pipe(finalize(() => this.loading.set(false)))
    .subscribe({
      next: user => this.router.navigateByUrl(ROLE_HOME[user.role]),
      error: (err: SignInError) => {
        this.error.set(err);
      },
    });
  }
}