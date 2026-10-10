//! Minimal deterministic PRNG for the market simulation.
//!
//! Deliberately not the `rand`/`getrandom` crates: `getrandom`'s
//! wasm32-unknown-unknown backend needs a JS-interop feature (pulling in
//! wasm-bindgen ceremony just to source entropy), and this simulation has no
//! requirement for cryptographic-quality randomness — only for determinism,
//! so tests can fix a seed and assert exact behavior. A hand-rolled xorshift64
//! generator (Marsaglia, 2003) is a few lines, has no dependencies, and gives
//! full control over seeding.

pub struct Rng {
    state: u64,
}

impl Rng {
    /// A zero state is a fixed point for xorshift (it would stay zero forever),
    /// so zero seeds are remapped to a fixed nonzero constant.
    pub fn new(seed: u64) -> Self {
        Rng {
            state: if seed == 0 { 0x9E3779B97F4A7C15 } else { seed },
        }
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    pub fn next_u32(&mut self) -> u32 {
        (self.next_u64() >> 32) as u32
    }

    /// Inclusive on both ends.
    pub fn next_i32_in_range(&mut self, min: i32, max: i32) -> i32 {
        debug_assert!(max >= min);
        let span = (max - min + 1) as u32;
        min + (self.next_u32() % span) as i32
    }

    /// Inclusive on both ends.
    pub fn next_u32_in_range(&mut self, min: u32, max: u32) -> u32 {
        debug_assert!(max >= min);
        let span = max - min + 1;
        min + (self.next_u32() % span)
    }

    pub fn next_bool(&mut self) -> bool {
        self.next_u32() & 1 == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_seed_does_not_stay_zero() {
        let mut rng = Rng::new(0);
        assert_ne!(rng.next_u32(), 0);
    }

    #[test]
    fn range_bounds_are_respected() {
        let mut rng = Rng::new(42);
        for _ in 0..10_000 {
            let v = rng.next_i32_in_range(-5, 5);
            assert!((-5..=5).contains(&v));
            let u = rng.next_u32_in_range(1, 500);
            assert!((1..=500).contains(&u));
        }
    }

    #[test]
    fn same_seed_is_deterministic() {
        let mut a = Rng::new(123);
        let mut b = Rng::new(123);
        for _ in 0..100 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
    }
}
