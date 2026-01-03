//! Stability Pool - Liquidation & Yield Mechanism
//! 
//! Based on Liquity design:
//! - Depositors provide cUSD to absorb liquidations
//! - Earn liquidation gains (collateral at discount)
//! - Earn share of protocol interest revenue
//! - Primary liquidation mechanism (more efficient than auctions)

use odra::prelude::*;

const DECIMALS: u64 = 1_000_000_000;
const SCALE_FACTOR: u64 = 1_000_000_000_000_000_000; // For precision

#[odra::module]
pub struct StabilityPool {
    owner: Var<Address>,
    stablecoin: Var<Address>,
    trove_manager: Var<Address>,
    
    // Deposits
    deposits: Mapping<Address, u64>,
    total_deposits: Var<u64>,
    
    // Reward tracking (for proportional distribution)
    // Using Liquity's "product" algorithm for O(1) reward calculation
    cumulative_collateral_per_unit: Var<u64>,
    cumulative_cusd_loss_per_unit: Var<u64>,
    
    // User snapshots for reward calculation
    user_collateral_snapshot: Mapping<Address, u64>,
    user_loss_snapshot: Mapping<Address, u64>,
    
    // Collateral gains from liquidations
    collateral_balance: Var<u64>,
    
    // Interest revenue distribution
    pending_interest_revenue: Var<u64>,
}

#[odra::module]
impl StabilityPool {
    pub fn init(&mut self, stablecoin: Address, trove_manager: Address) {
        self.owner.set(self.env().caller());
        self.stablecoin.set(stablecoin);
        self.trove_manager.set(trove_manager);
        self.total_deposits.set(0);
        self.collateral_balance.set(0);
        self.cumulative_collateral_per_unit.set(0);
        self.cumulative_cusd_loss_per_unit.set(0);
        self.pending_interest_revenue.set(0);
    }

    // === DEPOSIT/WITHDRAW ===

    /// Deposit cUSD to earn liquidation gains + interest
    pub fn deposit(&mut self, amount: u64) {
        let caller = self.env().caller();
        assert!(amount > 0, "Amount must be positive");
        
        // Claim any pending rewards first
        self.claim_rewards_internal(caller);
        
        // Update deposit
        let current = self.deposits.get(&caller).unwrap_or(0);
        self.deposits.set(&caller, current + amount);
        
        // Update total
        let total = self.total_deposits.get_or_default();
        self.total_deposits.set(total + amount);
        
        // Take snapshot for future reward calculation
        self.update_user_snapshot(caller);
        
        // TODO: Transfer cUSD from user
    }

    /// Withdraw cUSD deposit
    pub fn withdraw(&mut self, amount: u64) {
        let caller = self.env().caller();
        let current = self.deposits.get(&caller).unwrap_or(0);
        assert!(current >= amount, "Insufficient deposit");
        
        // Claim rewards first
        self.claim_rewards_internal(caller);
        
        // Update deposit
        self.deposits.set(&caller, current - amount);
        
        // Update total
        let total = self.total_deposits.get_or_default();
        self.total_deposits.set(total - amount);
        
        // Update snapshot
        self.update_user_snapshot(caller);
        
        // TODO: Transfer cUSD to user
    }

    /// Claim accumulated rewards (collateral gains)
    pub fn claim_rewards(&mut self) {
        let caller = self.env().caller();
        self.claim_rewards_internal(caller);
    }

    // === LIQUIDATION INTERFACE ===

    /// Called by TroveManager during liquidation
    /// Absorbs debt and receives collateral
    pub fn offset(&mut self, debt_to_offset: u64, collateral_to_add: u64) {
        // Only TroveManager can call
        assert!(
            self.env().caller() == self.trove_manager.get().unwrap(),
            "Only TroveManager"
        );
        
        let total = self.total_deposits.get_or_default();
        if total == 0 { return; }
        
        // Calculate per-unit gains/losses
        let collateral_per_unit = (collateral_to_add * SCALE_FACTOR) / total;
        let loss_per_unit = (debt_to_offset * SCALE_FACTOR) / total;
        
        // Update cumulative values
        let cum_coll = self.cumulative_collateral_per_unit.get_or_default();
        self.cumulative_collateral_per_unit.set(cum_coll + collateral_per_unit);
        
        let cum_loss = self.cumulative_cusd_loss_per_unit.get_or_default();
        self.cumulative_cusd_loss_per_unit.set(cum_loss + loss_per_unit);
        
        // Update balances
        let coll_bal = self.collateral_balance.get_or_default();
        self.collateral_balance.set(coll_bal + collateral_to_add);
        
        // Reduce total deposits by absorbed debt
        self.total_deposits.set(total - debt_to_offset);
    }

    /// Receive interest revenue for distribution
    pub fn receive_interest(&mut self, amount: u64) {
        // Only TroveManager can call
        assert!(
            self.env().caller() == self.trove_manager.get().unwrap(),
            "Only TroveManager"
        );
        
        let pending = self.pending_interest_revenue.get_or_default();
        self.pending_interest_revenue.set(pending + amount);
    }

    // === INTERNAL ===

    fn claim_rewards_internal(&mut self, user: Address) {
        let deposit = self.deposits.get(&user).unwrap_or(0);
        if deposit == 0 { return; }
        
        // Calculate collateral gain since last snapshot
        let cum_coll = self.cumulative_collateral_per_unit.get_or_default();
        let user_coll_snap = self.user_collateral_snapshot.get(&user).unwrap_or(0);
        let coll_gain = (deposit * (cum_coll - user_coll_snap)) / SCALE_FACTOR;
        
        // Calculate deposit loss from liquidations
        let cum_loss = self.cumulative_cusd_loss_per_unit.get_or_default();
        let user_loss_snap = self.user_loss_snapshot.get(&user).unwrap_or(0);
        let deposit_loss = (deposit * (cum_loss - user_loss_snap)) / SCALE_FACTOR;
        
        // Update user's deposit (reduced by absorbed debt)
        if deposit_loss > 0 {
            let new_deposit = if deposit > deposit_loss { deposit - deposit_loss } else { 0 };
            self.deposits.set(&user, new_deposit);
        }
        
        // Transfer collateral gain to user
        if coll_gain > 0 {
            let coll_bal = self.collateral_balance.get_or_default();
            self.collateral_balance.set(coll_bal - coll_gain);
            // TODO: Transfer collateral to user
        }
        
        self.update_user_snapshot(user);
    }

    fn update_user_snapshot(&mut self, user: Address) {
        self.user_collateral_snapshot.set(
            &user, 
            self.cumulative_collateral_per_unit.get_or_default()
        );
        self.user_loss_snapshot.set(
            &user,
            self.cumulative_cusd_loss_per_unit.get_or_default()
        );
    }

    // === VIEW FUNCTIONS ===

    pub fn get_deposit(&self, user: Address) -> u64 {
        self.deposits.get(&user).unwrap_or(0)
    }

    pub fn get_total_deposits(&self) -> u64 {
        self.total_deposits.get_or_default()
    }

    pub fn get_collateral_balance(&self) -> u64 {
        self.collateral_balance.get_or_default()
    }

    /// Calculate pending collateral gain for user
    pub fn get_pending_collateral_gain(&self, user: Address) -> u64 {
        let deposit = self.deposits.get(&user).unwrap_or(0);
        if deposit == 0 { return 0; }
        
        let cum_coll = self.cumulative_collateral_per_unit.get_or_default();
        let user_snap = self.user_collateral_snapshot.get(&user).unwrap_or(0);
        
        (deposit * (cum_coll - user_snap)) / SCALE_FACTOR
    }

    /// Get effective APY from liquidation gains
    /// This is the "real yield" that makes Stability Pool attractive
    pub fn get_effective_apy(&self) -> u64 {
        // Simplified: based on recent liquidation activity
        // In production, would track historical gains
        0
    }
}
