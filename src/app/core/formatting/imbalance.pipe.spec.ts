import { ImbalancePipe } from './imbalance.pipe';

describe('ImbalancePipe', () => {
  const pipe = new ImbalancePipe();

  it('formats the worked example (bid 600 / ask 400 -> 0.20) with a leading plus sign', () => {
    expect(pipe.transform(0.2)).toBe('+0.200');
  });

  it('formats a negative imbalance with a minus sign', () => {
    expect(pipe.transform(-0.2)).toBe('−0.200');
  });

  it('formats exact zero without a sign', () => {
    expect(pipe.transform(0)).toBe('0.000');
  });

  it('renders the unavailable sentinel for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('renders the unavailable sentinel for undefined', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });
});
