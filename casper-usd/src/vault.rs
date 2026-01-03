//! Vault - CDP management for borrowing cUSD against stCSPR
use odra::prelude::*;

const MIN_RATIO: u64 = 150; // 150% minimum collateral ratio
const LIQUIDATION_RATIO: u64 = 130; // 130% liquidation threshold
const DECIMALS: u64 = 1_000_000_000; // 9 decimals

#[odra::module]
pub struct Vault {
    owner: Var<Address>,
    stcspr_token: Var<Address>,
    cusd_token: Var<Address>,
    price: Var<u64>, // CSPR price in USD with 9 decimals
    
    // User positions: address -> (collateral, debt)
    collateral: Mapping<Address, u64>,
    debt: Mapping<Address, u64>,
    
    total_collateral: Var<u64>,
    total_debt: Var<u64>,
}

#[odra::module]
impl Vault {
    pub fn init(&mut self, stcspr: Address, cusd: Address) {
        self.owner.set(self.env().caller());
        self.stcspr_token.set(stcspr);
        self.cusd_token.set(cusd);
        self.price.set(50_000_000); // Default $0.05 with 9 decimals
        self.total_collateral.set(0);
        self.total_debt.set(0);
    }

    /// Update price (simplified oracle - owner only for demo)
    pub fn set_price(&mut self, price: u64) {
        assert!(self.env().caller() == self.owner.get().unwrap(), "Only owner");
        self.price.set(price);
    }

    /// Deposit stCSPR collateral
    pub fn deposit(&mut self, amount: u64) {
        let caller = self.env().caller();
        let current = self.collateral.get(&caller).unwrap_or(0);
        self.collateral.set(&caller, current + amount);
        let total = self.total_collateral.get_or_default();
        self.total_collateral.set(total + amount);
        // Note: In production, would call stcspr.transfer_from here
    }

    /// Borrow cUSD against collateral
    pub fn borrow(&mut self, amount: u64) {
        let caller = self.env().caller();
        let collateral = self.collateral.get(&caller).unwrap_or(0);
        let current_debt = self.debt.get(&caller).unwrap_or(0);
        let new_debt = current_debt + amount;
        
        // Check collateral ratio
        let collateral_value = self.get_collateral_value(collateral);
        let ratio = (collateral_value * 100) / new_debt;
        assert!(ratio >= MIN_RATIO, "Below minimum collateral ratio");
        
        self.debt.set(&caller, new_debt);
        let total = self.total_debt.get_or_default();
        self.total_debt.set(total + amount);
        // Note: In production, would call cusd.mint here
    }

    /// Repay cUSD debt
    pub fn repay(&mut self, amount: u64) {
        let caller = self.env().caller();
        let current_debt = self.debt.get(&caller).unwrap_or(0);
        assert!(amount <= current_debt, "Repay exceeds debt");
        self.debt.set(&caller, current_debt - amount);
        let total = self.total_debt.get_or_default();
        self.total_debt.set(total - amount);
        // Note: In production, would call cusd.burn here
    }

    /// Withdraw collateral
    pub fn withdraw(&mut self, amount: u64) {
        let caller = self.env().caller();
        let collateral = self.collateral.get(&caller).unwrap_or(0);
        assert!(amount <= collateral, "Withdraw exceeds collateral");
        
        let new_collateral = collateral - amount;
        let debt = self.debt.get(&caller).unwrap_or(0);
        
        // If has debt, check ratio after withdrawal
        if debt > 0 {
            let collateral_value = self.get_collateral_value(new_collateral);
            let ratio = (collateral_value * 100) / debt;
            assert!(ratio >= MIN_RATIO, "Would go below minimum ratio");
        }
        
        self.collateral.set(&caller, new_collateral);
        let total = self.total_collateral.get_or_default();
        self.total_collateral.set(total - amount);
        // Note: In production, would call stcspr.transfer here
    }

    /// Check if position is liquidatable
    pub fn is_liquidatable(&self, user: Address) -> bool {
        let collateral = self.collateral.get(&user).unwrap_or(0);
        let debt = self.debt.get(&user).unwrap_or(0);
        if debt == 0 {
            return false;
        }
        let collateral_value = self.get_collateral_value(collateral);
        let ratio = (collateral_value * 100) / debt;
        ratio < LIQUIDATION_RATIO
    }

    // View functions
    pub fn get_price(&self) -> u64 {
        self.price.get_or_default()
    }

    pub fn get_position(&self, user: Address) -> (u64, u64) {
        (
            self.collateral.get(&user).unwrap_or(0),
            self.debt.get(&user).unwrap_or(0)
        )
    }

    pub fn get_collateral_ratio(&self, user: Address) -> u64 {
        let collateral = self.collateral.get(&user).unwrap_or(0);
        let debt = self.debt.get(&user).unwrap_or(0);
        if debt == 0 {
            return 0;
        }
        let collateral_value = self.get_collateral_value(collateral);
        (collateral_value * 100) / debt
    }

    pub fn get_total_collateral(&self) -> u64 {
        self.total_collateral.get_or_default()
    }

    pub fn get_total_debt(&self) -> u64 {
        self.total_debt.get_or_default()
    }

    fn get_collateral_value(&self, amount: u64) -> u64 {
        (amount * self.price.get_or_default()) / DECIMALS
    }
}
