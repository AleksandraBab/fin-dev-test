//! Wasm-facing surface for the market data producer.
//!
//! Intentionally thin: all generation logic lives in `engine` (plain Rust,
//! covered by `cargo test`, zero `wasm_bindgen` imports). This module is the
//! only place that touches `wasm_bindgen` and is a direct pass-through, so it
//! has nothing worth unit-testing in isolation.

mod engine;
mod rng;

use engine::Engine;
use wasm_bindgen::prelude::*;

/// A running market-data producer for a fixed set of instruments.
///
/// `seed` is supplied by the JS caller (e.g. `Date.now()`) rather than
/// sourced from inside Rust: this simulation has no requirement for
/// cryptographic entropy, and letting JS own entropy sourcing keeps the Wasm
/// module free of the `getrandom` JS-interop machinery while still letting
/// every real run look different. Tests exercise `engine::Engine` directly
/// with fixed seeds instead of going through this constructor.
#[wasm_bindgen]
pub struct Producer {
    engine: Engine,
}

#[wasm_bindgen]
impl Producer {
    #[wasm_bindgen(constructor)]
    pub fn new(instrument_count: u32, seed: u64) -> Producer {
        Producer {
            engine: Engine::new(instrument_count, seed),
        }
    }

    /// Returns a flat `Int32Array` with `count * record_stride()` elements —
    /// see `engine::RECORD_STRIDE` for the per-record field layout.
    pub fn generate_batch(&mut self, count: u32) -> Vec<i32> {
        self.engine.generate_batch(count)
    }

    /// Instrument symbols in index order, matching the `instrumentIndex`
    /// field of each generated record. Intended to be called once per run
    /// (after construction), not per batch.
    pub fn instrument_symbols(&self) -> Vec<String> {
        self.engine.symbols()
    }
}

/// Number of i32 fields per generated record, so JS never hardcodes it.
#[wasm_bindgen]
pub fn record_stride() -> u32 {
    engine::RECORD_STRIDE as u32
}
