import { PublicKey } from '@solana/web3.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { connection, loadKeypair, programFor, readDemoConfig } from './demo-common.js';

const config = readDemoConfig();
const conn = connection(config.rpcUrl);
const program = programFor(conn, loadKeypair('deployer'));

async function main() {
  const project = await (program.account as any).project.fetch(new PublicKey(config.accounts.project));
  const bond = await (program.account as any).bondEscrow.fetch(new PublicKey(config.accounts.bond));
  console.log({
    cluster: config.cluster,
    project: config.accounts.project,
    activeDisputes: project.activeDisputeCount,
    outstandingCorrections: project.outstandingCorrectionCount,
    liability: project.currentApprovedLiability.toString(),
    revision: project.currentLiabilityRevision.toString(),
    bondStatus: Object.keys(bond.status)[0],
    vaultBalance: bond.depositedAmount.toString(),
    releasedAmount: bond.releasedAmount.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
