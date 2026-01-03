#!/bin/bash
# CasperUSD Deployment Script
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Copy .env.example to .env and fill in your values"
    exit 1
fi

# Parse network argument
NETWORK=${1:-$CASPER_NETWORK}

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
    echo -e "${RED}Error: Invalid network. Use 'testnet' or 'mainnet'${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CasperUSD Contract Deployment${NC}"
echo -e "${BLUE}   Network: ${GREEN}$NETWORK${NC}"
echo -e "${BLUE}========================================${NC}"

# Set network-specific variables
if [ "$NETWORK" == "testnet" ]; then
    RPC_URL=$CASPER_TESTNET_RPC
    CHAIN_NAME=$CASPER_TESTNET_CHAIN
else
    RPC_URL=$CASPER_MAINNET_RPC
    CHAIN_NAME=$CASPER_MAINNET_CHAIN
    echo -e "${YELLOW}⚠️  WARNING: Deploying to MAINNET. This will cost real CSPR.${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Verify secret key exists
if [ ! -f "$CASPER_SECRET_KEY_PATH" ]; then
    echo -e "${RED}Error: Secret key not found at $CASPER_SECRET_KEY_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Secret key found${NC}"
echo -e "${BLUE}RPC: $RPC_URL${NC}"
echo -e "${BLUE}Chain: $CHAIN_NAME${NC}"
echo ""

# Build contracts first
echo -e "${YELLOW}Building contracts...${NC}"
cd contracts
cargo odra build
cd ..
echo -e "${GREEN}✓ Contracts built successfully${NC}"
echo ""

# For testnet, deploy MockStCSPR faucet token first
MOCK_STCSPR_HASH=""
if [ "$NETWORK" == "testnet" ]; then
    echo -e "${YELLOW}Deploying MockStCSPR (Testnet Faucet Token)...${NC}"
    MOCK_DEPLOY=$(cargo odra deploy \
        --contract MockStCSPR \
        --chain-name $CHAIN_NAME \
        --node-address $RPC_URL \
        --secret-key $CASPER_SECRET_KEY_PATH \
        --payment-amount $DEPLOY_GAS_PAYMENT \
        2>&1) || {
        echo -e "${RED}MockStCSPR deployment failed:${NC}"
        echo "$MOCK_DEPLOY"
        exit 1
    }
    MOCK_STCSPR_HASH=$(echo "$MOCK_DEPLOY" | grep -oP 'contract-[a-f0-9]+' | head -1)
    echo -e "${GREEN}✓ MockStCSPR deployed: $MOCK_STCSPR_HASH${NC}"
    echo -e "${BLUE}  Users can call faucet() to get 10,000 test stCSPR${NC}"
    echo ""
fi

# Deploy Oracle contract first (other contracts depend on it)
echo -e "${YELLOW}Step 2/5: Deploying Oracle contract...${NC}"
ORACLE_DEPLOY=$(cargo odra deploy \
    --contract PriceOracle \
    --chain-name $CHAIN_NAME \
    --node-address $RPC_URL \
    --secret-key $CASPER_SECRET_KEY_PATH \
    --payment-amount $DEPLOY_GAS_PAYMENT \
    2>&1) || {
    echo -e "${RED}Oracle deployment failed:${NC}"
    echo "$ORACLE_DEPLOY"
    exit 1
}
ORACLE_HASH=$(echo "$ORACLE_DEPLOY" | grep -oP 'contract-[a-f0-9]+' | head -1)
echo -e "${GREEN}✓ Oracle deployed: $ORACLE_HASH${NC}"
echo ""

# Deploy Stablecoin contract
echo -e "${YELLOW}Step 3/5: Deploying CasperUSD (cUSD) contract...${NC}"
STABLECOIN_DEPLOY=$(cargo odra deploy \
    --contract CasperUSD \
    --chain-name $CHAIN_NAME \
    --node-address $RPC_URL \
    --secret-key $CASPER_SECRET_KEY_PATH \
    --payment-amount $DEPLOY_GAS_PAYMENT \
    2>&1) || {
    echo -e "${RED}Stablecoin deployment failed:${NC}"
    echo "$STABLECOIN_DEPLOY"
    exit 1
}
STABLECOIN_HASH=$(echo "$STABLECOIN_DEPLOY" | grep -oP 'contract-[a-f0-9]+' | head -1)
echo -e "${GREEN}✓ CasperUSD deployed: $STABLECOIN_HASH${NC}"
echo ""

# Deploy Vault contract
echo -e "${YELLOW}Step 4/5: Deploying Vault contract...${NC}"
VAULT_DEPLOY=$(cargo odra deploy \
    --contract Vault \
    --chain-name $CHAIN_NAME \
    --node-address $RPC_URL \
    --secret-key $CASPER_SECRET_KEY_PATH \
    --payment-amount $DEPLOY_GAS_PAYMENT \
    --args "oracle:$ORACLE_HASH,stablecoin:$STABLECOIN_HASH" \
    2>&1) || {
    echo -e "${RED}Vault deployment failed:${NC}"
    echo "$VAULT_DEPLOY"
    exit 1
}
VAULT_HASH=$(echo "$VAULT_DEPLOY" | grep -oP 'contract-[a-f0-9]+' | head -1)
echo -e "${GREEN}✓ Vault deployed: $VAULT_HASH${NC}"
echo ""

# Deploy Stability Pool contract
echo -e "${YELLOW}Step 5/5: Deploying Stability Pool contract...${NC}"
POOL_DEPLOY=$(cargo odra deploy \
    --contract StabilityPool \
    --chain-name $CHAIN_NAME \
    --node-address $RPC_URL \
    --secret-key $CASPER_SECRET_KEY_PATH \
    --payment-amount $DEPLOY_GAS_PAYMENT \
    --args "vault:$VAULT_HASH" \
    2>&1) || {
    echo -e "${RED}Stability Pool deployment failed:${NC}"
    echo "$POOL_DEPLOY"
    exit 1
}
POOL_HASH=$(echo "$POOL_DEPLOY" | grep -oP 'contract-[a-f0-9]+' | head -1)
echo -e "${GREEN}✓ Stability Pool deployed: $POOL_HASH${NC}"
echo ""

# Success summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Add these to your .env file:"
echo ""
echo "ORACLE_CONTRACT_HASH=$ORACLE_HASH"
echo "STABLECOIN_CONTRACT_HASH=$STABLECOIN_HASH"
echo "VAULT_CONTRACT_HASH=$VAULT_HASH"
echo "STABILITY_POOL_CONTRACT_HASH=$POOL_HASH"
echo ""
echo -e "View on explorer:"
if [ "$NETWORK" == "testnet" ]; then
    echo "https://testnet.cspr.live/contract/$VAULT_HASH"
else
    echo "https://cspr.live/contract/$VAULT_HASH"
fi
