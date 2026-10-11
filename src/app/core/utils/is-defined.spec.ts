import { isDefined } from './is-defined';

describe('isDefined', () => {
  it('returns false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });

  it('returns true for 0 (a falsy but defined value)', () => {
    expect(isDefined(0)).toBe(true);
  });

  it('returns true for a non-nullish value', () => {
    expect(isDefined('ALFA')).toBe(true);
  });
});
