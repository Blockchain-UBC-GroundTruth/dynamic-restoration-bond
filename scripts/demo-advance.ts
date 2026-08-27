/* eslint-disable @typescript-eslint/no-explicit-any */
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  connection,
  loadKeypair,
  programFor,
  readDemoConfig,
  sha256File,
  shortKey,
} from './demo-common.js';

const requestedStep = process.argv[2] ?? 'all';
const validSteps = new Set(['resolve', 'correct', 'release', 'all']);
if (!validSteps.has(requestedStep)) throw new Error('Use: npm run demo:advance -- resolve|correct|release|all');

const config = readDemoConfig();
const conn = connection(config.rpcUrl);
const regulator = loadKeypair('regulator');
if (regulator.publicKey.toBase58() !== config.roles.regulator) {
  throw new Error('The local regulator key does not match public/demo-config.json.');
}
const program = programFor(conn, regulator);
const key = (name: string) => new PublicKey(config.accounts[name]);
const project = key('project');
const bond = key('bond');
const decision = key('decision');
const dispute = key('dispute');
const resolution = key('resolution');
const correction = key('correction');
const reportHash = sha256File('public/demo-evidence/04-community-water-quality-report.pdf');

async function state() {
  const projectAccount = await (program.account as any).project.fetch(project);
  const bondAccount = await (program.account as any).bondEscrow.fetch(bond);
  return { projectAccount, bondAccount };
}

async function resolveDispute() {
  const { projectAccount } = await state();
  if (projectAccount.activeDisputeCount === 0) return;
  const signature = await (program.methods as any)
    .resolveDispute(
      { remediationRequired: {} },
      'The concern is upheld for the demo and requires an append-only liability correction.',
      Array.from(reportHash),
      config.evidence.reportUri,
      true,
    )
    .accountsStrict({ project, regulator: regulator.publicKey, dispute, resolution, bond, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`Resolved dispute: ${signature}`);
}

async function appendCorrection() {
  const { projectAccount } = await state();
  if (projectAccount.outstandingCorrectionCount === 0) return;
  const signature = await (program.methods as any)
    .appendLiabilityCorrection(
      { reaffirmed: {} },
      'Revision 02 retains the 125,000 GTB liability and links the community water report.',
      Array.from(reportHash),
      config.evidence.reportUri,
      null,
      projectAccount.latestCorrection,
    )
    .accountsStrict({ project, regulator: regulator.publicKey, targetDecision: decision, resolution, correction, bond, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`Appended correction: ${signature}`);
}

async function releaseBond() {
  const { bondAccount } = await state();
  if ('released' in bondAccount.status) return;
  const signature = await (program.methods as any)
    .releaseBond()
    .accountsStrict({
      project,
      regulator: regulator.publicKey,
      latestDecision: decision,
      bond,
      vault: key('vault'),
      recipientToken: key('recipientToken'),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log(`Released bond: ${signature}`);
}

async function main() {
  if (requestedStep === 'resolve' || requestedStep === 'all') await resolveDispute();
  if (requestedStep === 'correct' || requestedStep === 'all') await appendCorrection();
  if (requestedStep === 'release' || requestedStep === 'all') await releaseBond();
  const { projectAccount, bondAccount } = await state();
  console.log({
    project: shortKey(project),
    activeDisputes: projectAccount.activeDisputeCount,
    outstandingCorrections: projectAccount.outstandingCorrectionCount,
    revision: projectAccount.currentLiabilityRevision.toString(),
    bondStatus: Object.keys(bondAccount.status)[0],
    released: bondAccount.releasedAmount.toString(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
