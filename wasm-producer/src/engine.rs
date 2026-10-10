//! Pure, deterministic market-data generation engine.
//!
//! Everything here is plain Rust with no `wasm_bindgen` imports, so it runs
//! and is tested identically on the host (`cargo test`) and, once compiled
//! through `wasm-bindgen`/`wasm-pack`, inside the browser. The wasm-facing
//! surface in `lib.rs` is a thin, untested pass-through to this module.

use crate::rng::Rng;

/// Number of i32 fields per generated record:
/// [instrumentIndex, priceCents, tradeQuantity, bidCents, askCents, bidQuantity, askQuantity]
pub const RECORD_STRIDE: usize = 7;

const NATO: [&str; 26] = [
    "ALFA", "BETA", "GAMMA", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA", "JULIET",
    "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA", "QUEBEC", "ROMEO", "SIERRA", "TANGO",
    "UNIFORM", "VICTOR", "WHISKEY", "XRAY", "YANKEE", "ZULU",
];

/// Instrument symbol for a zero-based instrument index. Cycles through the
/// NATO phonetic alphabet, then appends a numeric suffix for index >= 26
/// (e.g. index 26 -> "ALFA2").
pub fn symbol_for_index(index: usize) -> String {
    let base = NATO[index % 26];
    let cycle = index / 26;
    if cycle == 0 {
        base.to_string()
    } else {
        format!("{base}{}", cycle + 1)
    }
}

/// A single generated market update: one simulated trade plus the
/// instrument's current bid/ask snapshot.
struct Record {
    trade_price_cents: i64,
    trade_quantity: u32,
    bid_cents: i64,
    ask_cents: i64,
    bid_qty: u32,
    ask_qty: u32,
}

/// Per-instrument state, retained across calls to `Engine::generate_batch`.
struct InstrumentState {
    mid_price_cents: i64,
    half_spread_cents: i64,
    bid_qty: u32,
    ask_qty: u32,
    rng: Rng,
}

const MIN_PRICE_CENTS: i64 = 100; // $1.00 floor keeps prices strictly positive
const MIN_HALF_SPREAD_CENTS: i64 = 2; // >0, so bid < ask always holds structurally
const MAX_HALF_SPREAD_CENTS: i64 = 200;
const MAX_BOOK_QTY: u32 = 5_000;
const START_MID_PRICE_CENTS: i64 = 10_000; // $100.00
const START_HALF_SPREAD_CENTS: i64 = 4; // $0.04 total spread
const START_BOOK_QTY: u32 = 500;

fn clamp_i64_delta(current: i64, delta: i32, min: i64, max: i64) -> i64 {
    (current + delta as i64).clamp(min, max)
}

fn clamp_u32_delta(current: u32, delta: i32, min: u32, max: u32) -> u32 {
    (current as i64 + delta as i64).clamp(min as i64, max as i64) as u32
}

impl InstrumentState {
    fn new(seed: u64) -> Self {
        InstrumentState {
            mid_price_cents: START_MID_PRICE_CENTS,
            half_spread_cents: START_HALF_SPREAD_CENTS,
            bid_qty: START_BOOK_QTY,
            ask_qty: START_BOOK_QTY,
            rng: Rng::new(seed),
        }
    }

    /// Advances this instrument's state by one simulated trade and returns
    /// the resulting record. Prices/quantities evolve from their previous
    /// values (a random walk), rather than being re-randomized independently
    /// on every call.
    fn step(&mut self) -> Record {
        let delta_mid = self.rng.next_i32_in_range(-50, 50);
        self.mid_price_cents =
            clamp_i64_delta(self.mid_price_cents, delta_mid, MIN_PRICE_CENTS, i64::MAX);

        let delta_spread = self.rng.next_i32_in_range(-5, 5);
        self.half_spread_cents = clamp_i64_delta(
            self.half_spread_cents,
            delta_spread,
            MIN_HALF_SPREAD_CENTS,
            MAX_HALF_SPREAD_CENTS,
        );

        let bid_cents = self.mid_price_cents - self.half_spread_cents;
        let ask_cents = self.mid_price_cents + self.half_spread_cents;

        let delta_bid_qty = self.rng.next_i32_in_range(-50, 50);
        self.bid_qty = clamp_u32_delta(self.bid_qty, delta_bid_qty, 0, MAX_BOOK_QTY);
        let delta_ask_qty = self.rng.next_i32_in_range(-50, 50);
        self.ask_qty = clamp_u32_delta(self.ask_qty, delta_ask_qty, 0, MAX_BOOK_QTY);

        // Simplified model: each trade's price is chosen from that update's
        // bid or ask, never independently generated.
        let trade_price_cents = if self.rng.next_bool() { bid_cents } else { ask_cents };
        let trade_quantity = self.rng.next_u32_in_range(1, 500);

        Record {
            trade_price_cents,
            trade_quantity,
            bid_cents,
            ask_cents,
            bid_qty: self.bid_qty,
            ask_qty: self.ask_qty,
        }
    }
}

/// Generates batches of market updates for a fixed set of instruments,
/// retaining per-instrument state between calls.
pub struct Engine {
    instruments: Vec<InstrumentState>,
    /// Running count of updates generated across the engine's lifetime, used
    /// to round-robin which instrument the next update belongs to.
    cursor: usize,
}

impl Engine {
    /// `instrument_count` is clamped to at least 1 so the engine never ends
    /// up with nothing to generate from; callers (the wasm-bindgen surface,
    /// and ultimately the Angular settings form) also validate this
    /// themselves, but the engine does not trust its caller.
    pub fn new(instrument_count: u32, seed: u64) -> Self {
        let count = instrument_count.max(1);
        let instruments = (0..count)
            .map(|i| {
                // Distinct, deterministic sub-seed per instrument so each
                // instrument's price path is structurally independent of the
                // others, not merely statistically likely to differ.
                let sub_seed = seed ^ (i as u64).wrapping_mul(0x9E3779B97F4A7C15);
                InstrumentState::new(sub_seed)
            })
            .collect();
        Engine { instruments, cursor: 0 }
    }

    pub fn symbols(&self) -> Vec<String> {
        (0..self.instruments.len()).map(symbol_for_index).collect()
    }

    /// Generates exactly `count` updates, each a single simulated trade for
    /// one instrument (chosen round-robin), flattened into a fixed-stride
    /// `i32` buffer. No history beyond the current per-instrument state is
    /// retained.
    pub fn generate_batch(&mut self, count: u32) -> Vec<i32> {
        let n = self.instruments.len();
        let mut out = Vec::with_capacity(count as usize * RECORD_STRIDE);
        for _ in 0..count {
            let index = self.cursor % n;
            self.cursor = self.cursor.wrapping_add(1);
            let record = self.instruments[index].step();
            out.push(index as i32);
            out.push(record.trade_price_cents as i32);
            out.push(record.trade_quantity as i32);
            out.push(record.bid_cents as i32);
            out.push(record.ask_cents as i32);
            out.push(record.bid_qty as i32);
            out.push(record.ask_qty as i32);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Decoded {
        instrument_index: i32,
        trade_price_cents: i32,
        trade_quantity: i32,
        bid_cents: i32,
        ask_cents: i32,
        bid_qty: i32,
        ask_qty: i32,
    }

    fn decode(data: &[i32]) -> Vec<Decoded> {
        assert_eq!(data.len() % RECORD_STRIDE, 0);
        data.chunks_exact(RECORD_STRIDE)
            .map(|c| Decoded {
                instrument_index: c[0],
                trade_price_cents: c[1],
                trade_quantity: c[2],
                bid_cents: c[3],
                ask_cents: c[4],
                bid_qty: c[5],
                ask_qty: c[6],
            })
            .collect()
    }

    #[test]
    fn symbol_naming_matches_spec_example() {
        assert_eq!(symbol_for_index(0), "ALFA");
        assert_eq!(symbol_for_index(1), "BETA");
        assert_eq!(symbol_for_index(25), "ZULU");
        assert_eq!(symbol_for_index(26), "ALFA2");
        assert_eq!(symbol_for_index(27), "BETA2");
    }

    #[test]
    fn batch_size_matches_request_for_various_sizes() {
        let mut engine = Engine::new(5, 42);
        for &n in &[0u32, 1, 7, 1000] {
            let batch = engine.generate_batch(n);
            assert_eq!(batch.len(), n as usize * RECORD_STRIDE);
        }
    }

    #[test]
    fn generated_values_are_always_valid() {
        let mut engine = Engine::new(5, 42);
        let batch = engine.generate_batch(5_000);
        for rec in decode(&batch) {
            assert!(rec.trade_price_cents > 0, "trade price must be positive");
            assert!(rec.bid_cents > 0, "bid must be positive");
            assert!(rec.ask_cents > 0, "ask must be positive");
            assert!(rec.bid_cents < rec.ask_cents, "bid must be strictly below ask");
            assert!(rec.trade_quantity > 0, "trade quantity must be positive");
            assert!(rec.bid_qty >= 0, "book quantity must be nonnegative");
            assert!(rec.ask_qty >= 0, "book quantity must be nonnegative");
            assert!(
                rec.trade_price_cents == rec.bid_cents || rec.trade_price_cents == rec.ask_cents,
                "trade price must be chosen from that update's bid or ask"
            );
            assert!((0..5).contains(&rec.instrument_index));
        }
    }

    #[test]
    fn prices_evolve_from_previous_value_not_independently_each_call() {
        // A single instrument so every record belongs to the same state
        // machine; consecutive bid prices must stay within the fixed
        // per-step maximum delta (|delta_mid| + |delta_spread| <= 55).
        // Independently re-randomizing every call would have no such bound.
        let mut engine = Engine::new(1, 7);
        let batch = engine.generate_batch(2_000);
        let records = decode(&batch);
        for pair in records.windows(2) {
            let diff = (pair[1].bid_cents - pair[0].bid_cents).abs();
            assert!(diff <= 55, "bid moved {diff} cents in one step, exceeding the max step size");
        }
    }

    #[test]
    fn instruments_are_isolated_from_each_other() {
        // Different instruments must follow structurally independent price
        // paths (distinct per-instrument RNG sub-seeds), not just happen to
        // differ by chance.
        let mut engine = Engine::new(3, 99);
        let batch = engine.generate_batch(300);
        let records = decode(&batch);

        let prices_for = |idx: i32| -> Vec<i32> {
            records
                .iter()
                .filter(|r| r.instrument_index == idx)
                .map(|r| r.trade_price_cents)
                .collect()
        };

        let prices_0 = prices_for(0);
        let prices_1 = prices_for(1);
        let prices_2 = prices_for(2);

        assert!(!prices_0.is_empty() && !prices_1.is_empty() && !prices_2.is_empty());
        assert_ne!(prices_0, prices_1);
        assert_ne!(prices_1, prices_2);
        assert_ne!(prices_0, prices_2);
    }

    #[test]
    fn round_robin_distributes_updates_across_instruments() {
        let mut engine = Engine::new(4, 1);
        let batch = engine.generate_batch(8);
        let indices: Vec<i32> = decode(&batch).iter().map(|r| r.instrument_index).collect();
        assert_eq!(indices, vec![0, 1, 2, 3, 0, 1, 2, 3]);
    }

    #[test]
    fn state_persists_across_separate_generate_batch_calls() {
        let mut a = Engine::new(1, 55);
        let first = a.generate_batch(10);
        let second = a.generate_batch(10);

        // A fresh engine replaying the same 20 steps in one call must match
        // the two-call engine exactly, proving no state is lost/reset
        // between calls.
        let mut b = Engine::new(1, 55);
        let combined = b.generate_batch(20);

        let mut expected = first;
        expected.extend(second);
        assert_eq!(expected, combined);
    }
}
