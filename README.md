# CasperUSD - LST-Collateralized Stablecoin

> Borrow stablecoins against staked CSPR without unstaking — keep earning validator rewards while accessing DeFi liquidity.

[![Built with Odra](https://img.shields.io/badge/Built%20with-Odra%20Framework-10B981)](https://odra.dev)
[![Casper Network](https://img.shields.io/badge/Casper-Network-FF0012)](https://casper.network)

---

## ⚠️ Disclaimer

**This is a Minimum Viable Product (MVP) for demonstration purposes.**

- Smart contracts are deployed on **Casper Testnet**
- Market data (CSPR price, staking APY) is sourced from **Casper Mainnet** via CoinGecko API
- This mirrors real-world conditions for accurate testing while using testnet tokens
- **Do not use real funds** — testnet tokens have no monetary value
- This software is provided "as-is" without warranty of any kind
- Not audited — use at your own risk

---

## 🎯 Problem

**$12B+ CSPR is staked** on Casper Network, earning ~10% APY. But:
- Capital is **locked** in validators
- To access liquidity, users must **unstake** (losing rewards)
- Unbonding period creates **opportunity cost**

## 💡 Solution

CasperUSD introduces **Collateralized Debt Positions (CDPs)** for liquid staking tokens:

| Feature | How It Works |
|---------|--------------|
| **Keep Earning** | Your CSPR stays staked in validators |
| **Instant Liquidity** | Borrow cUSD stablecoin against stCSPR |
| **No Unstaking** | Maintain delegation, keep rewards |
| **Flexible Terms** | Repay anytime, reclaim collateral |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + TypeScript)                        │
│              Real-time CoinGecko API • Inter Font                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  PriceOracle  │◄────►│     Vault     │◄────►│   CasperUSD   │
│    (TWAP)     │      │   (CDP Mgmt)  │      │ (cUSD CEP-18) │
└───────────────┘      └───────┬───────┘      └───────────────┘
                               │
                        ┌──────▼──────┐
                        │StabilityPool│
                        └─────────────┘
```

### Testnet Deployment Strategy

| Component | Network | Rationale |
|-----------|---------|-----------|
| Smart Contracts | **Testnet** | Safe testing environment |
| Price Oracle Data | **Mainnet** | Real market prices for accurate simulation |
| Staking APY | **Mainnet** | Reflects actual validator rewards |
| User Balances | **Testnet** | Test tokens from faucet |

This approach mirrors production conditions while ensuring no real assets are at risk.

---

## 📊 Protocol Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Min Collateral Ratio | **150%** | Minimum to open/maintain vault |
| Liquidation Threshold | **130%** | Below this, vault is liquidatable |
| Stability Fee | **2% APY** | Annual interest on borrowed cUSD |
| Liquidation Penalty | **10%** | Bonus to liquidators |
| TWAP Window | **6 hours** | Price averaging period |
| Oracle Heartbeat | **1 hour** | Maximum price staleness |

---

## 🛡️ Security Features

- **TWAP Oracle**: 6-hour price averaging resists manipulation
- **Price Deviation Bounds**: Rejects >10% price jumps
- **Over-Collateralization**: 150% minimum buffer
- **Decentralized Liquidations**: Stability pool absorbs bad debt

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | [Odra Framework](https://odra.dev) (Rust → WASM) |
| Token Standard | CEP-18 |
| Frontend | React 18 + TypeScript + Tailwind |
| Price Data | CoinGecko API (Live) |


---

## 📁 Project Structure

```
lst-stablecoin/
├── contracts/
│   └── src/
│       ├── vault.rs            # CDP management
│       ├── stablecoin.rs       # cUSD CEP-18 token
│       ├── oracle.rs           # TWAP price feed
│       └── stability_pool.rs   # Liquidation pool
├── frontend/
│   └── src/
│       └── App.tsx             # Full DeFi interface
├── scripts/
│   └── deploy.sh               # Deployment automation
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
```bash
# Rust + WASM target
rustup target add wasm32-unknown-unknown

# Odra CLI
cargo install cargo-odra

# Node.js 18+
```

### Run Locally
```bash
# Frontend
cd frontend
npm install
npm run dev

# Contracts
cd contracts
cargo odra build
cargo odra test
```

### Deploy to Testnet
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your secret key path

# 2. Get testnet CSPR from faucet
# https://testnet.cspr.live/tools/faucet

# 3. Deploy
./scripts/deploy.sh testnet
```

---

## 🎮 User Flow

1. **Connect Wallet** → CSPR.click integration
2. **Deposit stCSPR** → Lock as collateral
3. **Borrow cUSD** → Up to 66.7% of collateral value
4. **Monitor Health Factor** → Stay above 1.0 to avoid liquidation
5. **Repay & Withdraw** → Burn cUSD, reclaim collateral

---

## 📈 Roadmap

- [x] Core vault mechanics
- [x] CEP-18 cUSD token
- [x] TWAP oracle
- [x] Stability pool
- [x] Real-time price integration

- [ ] Mainnet deployment
- [ ] Multi-collateral support
- [ ] Security audit

---

## 📄 License

MIT

---

<p align="center">
  <strong>Built for the Casper ecosystem</strong>
</p>
