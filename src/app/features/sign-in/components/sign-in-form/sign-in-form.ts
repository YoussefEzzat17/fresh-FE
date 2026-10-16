import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SignInError, SignInRequest } from '../../../../core/theme/auth/auth.models';

@Component({
  selector: 'app-sign-in-form',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in-form.html',
  host: { class: 'block' },
})
export class SignInForm {
  loading = input(false);
  error = input<SignInError>(null);
  submitted = output<SignInRequest>();

  showPassword = signal(false);

  form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });


  invalid(name: 'username' | 'password') {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue());
  }
}