import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** First character must be A–Z. */
export function startsWithCapital(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) return null;                       // الفاضي بيتعامل معاه required
    return /^[A-Z]/.test(value) ? null : { startsWithCapital: true };
  };
}

/** Like Mona@1234: capital first, a lowercase letter, a number, a symbol, 8+ characters. */
export function strongPassword(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) return null;

    const errors: ValidationErrors = {};
    if (!/^[A-Z]/.test(value))        errors['startsWithCapital'] = true;
    if (!/[a-z]/.test(value))         errors['lowercase'] = true;
    if (!/\d/.test(value))            errors['number'] = true;
    if (!/[^A-Za-z0-9]/.test(value))  errors['special'] = true;
    if (value.length < 8)             errors['minLength'] = true;

    return Object.keys(errors).length ? errors : null;
  };
}