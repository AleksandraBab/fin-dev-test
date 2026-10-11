import type { AbstractControl, ValidationErrors } from '@angular/forms';

/** Rejects non-integer numeric values (e.g. `2.5`). `null` passes through — pair with `Validators.required` to reject empty values. */
export function integerValidator(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  return value === null || Number.isInteger(value) ? null : { integer: true };
}
