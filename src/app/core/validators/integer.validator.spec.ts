import { FormControl } from '@angular/forms';

import { integerValidator } from './integer.validator';

describe('integerValidator', () => {
  it('passes a whole number', () => {
    expect(integerValidator(new FormControl(5))).toBeNull();
  });

  it('rejects a fractional number', () => {
    expect(integerValidator(new FormControl(2.5))).toEqual({ integer: true });
  });

  it('passes null (leaves "required" to reject empty values)', () => {
    expect(integerValidator(new FormControl(null))).toBeNull();
  });
});
