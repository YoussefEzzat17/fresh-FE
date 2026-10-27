import { Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SignInError, SignInRequest } from '../../../../core/theme/auth/auth.models';
import { strongPassword } from '../../../../core/theme/validators/auth.validator';
type Field = 'username' | 'password';

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
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, strongPassword()]],
  });

private messages: Record<'username' | 'password', { key: string; text: string }[]> = {
  username: [
    { key: 'required',          text: 'Please enter your username.' },
    { key: 'minlength',         text: 'Please enter correct username.' },
    { key: 'startsWithCapital', text: 'Please enter correct username.' },
  ],
  password: [
    { key: 'required',          text: 'Please enter your password.' },
    { key: 'startsWithCapital', text: 'Please enter correct password.' },
    { key: 'lowercase',         text: 'Please enter correct password.' },
    { key: 'number',            text: 'Please enter correct password.' },
    { key: 'special',           text: 'Please enter correct password.' },
    { key: 'minLength',         text: 'Please enter correct password.' },
  ],
};

errorFor(name: 'username' | 'password'): string | null {
  if (!this.invalid(name)) return null;
  return this.messages[name].find(m => this.has(name, m.key))?.text ?? null;
}


  invalid(name: 'username' | 'password') {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
  has(name: Field, error: string) {
    return this.form.controls[name].hasError(error);
  }
  

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit(this.form.getRawValue());
  }
}