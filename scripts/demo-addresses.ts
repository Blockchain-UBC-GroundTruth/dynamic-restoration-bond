import { loadKeypair } from './demo-common.js';

for (const name of ['deployer', 'company', 'auditor', 'regulator', 'community']) {
  console.log(`${name.padEnd(10)} ${loadKeypair(name).publicKey.toBase58()}`);
}
