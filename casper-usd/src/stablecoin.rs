//! CasperUSD (cUSD) Stablecoin Token
//! 
//! CEP-18 compatible stablecoin with controlled minting.
//! Only the TroveManager can mint/burn tokens.

use odra::prelude::*;

#[odra::module]
pub struct CasperUSD {
    name: Var<String>,
    symbol: Var<String>,
    decimals: Var<u8>,
    total_supply: Var<u64>,
    balances: Mapping<Address, u64>,
    allowances: Mapping<(Address, Address), u64>,
    // Authorized minters (TroveManager, StabilityPool)
    minters: Mapping<Address, bool>,
    owner: Var<Address>,
}

#[odra::module]
impl CasperUSD {
    pub fn init(&mut self) {
        let caller = self.env().caller();
        self.name.set(String::from("CasperUSD"));
        self.symbol.set(String::from("cUSD"));
        self.decimals.set(9);
        self.total_supply.set(0);
        self.owner.set(caller);
        self.minters.set(&caller, true); // Owner is initial minter
    }

    /// Add authorized minter (TroveManager, StabilityPool)
    pub fn add_minter(&mut self, minter: Address) {
        self.only_owner();
        self.minters.set(&minter, true);
    }

    /// Remove minter
    pub fn remove_minter(&mut self, minter: Address) {
        self.only_owner();
        self.minters.set(&minter, false);
    }

    /// Mint new cUSD - only authorized minters
    pub fn mint(&mut self, to: Address, amount: u64) {
        let caller = self.env().caller();
        assert!(self.minters.get(&caller).unwrap_or(false), "Not authorized minter");
        
        let balance = self.balances.get(&to).unwrap_or(0);
        self.balances.set(&to, balance + amount);
        
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply + amount);
    }

    /// Burn cUSD - only authorized minters
    pub fn burn(&mut self, from: Address, amount: u64) {
        let caller = self.env().caller();
        assert!(self.minters.get(&caller).unwrap_or(false), "Not authorized minter");
        
        let balance = self.balances.get(&from).unwrap_or(0);
        assert!(balance >= amount, "Insufficient balance to burn");
        self.balances.set(&from, balance - amount);
        
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply - amount);
    }

    // === CEP-18 Standard Functions ===

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

    fn only_owner(&self) {
        assert!(self.env().caller() == self.owner.get().unwrap(), "Only owner");
    }
}
