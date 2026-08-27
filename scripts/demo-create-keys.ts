import { Keypair } from '@solana/web3.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { rootPath } from './demo-common.js';

const walletDir = rootPath('.demo-wallets');
mkdirSync(walletDir, { recursive: true });

for (const name of ['deployer', 'company', 'auditor', 'regulator', 'community']) {
  const path = rootPath('.demo-wallets', `${name}.json`);
  if (existsSync(path)) {
    console.log(`${name}: already exists`);
    continue;
  }
  const keypair = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  console.log(`${name}: ${keypair.publicKey.toBase58()}`);
}

console.log('Demo keys are gitignored. Never fund them with real assets.');
