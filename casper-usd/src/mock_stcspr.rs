//! Mock stCSPR Token for Testnet - CEP-18 compatible with faucet
use odra::prelude::*;

const FAUCET_AMOUNT: u64 = 10_000_000_000_000; // 10,000 with 9 decimals

#[odra::module]
pub struct MockStCSPR {
    name: Var<String>,
    symbol: Var<String>,
    decimals: Var<u8>,
    total_supply: Var<u64>,
    balances: Mapping<Address, u64>,
    allowances: Mapping<(Address, Address), u64>,
}

#[odra::module]
impl MockStCSPR {
    pub fn init(&mut self) {
        self.name.set(String::from("Mock Staked CSPR"));
        self.symbol.set(String::from("stCSPR"));
        self.decimals.set(9);
        self.total_supply.set(0);
    }

    /// Faucet - mint 10,000 stCSPR for testing
    pub fn faucet(&mut self) {
        let caller = self.env().caller();
        let balance = self.balances.get(&caller).unwrap_or(0);
        self.balances.set(&caller, balance + FAUCET_AMOUNT);
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply + FAUCET_AMOUNT);
    }

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
        let balance = self.balances.get(&caller).unwrap_or(0);
        assert!(balance >= amount, "Insufficient balance");
        self.balances.set(&caller, balance - amount);
        let to_balance = self.balances.get(&to).unwrap_or(0);
        self.balances.set(&to, to_balance + amount);
    }

    pub fn approve(&mut self, spender: Address, amount: u64) {
        let caller = self.env().caller();
        self.allowances.set(&(caller, spender), amount);
    }

    pub fn transfer_from(&mut self, from: Address, to: Address, amount: u64) {
        let caller = self.env().caller();
        let allowance = self.allowances.get(&(from, caller)).unwrap_or(0);
        assert!(allowance >= amount, "Insufficient allowance");
        let balance = self.balances.get(&from).unwrap_or(0);
        assert!(balance >= amount, "Insufficient balance");
        self.allowances.set(&(from, caller), allowance - amount);
        self.balances.set(&from, balance - amount);
        let to_balance = self.balances.get(&to).unwrap_or(0);
        self.balances.set(&to, to_balance + amount);
    }
}
