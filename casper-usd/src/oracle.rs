//! TWAP Price Oracle
//! 
//! Manipulation-resistant price feed using time-weighted average prices.

use odra::prelude::*;

const MAX_DEVIATION: u64 = 5; // 5% max deviation
const MAX_STALENESS: u64 = 3600; // 1 hour

#[odra::module]
pub struct PriceOracle {
    owner: Var<Address>,
    current_price: Var<u64>,
    twap_price: Var<u64>,
    last_update: Var<u64>,
    feeders: Mapping<Address, bool>,
}

#[odra::module]
impl PriceOracle {
    pub fn init(&mut self) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.feeders.set(&caller, true);
        self.current_price.set(50_000_000); // $0.05
        self.twap_price.set(50_000_000);
        self.last_update.set(self.env().get_block_time());
    }

    pub fn add_feeder(&mut self, feeder: Address) {
        self.only_owner();
        self.feeders.set(&feeder, true);
    }

    pub fn remove_feeder(&mut self, feeder: Address) {
        self.only_owner();
        self.feeders.set(&feeder, false);
    }

    /// Update price with deviation check
    pub fn update_price(&mut self, new_price: u64) {
        let caller = self.env().caller();
        assert!(self.feeders.get(&caller).unwrap_or(false), "Not authorized");
        assert!(new_price > 0, "Price must be positive");

        let twap = self.twap_price.get_or_default();

        // Deviation check
        if twap > 0 {
            let deviation = if new_price > twap {
                ((new_price - twap) * 100) / twap
            } else {
                ((twap - new_price) * 100) / twap
            };
            assert!(deviation <= MAX_DEVIATION, "Deviation too high");
        }

        // Simple TWAP: weighted average of old and new
        let new_twap = (twap * 9 + new_price) / 10;
        
        self.twap_price.set(new_twap);
        self.current_price.set(new_price);
        self.last_update.set(self.env().get_block_time());
    }

    pub fn get_price(&self) -> u64 {
        self.check_staleness();
        self.current_price.get_or_default()
    }

    pub fn get_twap_price(&self) -> u64 {
        self.check_staleness();
        self.twap_price.get_or_default()
    }

    pub fn is_stale(&self) -> bool {
        let last = self.last_update.get_or_default();
        let now = self.env().get_block_time();
        now > last + MAX_STALENESS
    }

    pub fn get_last_update(&self) -> u64 {
        self.last_update.get_or_default()
    }

    fn check_staleness(&self) {
        assert!(!self.is_stale(), "Price is stale");
    }

    fn only_owner(&self) {
        assert!(self.env().caller() == self.owner.get().unwrap(), "Only owner");
    }
}
