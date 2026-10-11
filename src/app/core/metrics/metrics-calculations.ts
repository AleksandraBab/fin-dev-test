import { createInitialMetrics, type DerivedInstrumentMetrics, type InstrumentMetrics } from './models/instrument-metrics.model';
import type { RawMarketRecord } from './models/raw-market-record.model';

/** Decodes the flat Int32Array buffer the worker posts into individual records. */
export function decodeBatch(buffer: ArrayBuffer, strideLength: number): RawMarketRecord[] {
  const view = new Int32Array(buffer);
  const records: RawMarketRecord[] = [];
  for (let offset = 0; offset + strideLength <= view.length; offset += strideLength) {
    records.push({
      instrumentIndex: view[offset],
      priceCents: view[offset + 1],
      tradeQuantity: view[offset + 2],
      bidCents: view[offset + 3],
      askCents: view[offset + 4],
      bidQty: view[offset + 5],
      askQty: view[offset + 6],
    });
  }
  return records;
}

/**
 * Folds one record into an instrument's cumulative metrics. Always
 * overwrites "latest available" fields (price/bid/ask/quantities); always
 * adds `tradeQuantity` — never book quantities — to the running totals, so
 * every generated trade contributes to volume/VWAP exactly once.
 */
export function applyRecord(metrics: InstrumentMetrics, record: RawMarketRecord): InstrumentMetrics {
  return {
    ...metrics,
    lastPriceCents: record.priceCents,
    bidCents: record.bidCents,
    askCents: record.askCents,
    bidQty: record.bidQty,
    askQty: record.askQty,
    cumulativeVolume: metrics.cumulativeVolume + record.tradeQuantity,
    cumulativeNotionalCents:
      metrics.cumulativeNotionalCents + record.priceCents * record.tradeQuantity,
  };
}

/**
 * Applies a whole batch to a metrics map in one pass, returning a new map.
 * Untouched symbols keep their exact previous object reference (via the
 * shallow `new Map(metrics)` copy) — the mechanism that makes instrument
 * isolation structural rather than incidental.
 */
export function applyBatch(
  metrics: ReadonlyMap<string, InstrumentMetrics>,
  records: readonly RawMarketRecord[],
  symbols: readonly string[],
): ReadonlyMap<string, InstrumentMetrics> {
  if (records.length === 0) {
    return metrics;
  }
  const next = new Map(metrics);
  for (const record of records) {
    const symbol = symbols[record.instrumentIndex];
    if (symbol === undefined) {
      continue;
    }
    const current = next.get(symbol) ?? createInitialMetrics(symbol);
    next.set(symbol, applyRecord(current, record));
  }
  return next;
}

export function deriveMetrics(metrics: InstrumentMetrics): DerivedInstrumentMetrics {
  const spreadCents =
    metrics.bidCents !== null && metrics.askCents !== null
      ? metrics.askCents - metrics.bidCents
      : null;

  const vwapCents =
    metrics.cumulativeVolume > 0 ? metrics.cumulativeNotionalCents / metrics.cumulativeVolume : null;

  const bookTotal =
    metrics.bidQty !== null && metrics.askQty !== null ? metrics.bidQty + metrics.askQty : null;
  const imbalance =
    metrics.bidQty !== null && metrics.askQty !== null && bookTotal !== null && bookTotal > 0
      ? (metrics.bidQty - metrics.askQty) / bookTotal
      : null;

  return { ...metrics, spreadCents, vwapCents, imbalance };
}
