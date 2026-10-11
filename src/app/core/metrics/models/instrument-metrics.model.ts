
export interface InstrumentMetrics {
  readonly symbol: string;
  readonly lastPriceCents: number | null;
  readonly bidCents: number | null;
  readonly askCents: number | null;
  readonly bidQty: number | null;
  readonly askQty: number | null;
  readonly cumulativeVolume: number;
  readonly cumulativeNotionalCents: number;
}

export function createInitialMetrics(symbol: string): InstrumentMetrics {
  return {
    symbol,
    lastPriceCents: null,
    bidCents: null,
    askCents: null,
    bidQty: null,
    askQty: null,
    cumulativeVolume: 0,
    cumulativeNotionalCents: 0,
  };
}

/** `InstrumentMetrics` plus the values derived from it for display. */
export interface DerivedInstrumentMetrics extends InstrumentMetrics {
  readonly spreadCents: number | null;
  readonly vwapCents: number | null;
  readonly imbalance: number | null;
}
