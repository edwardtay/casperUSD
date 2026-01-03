#!/usr/bin/env node
/**
 * Get Contract Hashes from Casper Testnet
 * Run this after deploys have processed (~2-3 minutes)
 */

import pkg from 'casper-js-sdk';
const { CasperClient, Keys } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = 'https://node.testnet.casper.network/rpc';
const SECRET_KEY_PATH = path.join(__dirname, '..', 'casper-wallet-secret_keys (1)', 'Account 4_secret_key.pem');

async function main() {
  console.log('=== Getting Contract Hashes ===\n');
  
  const client = new CasperClient(RPC_URL);
  
  // Try Secp256K1 first (EC key), then Ed25519
  let keys;
  try {
    keys = Keys.Secp256K1.loadKeyPairFromPrivateFile(SECRET_KEY_PATH);
  } catch (e) {
    try {
      keys = Keys.Ed25519.loadKeyPairFromPrivateFile(SECRET_KEY_PATH);
    } catch (e2) {
      keys = Keys.Ed25519.parsePrivateKeyFile(SECRET_KEY_PATH);
    }
  }
  const accountHashStr = keys.publicKey.toAccountHashStr();
  
  console.log(`Account: ${accountHashStr}\n`);
  
  try {
    const stateRootHash = await client.nodeClient.getStateRootHash();
    const accountInfo = await client.nodeClient.getBlockState(
      stateRootHash,
      accountHashStr,
      []
    );
    
    const namedKeys = accountInfo.Account?.named_keys || [];
    
    console.log('Named Keys (Contract Hashes):');
    console.log('─'.repeat(80));
    
    const contractHashes = {};
    
    for (const key of namedKeys) {
      console.log(`  ${key.name}: ${key.key}`);
      
      // Map to our contract names
      const nameLower = key.name.toLowerCase();
      if (nameLower.includes('mock') || nameLower.includes('stcspr')) {
        contractHashes.stcspr = key.key;
      } else if (nameLower.includes('casperusd') || nameLower.includes('cusd')) {
        contractHashes.cusd = key.key;
      } else if (nameLower.includes('oracle')) {
        contractHashes.oracle = key.key;
      } else if (nameLower.includes('trove')) {
        contractHashes.troveManager = key.key;
      } else if (nameLower.includes('stability') || nameLower.includes('pool')) {
        contractHashes.stabilityPool = key.key;
      }
    }
    
    console.log('\n─'.repeat(80));
    console.log('\nFor frontend/src/App.tsx CONTRACTS object:\n');
    console.log('const CONTRACTS = {');
    console.log(`  stcspr: '${contractHashes.stcspr || 'hash-NOT_FOUND'}',`);
    console.log(`  cusd: '${contractHashes.cusd || 'hash-NOT_FOUND'}',`);
    console.log(`  troveManager: '${contractHashes.troveManager || 'hash-NOT_FOUND'}',`);
    console.log(`  stabilityPool: '${contractHashes.stabilityPool || 'hash-NOT_FOUND'}',`);
    console.log(`  oracle: '${contractHashes.oracle || 'hash-NOT_FOUND'}',`);
    console.log('}');
    
    // Save to file
    fs.writeFileSync(
      path.join(__dirname, 'contract-hashes.json'),
      JSON.stringify(contractHashes, null, 2)
    );
    console.log('\nSaved to scripts/contract-hashes.json');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nMake sure:');
    console.log('1. Deploys have processed (wait 2-3 minutes)');
    console.log('2. Account has deployed contracts');
  }
}

main().catch(console.error);
