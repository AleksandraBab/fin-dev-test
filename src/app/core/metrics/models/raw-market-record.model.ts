/** One decoded market update: a trade plus the instrument's quote snapshot at that moment. */
export interface RawMarketRecord {
  readonly instrumentIndex: number;
  readonly priceCents: number;
  readonly tradeQuantity: number;
  readonly bidCents: number;
  readonly askCents: number;
  readonly bidQty: number;
  readonly askQty: number;
}

/** Field count per record in the flat buffer the worker transfers (kept in sync with `record_stride()` on the Wasm side). */
export const RAW_RECORD_FIELD_COUNT = 7;
