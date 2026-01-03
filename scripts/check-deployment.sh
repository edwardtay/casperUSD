#!/bin/bash
# Quick check of contract deployment status
# Usage: ./scripts/check-deployment.sh [testnet|mainnet]

set -e

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

NETWORK=${1:-$CASPER_NETWORK}

if [ "$NETWORK" == "testnet" ]; then
    EXPLORER="https://testnet.cspr.live"
else
    EXPLORER="https://cspr.live"
fi

echo "🔍 Checking deployed contracts on $NETWORK..."
echo ""

if [ -n "$ORACLE_CONTRACT_HASH" ]; then
    echo "✅ Oracle: $EXPLORER/contract/$ORACLE_CONTRACT_HASH"
else
    echo "❌ Oracle: Not deployed"
fi

if [ -n "$STABLECOIN_CONTRACT_HASH" ]; then
    echo "✅ CasperUSD: $EXPLORER/contract/$STABLECOIN_CONTRACT_HASH"
else
    echo "❌ CasperUSD: Not deployed"
fi

if [ -n "$VAULT_CONTRACT_HASH" ]; then
    echo "✅ Vault: $EXPLORER/contract/$VAULT_CONTRACT_HASH"
else
    echo "❌ Vault: Not deployed"
fi

if [ -n "$STABILITY_POOL_CONTRACT_HASH" ]; then
    echo "✅ Stability Pool: $EXPLORER/contract/$STABILITY_POOL_CONTRACT_HASH"
else
    echo "❌ Stability Pool: Not deployed"
fi
