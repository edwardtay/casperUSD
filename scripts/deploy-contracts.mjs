#!/usr/bin/env node
/**
 * CasperUSD Contract Deployment Script
 * Deploys all contracts to Casper testnet using casper-js-sdk
 */

import pkg from 'casper-js-sdk';
const { CasperClient, DeployUtil, Keys, RuntimeArgs, CLValueBuilder, CLPublicKey } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const RPC_URL = 'https://node.testnet.casper.network/rpc';
const CHAIN_NAME = 'casper-test';
const SECRET_KEY_PATH = path.join(__dirname, '..', 'casper-wallet-secret_keys (1)', 'Account 4_secret_key.pem');
const WASM_DIR = path.join(__dirname, '..', 'casper-usd', 'wasm');

// Gas amounts in motes (1 CSPR = 1,000,000,000 motes)
const GAS_SIMPLE = 150_000_000_000n;  // 150 CSPR for simple contracts
const GAS_COMPLEX = 200_000_000_000n; // 200 CSPR for complex contracts

async function loadKeys() {
  // Try Secp256K1 first (EC key), then Ed25519
  try {
    return Keys.Secp256K1.loadKeyPairFromPrivateFile(SECRET_KEY_PATH);
  } catch (e) {
    try {
      return Keys.Ed25519.loadKeyPairFromPrivateFile(SECRET_KEY_PATH);
    } catch (e2) {
      return Keys.Ed25519.parsePrivateKeyFile(SECRET_KEY_PATH);
    }
  }
}

async function deployContract(client, keys, wasmPath, contractName, args = {}, gasAmount = GAS_SIMPLE) {
  console.log(`\nDeploying ${contractName}...`);
  
  const wasmBuffer = fs.readFileSync(wasmPath);
  const runtimeArgs = RuntimeArgs.fromMap(args);
  
  // Use 2 hour TTL for testnet
  const deployParams = new DeployUtil.DeployParams(
    keys.publicKey, 
    CHAIN_NAME,
    1,  // gas price
    7200000  // TTL in ms (2 hours)
  );
  
  const deploy = DeployUtil.makeDeploy(
    deployParams,
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBuffer, runtimeArgs),
    DeployUtil.standardPayment(gasAmount)
  );
  
  const signedDeploy = DeployUtil.signDeploy(deploy, keys);
  const deployHash = await client.putDeploy(signedDeploy);
  
  console.log(`  Deploy hash: ${deployHash}`);
  console.log(`  Explorer: https://testnet.cspr.live/deploy/${deployHash}`);
  
  return deployHash;
}

async function waitForDeploy(client, deployHash, maxAttempts = 30) {
  console.log(`  Waiting for deploy to process...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
    
    try {
      const result = await client.getDeploy(deployHash);
      if (result && result.execution_results && result.execution_results.length > 0) {
        const execResult = result.execution_results[0].result;
        if (execResult.Success) {
          console.log(`  ✓ Deploy successful!`);
          return execResult;
        } else if (execResult.Failure) {
          console.error(`  ✗ Deploy failed:`, execResult.Failure.error_message);
          return null;
        }
      }
    } catch (err) {
      // Deploy not found yet, keep waiting
    }
    
    process.stdout.write('.');
  }
  
  console.log(`  Timeout waiting for deploy`);
  return null;
}

async function getContractHash(client, accountHash, contractName) {
  // Query account's named keys to find contract hash
  try {
    const stateRootHash = await client.nodeClient.getStateRootHash();
    const accountInfo = await client.nodeClient.getBlockState(
      stateRootHash,
      `account-hash-${accountHash}`,
      []
    );
    
    const namedKeys = accountInfo.Account?.named_keys || [];
    for (const key of namedKeys) {
      if (key.name.toLowerCase().includes(contractName.toLowerCase())) {
        return key.key;
      }
    }
  } catch (err) {
    console.error(`  Error getting contract hash:`, err.message);
  }
  return null;
}

async function main() {
  console.log('=== CasperUSD Contract Deployment ===\n');
  
  // Check files exist
  if (!fs.existsSync(SECRET_KEY_PATH)) {
    console.error(`Error: Secret key not found at ${SECRET_KEY_PATH}`);
    process.exit(1);
  }
  
  const client = new CasperClient(RPC_URL);
  const keys = await loadKeys();
  const accountHash = keys.publicKey.toAccountHashStr().replace('account-hash-', '');
  
  console.log(`Account: ${keys.publicKey.toHex()}`);
  console.log(`Account Hash: ${accountHash}`);
  
  const deployHashes = {};
  const contracts = [
    { name: 'MockStCSPR', wasm: 'MockStCSPR.wasm', gas: GAS_SIMPLE },
    { name: 'CasperUSD', wasm: 'CasperUSD.wasm', gas: GAS_SIMPLE },
    { name: 'PriceOracle', wasm: 'PriceOracle.wasm', gas: GAS_SIMPLE },
    { name: 'TroveManager', wasm: 'TroveManager.wasm', gas: GAS_COMPLEX },
    { name: 'StabilityPool', wasm: 'StabilityPool.wasm', gas: GAS_COMPLEX },
  ];
  
  // Deploy all contracts
  for (const contract of contracts) {
    const wasmPath = path.join(WASM_DIR, contract.wasm);
    if (!fs.existsSync(wasmPath)) {
      console.error(`  WASM not found: ${wasmPath}`);
      continue;
    }
    
    try {
      const hash = await deployContract(client, keys, wasmPath, contract.name, {}, contract.gas);
      deployHashes[contract.name] = hash;
    } catch (err) {
      console.error(`  Failed to deploy ${contract.name}:`, err.message);
    }
  }
  
  console.log('\n=== Deployment Summary ===\n');
  console.log('Deploy Hashes:');
  for (const [name, hash] of Object.entries(deployHashes)) {
    console.log(`  ${name}: ${hash}`);
  }
  
  console.log('\n⏳ Wait 2-3 minutes for deploys to process.');
  console.log('Then run: node scripts/get-contract-hashes.mjs');
  
  // Save deploy hashes to file
  fs.writeFileSync(
    path.join(__dirname, 'deploy-hashes.json'),
    JSON.stringify(deployHashes, null, 2)
  );
  console.log('\nDeploy hashes saved to scripts/deploy-hashes.json');
}

main().catch(console.error);
