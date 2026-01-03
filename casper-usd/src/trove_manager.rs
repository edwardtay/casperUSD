//! Trove Manager - CDP Management with User-Set Interest Rates
//! 
//! Based on Liquity V2 design:
//! - Users set their own interest rates (market-driven)
//! - Lower rates = higher redemption priority
//! - Continuous interest accrual
//! - Soft liquidation support

use odra::prelude::*;

const DECIMALS: u64 = 1_000_000_000; // 9 decimals
const MIN_COLLATERAL_RATIO: u64 = 150; // 150%
const LIQUIDATION_RATIO: u64 = 110; // 110% - soft liquidation starts
const MIN_DEBT: u64 = 100_000_000_000; // 100 cUSD minimum
const MIN_INTEREST_RATE: u64 = 5_000_000; // 0.5% annual
const MAX_INTEREST_RATE: u64 = 200_000_000_000; // 200% annual
const SECONDS_PER_YEAR: u64 = 31536000;
const REDEMPTION_FEE_FLOOR: u64 = 5_000_000; // 0.5%
const BORROWING_FEE: u64 = 5_000_000; // 0.5%

#[odra::module]
pub struct TroveManager {
    owner: Var<Address>,
    oracle: Var<Address>,
    stablecoin: Var<Address>,
    stcspr_token: Var<Address>,
    stability_pool: Var<Address>,
    
    // Trove storage - separate mappings for each field
    trove_collateral: Mapping<Address, u64>,
    trove_debt: Mapping<Address, u64>,
    trove_interest_rate: Mapping<Address, u64>,
    trove_last_update: Mapping<Address, u64>,
    trove_active: Mapping<Address, bool>,
    
    // Protocol stats
    total_collateral: Var<u64>,
    total_debt: Var<u64>,
    trove_count: Var<u64>,
    
    // Redemption tracking
    base_rate: Var<u64>,
    last_redemption_time: Var<u64>,
}

#[odra::module]
impl TroveManager {
    pub fn init(&mut self, oracle: Address, stablecoin: Address, stcspr: Address) {
        self.owner.set(self.env().caller());
        self.oracle.set(oracle);
        self.stablecoin.set(stablecoin);
        self.stcspr_token.set(stcspr);
        self.total_collateral.set(0);
        self.total_debt.set(0);
        self.trove_count.set(0);
        self.base_rate.set(0);
        self.last_redemption_time.set(0);
    }

    /// Set stability pool address
    pub fn set_stability_pool(&mut self, pool: Address) {
        self.only_owner();
        self.stability_pool.set(pool);
    }

    // === TROVE OPERATIONS ===

    /// Open a new trove with user-set interest rate
    pub fn open_trove(&mut self, collateral: u64, debt: u64, interest_rate: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(!is_active, "Trove already exists");
        
        assert!(collateral > 0, "Collateral must be positive");
        assert!(debt >= MIN_DEBT, "Debt below minimum");
        assert!(interest_rate >= MIN_INTEREST_RATE, "Interest rate too low");
        assert!(interest_rate <= MAX_INTEREST_RATE, "Interest rate too high");
        
        // Check collateral ratio
        let price = self.get_price();
        let collateral_value = (collateral * price) / DECIMALS;
        let ratio = (collateral_value * 100) / debt;
        assert!(ratio >= MIN_COLLATERAL_RATIO, "Below minimum collateral ratio");
        
        // Apply borrowing fee
        let fee = (debt * BORROWING_FEE) / DECIMALS;
        let total_debt = debt + fee;
        
        // Store trove data
        self.trove_collateral.set(&caller, collateral);
        self.trove_debt.set(&caller, total_debt);
        self.trove_interest_rate.set(&caller, interest_rate);
        self.trove_last_update.set(&caller, self.env().get_block_time());
        self.trove_active.set(&caller, true);
        
        // Update totals
        let total_coll = self.total_collateral.get_or_default();
        self.total_collateral.set(total_coll + collateral);
        let total_d = self.total_debt.get_or_default();
        self.total_debt.set(total_d + total_debt);
        let count = self.trove_count.get_or_default();
        self.trove_count.set(count + 1);
    }

    /// Adjust interest rate
    pub fn adjust_interest_rate(&mut self, new_rate: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        assert!(new_rate >= MIN_INTEREST_RATE, "Rate too low");
        assert!(new_rate <= MAX_INTEREST_RATE, "Rate too high");
        
        // Accrue interest before changing rate
        self.accrue_interest_for(caller);
        
        self.trove_interest_rate.set(&caller, new_rate);
    }

    /// Add collateral
    pub fn add_collateral(&mut self, amount: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        
        self.accrue_interest_for(caller);
        
        let current = self.trove_collateral.get(&caller).unwrap_or(0);
        self.trove_collateral.set(&caller, current + amount);
        
        let total = self.total_collateral.get_or_default();
        self.total_collateral.set(total + amount);
    }

    /// Withdraw collateral
    pub fn withdraw_collateral(&mut self, amount: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        
        let collateral = self.trove_collateral.get(&caller).unwrap_or(0);
        assert!(collateral >= amount, "Insufficient collateral");
        
        self.accrue_interest_for(caller);
        
        let new_collateral = collateral - amount;
        let debt = self.trove_debt.get(&caller).unwrap_or(0);
        
        if debt > 0 {
            let price = self.get_price();
            let collateral_value = (new_collateral * price) / DECIMALS;
            let ratio = (collateral_value * 100) / debt;
            assert!(ratio >= MIN_COLLATERAL_RATIO, "Would breach minimum ratio");
        }
        
        self.trove_collateral.set(&caller, new_collateral);
        
        let total = self.total_collateral.get_or_default();
        self.total_collateral.set(total - amount);
    }

    /// Borrow more cUSD
    pub fn borrow(&mut self, amount: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        
        self.accrue_interest_for(caller);
        
        let fee = (amount * BORROWING_FEE) / DECIMALS;
        let current_debt = self.trove_debt.get(&caller).unwrap_or(0);
        let new_debt = current_debt + amount + fee;
        
        let collateral = self.trove_collateral.get(&caller).unwrap_or(0);
        let price = self.get_price();
        let collateral_value = (collateral * price) / DECIMALS;
        let ratio = (collateral_value * 100) / new_debt;
        assert!(ratio >= MIN_COLLATERAL_RATIO, "Would breach minimum ratio");
        
        self.trove_debt.set(&caller, new_debt);
        
        let total = self.total_debt.get_or_default();
        self.total_debt.set(total + amount + fee);
    }

    /// Repay debt
    pub fn repay(&mut self, amount: u64) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        
        self.accrue_interest_for(caller);
        
        let current_debt = self.trove_debt.get(&caller).unwrap_or(0);
        let repay_amount = if amount > current_debt { current_debt } else { amount };
        
        self.trove_debt.set(&caller, current_debt - repay_amount);
        
        let total = self.total_debt.get_or_default();
        self.total_debt.set(total - repay_amount);
    }

    /// Close trove
    pub fn close_trove(&mut self) {
        let caller = self.env().caller();
        let is_active = self.trove_active.get(&caller).unwrap_or(false);
        assert!(is_active, "No active trove");
        
        self.accrue_interest_for(caller);
        
        let debt = self.trove_debt.get(&caller).unwrap_or(0);
        assert!(debt == 0, "Must repay all debt first");
        
        let collateral = self.trove_collateral.get(&caller).unwrap_or(0);
        
        self.trove_active.set(&caller, false);
        self.trove_collateral.set(&caller, 0);
        self.trove_debt.set(&caller, 0);
        
        let total = self.total_collateral.get_or_default();
        self.total_collateral.set(total - collateral);
        
        let count = self.trove_count.get_or_default();
        self.trove_count.set(count - 1);
    }

    // === LIQUIDATION ===

    /// Check if trove is liquidatable
    pub fn is_liquidatable(&self, owner: Address) -> bool {
        let is_active = self.trove_active.get(&owner).unwrap_or(false);
        if !is_active { return false; }
        
        let debt = self.trove_debt.get(&owner).unwrap_or(0);
        if debt == 0 { return false; }
        
        let collateral = self.trove_collateral.get(&owner).unwrap_or(0);
        let price = self.get_price();
        let collateral_value = (collateral * price) / DECIMALS;
        let ratio = (collateral_value * 100) / debt;
        
        ratio < LIQUIDATION_RATIO
    }

    /// Liquidate undercollateralized trove
    pub fn liquidate(&mut self, owner: Address) {
        assert!(self.is_liquidatable(owner), "Trove not liquidatable");
        
        let debt = self.trove_debt.get(&owner).unwrap_or(0);
        let collateral = self.trove_collateral.get(&owner).unwrap_or(0);
        
        // 5% liquidation penalty
        let penalty = (collateral * 5) / 100;
        let _collateral_to_pool = collateral - penalty;
        
        // Clear trove
        self.trove_active.set(&owner, false);
        self.trove_debt.set(&owner, 0);
        self.trove_collateral.set(&owner, 0);
        
        // Update totals
        let total_coll = self.total_collateral.get_or_default();
        self.total_collateral.set(total_coll - collateral);
        let total_d = self.total_debt.get_or_default();
        self.total_debt.set(total_d - debt);
        let count = self.trove_count.get_or_default();
        self.trove_count.set(count - 1);
    }

    // === REDEMPTION ===

    /// Get current redemption fee rate
    pub fn get_redemption_fee(&self) -> u64 {
        let base = self.base_rate.get_or_default();
        if base > REDEMPTION_FEE_FLOOR { base } else { REDEMPTION_FEE_FLOOR }
    }

    // === INTEREST ACCRUAL ===

    fn accrue_interest_for(&mut self, user: Address) {
        let now = self.env().get_block_time();
        let last_update = self.trove_last_update.get(&user).unwrap_or(now);
        let elapsed = now - last_update;
        
        if elapsed > 0 {
            let debt = self.trove_debt.get(&user).unwrap_or(0);
            let rate = self.trove_interest_rate.get(&user).unwrap_or(0);
            
            if debt > 0 && rate > 0 {
                let interest = (debt * rate * elapsed) / (DECIMALS * SECONDS_PER_YEAR);
                self.trove_debt.set(&user, debt + interest);
                
                let total = self.total_debt.get_or_default();
                self.total_debt.set(total + interest);
            }
        }
        
        self.trove_last_update.set(&user, now);
    }

    // === VIEW FUNCTIONS ===

    pub fn get_trove_collateral(&self, owner: Address) -> u64 {
        self.trove_collateral.get(&owner).unwrap_or(0)
    }

    pub fn get_trove_debt(&self, owner: Address) -> u64 {
        self.trove_debt.get(&owner).unwrap_or(0)
    }

    pub fn get_trove_interest_rate(&self, owner: Address) -> u64 {
        self.trove_interest_rate.get(&owner).unwrap_or(0)
    }

    pub fn get_trove_active(&self, owner: Address) -> bool {
        self.trove_active.get(&owner).unwrap_or(false)
    }

    pub fn get_collateral_ratio(&self, owner: Address) -> u64 {
        let debt = self.trove_debt.get(&owner).unwrap_or(0);
        if debt == 0 { return 0; }
        
        let collateral = self.trove_collateral.get(&owner).unwrap_or(0);
        let price = self.get_price();
        let collateral_value = (collateral * price) / DECIMALS;
        (collateral_value * 100) / debt
    }

    pub fn get_total_collateral(&self) -> u64 {
        self.total_collateral.get_or_default()
    }

    pub fn get_total_debt(&self) -> u64 {
        self.total_debt.get_or_default()
    }

    pub fn get_trove_count(&self) -> u64 {
        self.trove_count.get_or_default()
    }

    /// Total Collateral Ratio
    pub fn get_tcr(&self) -> u64 {
        let total_debt = self.total_debt.get_or_default();
        if total_debt == 0 { return 0; }
        
        let price = self.get_price();
        let total_coll_value = (self.total_collateral.get_or_default() * price) / DECIMALS;
        (total_coll_value * 100) / total_debt
    }

    fn get_price(&self) -> u64 {
        // TODO: Call oracle contract
        50_000_000 // $0.05 default
    }

    fn only_owner(&self) {
        assert!(self.env().caller() == self.owner.get().unwrap(), "Only owner");
    }
}
