import { CentsCurrencyPipe } from './cents-currency.pipe';

describe('CentsCurrencyPipe', () => {
  const pipe = new CentsCurrencyPipe();

  it('converts cents to a formatted dollar amount', () => {
    expect(pipe.transform(10_200)).toBe('$102.00');
  });

  it('renders the unavailable sentinel for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('renders the unavailable sentinel for undefined', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('formats zero as a real amount, not unavailable', () => {
    expect(pipe.transform(0)).toBe('$0.00');
  });

  it('formats a fractional-cent VWAP by rounding only at display time', () => {
    expect(pipe.transform(10_150.333)).toBe('$101.50');
  });
});
