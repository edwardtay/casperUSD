# CasperUSD - LST-Backed Stablecoin Protocol

> Borrow stablecoins against staked CSPR without unstaking — keep earning validator rewards while accessing DeFi liquidity.

[![Built with Odra](https://img.shields.io/badge/Built%20with-Odra%20Framework-10B981)](https://odra.dev)
[![Casper Network](https://img.shields.io/badge/Casper-Network-FF0012)](https://casper.network)
[![Hackathon](https://img.shields.io/badge/Track-Liquid%20Staking-purple)](https://casper.network)

---

## ⚠️ Disclaimer

**This is a hackathon MVP for demonstration purposes.**

- Smart contracts deployed on **Casper Testnet**
- Price data from **CoinGecko API** (real mainnet prices)
- **Do not use real funds** — testnet tokens have no value
- Not audited — use at your own risk

---

## 🎯 Problem

**$12B+ CSPR is staked** on Casper Network earning ~10% APY, but:
- Capital is **locked** in validators
- To access liquidity, users must **unstake** (losing rewards)
- Unbonding period creates **opportunity cost**

## 💡 Solution

CasperUSD enables **Collateralized Debt Positions (CDPs)** against liquid staking tokens:

| Feature | Benefit |
|---------|---------|
| **Keep Earning** | stCSPR stays staked, rewards continue |
| **Instant Liquidity** | Borrow cUSD stablecoin immediately |
| **User-Set Rates** | Choose your own interest rate (Liquity V2 design) |
| **Capital Efficient** | 150% min collateral ratio |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript + Tailwind)        │
│         Casper Wallet • Real-time CSPR Balance • CoinGecko   │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ PriceOracle  │◄──│ TroveManager │──►│  CasperUSD   │
│   (TWAP)     │   │    (CDPs)    │   │ (cUSD Token) │
└──────────────┘   └──────┬───────┘   └──────────────┘
                          │
                   ┌──────▼───────┐
                   │StabilityPool │
                   │(Liquidations)│
                   └──────────────┘
```

### Smart Contracts (Odra Framework)

| Contract | Description |
|----------|-------------|
| `MockStCSPR` | Test LST token with faucet (10k per claim) |
| `CasperUSD` | cUSD stablecoin (CEP-18 standard) |
| `PriceOracle` | TWAP price feed with staleness checks |
| `TroveManager` | CDP management, user-set interest rates |
| `StabilityPool` | Liquidation absorption, real yield |

---

## 📊 Protocol Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Min Collateral Ratio | **150%** | Required to open/maintain position |
| Liquidation Threshold | **110%** | Below this triggers liquidation |
| Interest Rate | **User-set** | Borrowers choose their rate |
| Liquidation Penalty | **10%** | Bonus to stability pool |
| TWAP Window | **6 hours** | Price averaging period |

---

## 🚀 Quick Start

### Prerequisites
```bash
# Rust + WASM target
rustup target add wasm32-unknown-unknown

# Node.js 18+
node --version
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Build Contracts
```bash
cd casper-usd
cargo build --release --target wasm32-unknown-unknown
```

### Deploy to Testnet
```bash
# 1. Get testnet CSPR from faucet
# https://testnet.cspr.live/tools/faucet

# 2. Deploy contracts
cd scripts
npm install
node deploy-contracts.mjs

# 3. Check deploy status
node check-deploy.mjs

# 4. Get contract hashes (after deploys complete)
node get-contract-hashes.mjs
```

---

## 🎮 User Flow

1. **Connect Wallet** → Casper Wallet extension
2. **Get Test Tokens** → CSPR faucet + stCSPR claim
3. **Open Trove** → Deposit stCSPR, borrow cUSD
4. **Set Interest Rate** → Lower rate = higher redemption risk
5. **Monitor Position** → Stay above 150% ratio
6. **Earn in Pool** → Deposit cUSD for liquidation rewards

---

## 📁 Project Structure

```
casperUSD/
├── casper-usd/           # Smart contracts (Odra/Rust)
│   ├── src/
│   │   ├── trove_manager.rs    # CDP logic
│   │   ├── stability_pool.rs   # Liquidations
│   │   ├── oracle.rs           # TWAP price feed
│   │   ├── stablecoin.rs       # cUSD token
│   │   └── mock_stcspr.rs      # Test LST
│   └── wasm/             # Compiled WASM
├── frontend/             # React UI
│   └── src/App.tsx       # Main application
├── scripts/              # Deployment tools
│   ├── deploy-contracts.mjs
│   ├── check-deploy.mjs
│   └── get-contract-hashes.mjs
└── README.md
```

---

## 🛡️ Security Features

- **TWAP Oracle**: 6-hour price averaging resists manipulation
- **Price Deviation Bounds**: Rejects >10% sudden price jumps
- **Over-Collateralization**: 150% minimum buffer
- **Stability Pool**: Decentralized liquidation mechanism
- **User-Set Rates**: Market-driven interest (Liquity V2)

---

## 🔗 Links

- **Testnet Explorer**: [testnet.cspr.live](https://testnet.cspr.live)
- **CSPR Faucet**: [testnet.cspr.live/tools/faucet](https://testnet.cspr.live/tools/faucet)
- **Casper Wallet**: [casperwallet.io](https://www.casperwallet.io/)
- **Odra Framework**: [odra.dev](https://odra.dev)

---

## 📄 License

MIT

---

<p align="center">
  <strong>Built for Casper Liquid Staking Hackathon</strong>
</p>
