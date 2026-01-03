#!/usr/bin/env node
/**
 * Check deploy status and get contract hashes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = 'https://node.testnet.casper.network/rpc';

async function checkDeploy(deployHash) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'info_get_deploy',
      params: { deploy_hash: deployHash }
    })
  });
  
  const data = await response.json();
  const result = data.result || {};
  const execResults = result.execution_results || [];
  
  if (execResults.length > 0) {
    const execResult = execResults[0].result || {};
    if (execResult.Success) {
      return { status: 'success', result: execResult.Success };
    } else if (execResult.Failure) {
      return { status: 'failed', error: execResult.Failure };
    }
  }
  
  return { status: 'pending' };
}

async function main() {
  // Read deploy hashes
  const hashesPath = path.join(__dirname, 'deploy-hashes.json');
  if (!fs.existsSync(hashesPath)) {
    console.log('No deploy-hashes.json found. Run deploy-contracts.mjs first.');
    return;
  }
  
  const hashes = JSON.parse(fs.readFileSync(hashesPath, 'utf8'));
  
  console.log('=== Deploy Status Check ===\n');
  
  for (const [name, hash] of Object.entries(hashes)) {
    console.log(`${name}:`);
    console.log(`  Hash: ${hash}`);
    
    const result = await checkDeploy(hash);
    console.log(`  Status: ${result.status.toUpperCase()}`);
    
    if (result.status === 'failed') {
      console.log(`  Error: ${JSON.stringify(result.error).slice(0, 100)}`);
    }
    console.log();
  }
  
  console.log('Explorer links:');
  for (const [name, hash] of Object.entries(hashes)) {
    console.log(`  ${name}: https://testnet.cspr.live/deploy/${hash}`);
  }
}

main().catch(console.error);
