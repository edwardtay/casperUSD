#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
extern crate alloc;

// CasperUSD Protocol - LST-Backed Stablecoin
// 
// Design based on Liquity V2 + crvUSD research:
// - User-set interest rates (market-driven)
// - Soft liquidation via Stability Pool
// - TWAP Oracle for manipulation resistance
// - Redemption mechanism for peg stability

pub mod oracle;
pub mod stablecoin;
pub mod trove_manager;
pub mod stability_pool;
pub mod stcspr;
