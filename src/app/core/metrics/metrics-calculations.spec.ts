import { createInitialMetrics } from './models/instrument-metrics.model';
import type { RawMarketRecord } from './models/raw-market-record.model';
import { applyBatch, applyRecord, deriveMetrics } from './metrics-calculations';

function record(overrides: Partial<RawMarketRecord>): RawMarketRecord {
  return {
    instrumentIndex: 0,
    priceCents: 0,
    tradeQuantity: 0,
    bidCents: 0,
    askCents: 0,
    bidQty: 0,
    askQty: 0,
    ...overrides,
  };
}

describe('metrics calculations', () => {
  describe('worked example from the spec', () => {
    it('computes last price, volume and VWAP from two trades', () => {
      let metrics = createInitialMetrics('ALFA');
      metrics = applyRecord(metrics, record({ priceCents: 10_000, tradeQuantity: 10 }));
      metrics = applyRecord(metrics, record({ priceCents: 10_200, tradeQuantity: 30 }));

      expect(metrics.lastPriceCents).toBe(10_200);
      expect(metrics.cumulativeVolume).toBe(40);

      const derived = deriveMetrics(metrics);
      expect(derived.vwapCents).toBeCloseTo(10_150, 6); // $101.50
    });

    it('computes spread from bid $101.96 / ask $102.00', () => {
      let metrics = createInitialMetrics('ALFA');
      metrics = applyRecord(metrics, record({ bidCents: 10_196, askCents: 10_200 }));

      expect(deriveMetrics(metrics).spreadCents).toBe(4); // $0.04
    });

    it('computes order-book imbalance from bid qty 600 / ask qty 400', () => {
      let metrics = createInitialMetrics('ALFA');
      metrics = applyRecord(metrics, record({ bidQty: 600, askQty: 400 }));

      expect(deriveMetrics(metrics).imbalance).toBeCloseTo(0.2, 6);
    });
  });

  describe('zero-denominator cases', () => {
    it('shows every derived value as unavailable before any record arrives', () => {
      const derived = deriveMetrics(createInitialMetrics('ALFA'));

      expect(derived.spreadCents).toBeNull();
      expect(derived.vwapCents).toBeNull();
      expect(derived.imbalance).toBeNull();
      expect(derived.cumulativeVolume).toBe(0);
    });

    it('treats zero combined book quantity as unavailable imbalance, independent of volume/VWAP', () => {
      let metrics = createInitialMetrics('ALFA');
      metrics = applyRecord(
        metrics,
        record({ priceCents: 10_000, tradeQuantity: 10, bidQty: 0, askQty: 0 }),
      );

      const derived = deriveMetrics(metrics);
      expect(derived.imbalance).toBeNull();
      expect(derived.vwapCents).toBe(10_000); // volume/VWAP remain computable
      expect(derived.cumulativeVolume).toBe(10);
    });
  });

  describe('isolation between instruments', () => {
    it('never lets one symbol affect another when applying a batch', () => {
      const symbols = ['ALFA', 'BETA', 'GAMMA'];
      const initial = new Map(symbols.map((symbol) => [symbol, createInitialMetrics(symbol)]));
      const untouchedGamma = initial.get('GAMMA')!;

      const batch: RawMarketRecord[] = [
        record({ instrumentIndex: 0, priceCents: 5_000, tradeQuantity: 1 }), // ALFA
        record({ instrumentIndex: 1, priceCents: 9_000, tradeQuantity: 2 }), // BETA
        record({ instrumentIndex: 0, priceCents: 5_100, tradeQuantity: 3 }), // ALFA
      ];

      const updated = applyBatch(initial, batch, symbols);

      expect(updated.get('ALFA')!.cumulativeVolume).toBe(4);
      expect(updated.get('ALFA')!.lastPriceCents).toBe(5_100);
      expect(updated.get('BETA')!.cumulativeVolume).toBe(2);
      expect(updated.get('BETA')!.lastPriceCents).toBe(9_000);

      // GAMMA received no records: its entry must be the exact same
      // object, not just deep-equal, proving nothing touched it.
      expect(updated.get('GAMMA')).toBe(untouchedGamma);
    });

    it('leaves the input map and its untouched entries unmodified (pure function)', () => {
      const symbols = ['ALFA', 'BETA'];
      const initial = new Map(symbols.map((symbol) => [symbol, createInitialMetrics(symbol)]));

      applyBatch(initial, [record({ instrumentIndex: 0, tradeQuantity: 1 })], symbols);

      expect(initial.get('ALFA')!.cumulativeVolume).toBe(0);
    });
  });
});
