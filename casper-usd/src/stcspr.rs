//! stCSPR Token Interface
//! 
//! For testnet: Mock token with faucet
//! For mainnet: Interface to real stCSPR from liquid staking protocol
//! 
//! stCSPR represents staked CSPR that continues earning ~10% APY
//! while being used as collateral in CasperUSD.

use odra::prelude::*;

const FAUCET_AMOUNT: u64 = 10_000_000_000_000; // 10,000 stCSPR
const FAUCET_COOLDOWN: u64 = 3600; // 1 hour

#[odra::module]
pub struct StCSPR {
    name: Var<String>,
    symbol: Var<String>,
    decimals: Var<u8>,
    total_supply: Var<u64>,
    balances: Mapping<Address, u64>,
    allowances: Mapping<(Address, Address), u64>,
    
    // Faucet tracking (testnet only)
    faucet_cooldown: Mapping<Address, u64>,
    
    // Exchange rate tracking (stCSPR appreciates vs CSPR)
    // Starts at 1:1, increases with staking rewards
    exchange_rate: Var<u64>, // stCSPR per CSPR (9 decimals)
    last_rate_update: Var<u64>,
}

#[odra::module]
impl StCSPR {
    pub fn init(&mut self) {
        self.name.set(String::from("Staked CSPR"));
        self.symbol.set(String::from("stCSPR"));
        self.decimals.set(9);
        self.total_supply.set(0);
        self.exchange_rate.set(1_000_000_000); // 1:1 initially
        self.last_rate_update.set(self.env().get_block_time());
    }

    // === TESTNET FAUCET ===

    /// Mint test stCSPR (testnet only)
    pub fn faucet(&mut self) {
        let caller = self.env().caller();
        let now = self.env().get_block_time();
        
        let last_claim = self.faucet_cooldown.get(&caller).unwrap_or(0);
        assert!(now >= last_claim + FAUCET_COOLDOWN, "Faucet cooldown active");
        
        // Mint tokens
        let balance = self.balances.get(&caller).unwrap_or(0);
        self.balances.set(&caller, balance + FAUCET_AMOUNT);
        
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply + FAUCET_AMOUNT);
        
        self.faucet_cooldown.set(&caller, now);
    }

    /// Check faucet cooldown remaining
    pub fn faucet_cooldown_remaining(&self, user: Address) -> u64 {
        let last = self.faucet_cooldown.get(&user).unwrap_or(0);
        let now = self.env().get_block_time();
        
        if now >= last + FAUCET_COOLDOWN {
            0
        } else {
            (last + FAUCET_COOLDOWN) - now
        }
    }

    // === EXCHANGE RATE (Simulates staking rewards) ===

    /// Get current exchange rate (stCSPR appreciates over time)
    pub fn get_exchange_rate(&self) -> u64 {
        let base_rate = self.exchange_rate.get_or_default();
        let last_update = self.last_rate_update.get_or_default();
        let now = self.env().get_block_time();
        
        // ~10% APY = ~0.000000317% per second
        // Simplified: 10% / 31536000 seconds ≈ 0.00000031709
        let elapsed = now - last_update;
        let rate_increase = (base_rate * elapsed * 317) / (1_000_000_000 * 31536);
        
        base_rate + rate_increase
    }

    /// Convert stCSPR to underlying CSPR value
    pub fn get_cspr_value(&self, stcspr_amount: u64) -> u64 {
        let rate = self.get_exchange_rate();
        (stcspr_amount * rate) / 1_000_000_000
    }

    /// Convert CSPR to stCSPR amount
    pub fn get_stcspr_for_cspr(&self, cspr_amount: u64) -> u64 {
        let rate = self.get_exchange_rate();
        (cspr_amount * 1_000_000_000) / rate
    }

    // === CEP-18 STANDARD ===

    pub fn name(&self) -> String {
        self.name.get_or_default()
    }

    pub fn symbol(&self) -> String {
        self.symbol.get_or_default()
    }

    pub fn decimals(&self) -> u8 {
        self.decimals.get_or_default()
    }

    pub fn total_supply(&self) -> u64 {
        self.total_supply.get_or_default()
    }

    pub fn balance_of(&self, address: Address) -> u64 {
        self.balances.get(&address).unwrap_or(0)
    }

    pub fn allowance(&self, owner: Address, spender: Address) -> u64 {
        self.allowances.get(&(owner, spender)).unwrap_or(0)
    }

    pub fn transfer(&mut self, to: Address, amount: u64) {
        let caller = self.env().caller();
        self.internal_transfer(caller, to, amount);
    }

    pub fn approve(&mut self, spender: Address, amount: u64) {
        let caller = self.env().caller();
        self.allowances.set(&(caller, spender), amount);
    }

    pub fn transfer_from(&mut self, from: Address, to: Address, amount: u64) {
        let caller = self.env().caller();
        let allowance = self.allowances.get(&(from, caller)).unwrap_or(0);
        assert!(allowance >= amount, "Insufficient allowance");
        
        self.allowances.set(&(from, caller), allowance - amount);
        self.internal_transfer(from, to, amount);
    }

    fn internal_transfer(&mut self, from: Address, to: Address, amount: u64) {
        let from_balance = self.balances.get(&from).unwrap_or(0);
        assert!(from_balance >= amount, "Insufficient balance");
        
        self.balances.set(&from, from_balance - amount);
        let to_balance = self.balances.get(&to).unwrap_or(0);
        self.balances.set(&to, to_balance + amount);
    }
}
