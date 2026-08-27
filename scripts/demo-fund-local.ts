import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection, loadKeypair } from './demo-common.js';

const conn = connection('http://127.0.0.1:8899');
const deployer = loadKeypair('deployer');

async function main() {
  let balance = await conn.getBalance(deployer.publicKey);
  if (balance < 10 * LAMPORTS_PER_SOL) {
    const signature = await conn.requestAirdrop(deployer.publicKey, 50 * LAMPORTS_PER_SOL);
    const latest = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature, ...latest }, 'confirmed');
    balance = await conn.getBalance(deployer.publicKey);
  }
  console.log(`${deployer.publicKey.toBase58()}: ${balance / LAMPORTS_PER_SOL} local SOL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
