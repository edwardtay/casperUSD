#!/bin/bash
# Deploy CasperUSD contracts to testnet
set -e

RPC="https://rpc.testnet.casperlabs.io/rpc"
CHAIN="casper-test"
SECRET_KEY="../Account 1_secret_key.pem"

echo "=== CasperUSD Testnet Deployment ==="
echo ""

# Check secret key
if [ ! -f "$SECRET_KEY" ]; then
    echo "Error: Secret key not found at $SECRET_KEY"
    exit 1
fi

# Get account hash from public key
echo "Getting account info..."
PUBLIC_KEY=$(casper-client account-address --public-key "$SECRET_KEY" 2>/dev/null | grep -oP 'account-hash-\K[a-f0-9]+' || true)

if [ -z "$PUBLIC_KEY" ]; then
    # Try alternative method
    PUBLIC_KEY=$(casper-client keygen --secret-key "$SECRET_KEY" --output-dir /tmp/casper-key 2>/dev/null && cat /tmp/casper-key/public_key_hex || echo "")
fi

echo "Deploying from key: $SECRET_KEY"
echo ""

# Deploy MockStCSPR
echo "1/3 Deploying MockStCSPR (faucet token)..."
MOCK_DEPLOY=$(casper-client put-deploy \
    --node-address "$RPC" \
    --chain-name "$CHAIN" \
    --secret-key "$SECRET_KEY" \
    --payment-amount 100000000000 \
    --session-path wasm/MockStCSPR.wasm \
    2>&1)

MOCK_HASH=$(echo "$MOCK_DEPLOY" | grep -oP 'deploy_hash.*"([a-f0-9]+)"' | grep -oP '[a-f0-9]{64}' | head -1)
echo "MockStCSPR deploy hash: $MOCK_HASH"
echo ""

# Deploy CasperUSD
echo "2/3 Deploying CasperUSD (cUSD token)..."
CUSD_DEPLOY=$(casper-client put-deploy \
    --node-address "$RPC" \
    --chain-name "$CHAIN" \
    --secret-key "$SECRET_KEY" \
    --payment-amount 100000000000 \
    --session-path wasm/CasperUSD.wasm \
    2>&1)

CUSD_HASH=$(echo "$CUSD_DEPLOY" | grep -oP 'deploy_hash.*"([a-f0-9]+)"' | grep -oP '[a-f0-9]{64}' | head -1)
echo "CasperUSD deploy hash: $CUSD_HASH"
echo ""

# Deploy Vault (needs stcspr and cusd addresses - will need to update after first deploys)
echo "3/3 Deploying Vault..."
VAULT_DEPLOY=$(casper-client put-deploy \
    --node-address "$RPC" \
    --chain-name "$CHAIN" \
    --secret-key "$SECRET_KEY" \
    --payment-amount 150000000000 \
    --session-path wasm/Vault.wasm \
    --session-arg "stcspr:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    --session-arg "cusd:key='account-hash-0000000000000000000000000000000000000000000000000000000000000000'" \
    2>&1)

VAULT_HASH=$(echo "$VAULT_DEPLOY" | grep -oP 'deploy_hash.*"([a-f0-9]+)"' | grep -oP '[a-f0-9]{64}' | head -1)
echo "Vault deploy hash: $VAULT_HASH"
echo ""

echo "=== Deployment Submitted ==="
echo ""
echo "Check status at:"
echo "  MockStCSPR: https://testnet.cspr.live/deploy/$MOCK_HASH"
echo "  CasperUSD:  https://testnet.cspr.live/deploy/$CUSD_HASH"
echo "  Vault:      https://testnet.cspr.live/deploy/$VAULT_HASH"
echo ""
echo "Wait ~2 minutes for deploys to process, then get contract hashes from explorer."
