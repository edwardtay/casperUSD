//! CasperUSD (cUSD) Stablecoin - CEP-18 compatible
use odra::prelude::*;

#[odra::module]
pub struct CasperUSD {
    name: Var<String>,
    symbol: Var<String>,
    decimals: Var<u8>,
    total_supply: Var<u64>,
    balances: Mapping<Address, u64>,
    allowances: Mapping<(Address, Address), u64>,
    minter: Var<Address>, // Vault contract
}

#[odra::module]
impl CasperUSD {
    pub fn init(&mut self) {
        self.name.set(String::from("CasperUSD"));
        self.symbol.set(String::from("cUSD"));
        self.decimals.set(9);
        self.total_supply.set(0);
        self.minter.set(self.env().caller());
    }

    /// Set the minter (Vault contract) - only callable once by deployer
    pub fn set_minter(&mut self, minter: Address) {
        let current = self.minter.get().unwrap();
        assert!(current == self.env().caller(), "Only current minter");
        self.minter.set(minter);
    }

    /// Mint new cUSD - only callable by Vault
    pub fn mint(&mut self, to: Address, amount: u64) {
        assert!(self.env().caller() == self.minter.get().unwrap(), "Only minter");
        let balance = self.balances.get(&to).unwrap_or(0);
        self.balances.set(&to, balance + amount);
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply + amount);
    }

    /// Burn cUSD - only callable by Vault
    pub fn burn(&mut self, from: Address, amount: u64) {
        assert!(self.env().caller() == self.minter.get().unwrap(), "Only minter");
        let balance = self.balances.get(&from).unwrap_or(0);
        assert!(balance >= amount, "Insufficient balance");
        self.balances.set(&from, balance - amount);
        let supply = self.total_supply.get_or_default();
        self.total_supply.set(supply - amount);
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
