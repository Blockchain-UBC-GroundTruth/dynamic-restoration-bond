import anchor from '@coral-xyz/anchor';
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  DEFAULT_RPC,
  DEMO_AMOUNT,
  PROGRAM_ID,
  SITE_BASE,
  bondPda,
  childPda,
  connection,
  indexedPda,
  loadKeypair,
  programFor,
  projectPda,
  rootPath,
  sha256Bytes,
  sha256File,
  shortKey,
} from './demo-common.js';

const rpcUrl = DEFAULT_RPC;
const { BN } = anchor;
const cluster = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost') ? 'localnet' : 'devnet';
const conn = connection(rpcUrl);
const deployer = loadKeypair('deployer');
const company = loadKeypair('company');
const auditor = loadKeypair('auditor');
const regulator = loadKeypair('regulator');
const community = loadKeypair('community');

const devnetPauseMs = Number(process.env.GROUNDTRUTH_RPC_PAUSE_MS ?? 1_500);
async function paceRpc() {
  if (cluster === 'devnet' && devnetPauseMs > 0) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, devnetPauseMs));
  }
}

async function ensureFunding() {
  let balance = await conn.getBalance(deployer.publicKey);
  if (cluster === 'localnet' && balance < 10 * LAMPORTS_PER_SOL) {
    const signature = await conn.requestAirdrop(deployer.publicKey, 50 * LAMPORTS_PER_SOL);
    const latest = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature, ...latest }, 'confirmed');
    balance = await conn.getBalance(deployer.publicKey);
  }
  const minimumDeployerBalance = cluster === 'localnet' ? 2 : 1.2;
  if (balance < minimumDeployerBalance * LAMPORTS_PER_SOL) {
    throw new Error(`Demo deployer ${deployer.publicKey.toBase58()} needs at least ${minimumDeployerBalance} SOL on ${cluster} before seeding.`);
  }

  const minimumRoleBalance = cluster === 'localnet' ? 0.4 : 0.08;
  const roleFundingAmount = cluster === 'localnet' ? 0.8 : 0.15;
  for (const role of [company, auditor, regulator, community]) {
    if ((await conn.getBalance(role.publicKey)) < minimumRoleBalance * LAMPORTS_PER_SOL) {
      const transaction = new Transaction().add(SystemProgram.transfer({
        fromPubkey: deployer.publicKey,
        toPubkey: role.publicKey,
        lamports: roleFundingAmount * LAMPORTS_PER_SOL,
      }));
      await sendAndConfirmTransaction(conn, transaction, [deployer], { commitment: 'confirmed' });
      await paceRpc();
    }
  }
}

async function main() {
  console.log(`Seeding GroundTruth on ${cluster} (${rpcUrl})`);
  await ensureFunding();

  const mint = await createMint(conn, deployer, deployer.publicKey, null, 0);
  await paceRpc();
  const companyToken = await getOrCreateAssociatedTokenAccount(conn, deployer, mint, company.publicKey);
  await paceRpc();
  await mintTo(conn, deployer, mint, companyToken.address, deployer, DEMO_AMOUNT);
  await paceRpc();

  const runId = `${cluster}-${Date.now()}`;
  const projectId = sha256Bytes(`groundtruth-north-ridge-${runId}`);
  const project = projectPda(company.publicKey, projectId);
  const bond = bondPda(project);
  const vault = getAssociatedTokenAddressSync(mint, bond, true);
  const evidence0 = indexedPda('evidence', project, 0);
  const evidence1 = indexedPda('evidence', project, 1);
  const verification0 = childPda('verification', evidence0);
  const verification1 = childPda('verification', evidence1);
  const proposal = indexedPda('liability_proposal', project, 0);
  const decision = childPda('liability_decision', proposal);
  const dispute = indexedPda('dispute', project, 0);
  const resolution = childPda('resolution', dispute);
  const correction = indexedPda('correction', project, 0);

  const projectMetadataHash = sha256File('public/demo-evidence/06-project-and-evidence-metadata.json');
  const initialHash = sha256File('public/demo-evidence/01-drone-initial-sparse-vegetation.png');
  const restoredHash = sha256File('public/demo-evidence/02-drone-resubmission-restored.png');
  const reportHash = sha256File('public/demo-evidence/04-community-water-quality-report.pdf');
  const vegetationCsvHash = sha256File('public/demo-evidence/05-vegetation-analysis-summary.csv');
  const initialUri = `${SITE_BASE}/demo-evidence/01-drone-initial-sparse-vegetation.png`;
  const restoredUri = `${SITE_BASE}/demo-evidence/02-drone-resubmission-restored.png`;
  const reportUri = `${SITE_BASE}/demo-evidence/04-community-water-quality-report.pdf`;
  const metadataUri = `${SITE_BASE}/demo-evidence/06-project-and-evidence-metadata.json`;

  const companyProgram = programFor(conn, company);
  await (companyProgram.methods as any)
    .createProject(
      Array.from(projectId),
      auditor.publicKey,
      regulator.publicKey,
      community.publicKey,
      null,
      Array.from(projectMetadataHash),
      metadataUri,
      company.publicKey,
    )
    .accountsStrict({
      company: company.publicKey,
      project,
      bond,
      tokenMint: mint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  await paceRpc();

  await (companyProgram.methods as any)
    .submitEvidence(Array.from(initialHash), initialUri, 'drone-multispectral', metadataUri)
    .accountsStrict({ project, company: company.publicKey, evidence: evidence0, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  const auditorProgram = programFor(conn, auditor);
  await (auditorProgram.methods as any)
    .rejectEvidence(
      'Vegetation coverage is 37.4%, below the fictional 40% restoration target.',
      Array.from(vegetationCsvHash),
      `${SITE_BASE}/demo-evidence/05-vegetation-analysis-summary.csv`,
    )
    .accountsStrict({ project, auditor: auditor.publicKey, evidence: evidence0, decision: verification0, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  await (companyProgram.methods as any)
    .resubmitEvidence(Array.from(restoredHash), restoredUri, 'drone-multispectral', metadataUri)
    .accountsStrict({ project, company: company.publicKey, previousEvidence: evidence0, evidence: evidence1, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  await (auditorProgram.methods as any)
    .verifyEvidence()
    .accountsStrict({ project, auditor: auditor.publicKey, evidence: evidence1, decision: verification1, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  const currencyCode = Buffer.alloc(8);
  currencyCode.write('GTB');
  await (companyProgram.methods as any)
    .proposeLiabilityChange(new BN(DEMO_AMOUNT), Array.from(currencyCode), Array.from(restoredHash), restoredUri, null)
    .accountsStrict({ project, company: company.publicKey, evidence: evidence1, proposal, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  const regulatorProgram = programFor(conn, regulator);
  await (regulatorProgram.methods as any)
    .approveLiabilityChange('Verified restoration evidence supports the demonstration liability amount.')
    .accountsStrict({ project, regulator: regulator.publicKey, proposal, evidence: evidence1, decision, bond, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  await (companyProgram.methods as any)
    .depositBond(new BN(DEMO_AMOUNT))
    .accountsStrict({ project, company: company.publicKey, bond, companyToken: companyToken.address, vault, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  await paceRpc();

  const communityProgram = programFor(conn, community);
  await (communityProgram.methods as any)
    .openDispute(
      'Community screening found fictional heavy-metal threshold exceedances at downstream monitoring reach B.',
      Array.from(reportHash),
      reportUri,
    )
    .accountsStrict({ project, communityAuthority: community.publicKey, targetDecision: decision, dispute, bond, systemProgram: SystemProgram.programId })
    .rpc();
  await paceRpc();

  let guardVerified = false;
  try {
    await (regulatorProgram.methods as any)
      .releaseBond()
      .accountsStrict({
        project,
        regulator: regulator.publicKey,
        latestDecision: decision,
        bond,
        vault,
        recipientToken: companyToken.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  } catch {
    guardVerified = true;
  }
  if (!guardVerified) throw new Error('Release guard failed: release unexpectedly succeeded during an active dispute.');

  const config = {
    version: 1 as const,
    cluster,
    rpcUrl,
    programId: PROGRAM_ID.toBase58(),
    seededAt: new Date().toISOString(),
    projectName: 'North Ridge Development Site',
    liabilityAmount: DEMO_AMOUNT,
    accounts: {
      project: project.toBase58(),
      bond: bond.toBase58(),
      vault: vault.toBase58(),
      mint: mint.toBase58(),
      recipientToken: companyToken.address.toBase58(),
      rejectedEvidence: evidence0.toBase58(),
      verifiedEvidence: evidence1.toBase58(),
      proposal: proposal.toBase58(),
      decision: decision.toBase58(),
      dispute: dispute.toBase58(),
      resolution: resolution.toBase58(),
      correction: correction.toBase58(),
    },
    roles: {
      company: company.publicKey.toBase58(),
      auditor: auditor.publicKey.toBase58(),
      regulator: regulator.publicKey.toBase58(),
      community: community.publicKey.toBase58(),
    },
    evidence: {
      initialUri,
      restoredUri,
      reportUri,
      reportHashHex: Buffer.from(reportHash).toString('hex'),
    },
  };

  mkdirSync(rootPath('public'), { recursive: true });
  writeFileSync(rootPath('public/demo-config.json'), `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Project ${shortKey(project)} seeded in disputed state.`);
  console.log(`Regulator ${regulator.publicKey.toBase58()}`);
  console.log('Release guard during active dispute: VERIFIED');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
