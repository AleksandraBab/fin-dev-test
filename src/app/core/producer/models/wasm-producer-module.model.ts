export interface WasmProducer {
  generate_batch(count: number): Int32Array;
  instrument_symbols(): string[];
  free(): void;
}

export interface WasmProducerModule {
  default: () => Promise<unknown>;
  Producer: new (instrumentCount: number, seed: bigint | number) => WasmProducer;
  record_stride: () => number;
}
