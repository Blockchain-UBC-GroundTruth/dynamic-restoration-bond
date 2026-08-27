import { AnchorProvider, Idl, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const IDL = JSON.parse(readFileSync(resolve(ROOT, 'lib/restoration_bond.json'), 'utf8')) as Idl;

export const PROGRAM_ID = new PublicKey('E33zGy2Sb8qYU4uRMzH59EqCq6Ut75oj8DjUMeTtLXvQ');
export const DEFAULT_RPC = process.env.GROUNDTRUTH_RPC_URL ?? 'http://127.0.0.1:8899';
export const SITE_BASE = 'https://groundtruth-restoration-bond.ryu-taeram.chatgpt.site';
export const DEMO_AMOUNT = 125_000;

export type DemoConfig = {
  version: 1;
  cluster: 'localnet' | 'devnet';
  rpcUrl: string;
  programId: string;
  seededAt: string;
  projectName: string;
  liabilityAmount: number;
  accounts: Record<string, string>;
  roles: Record<'company' | 'auditor' | 'regulator' | 'community', string>;
  evidence: {
    initialUri: string;
    restoredUri: string;
    reportUri: string;
    reportHashHex: string;
  };
};

export function connection(rpcUrl = DEFAULT_RPC) {
  return new Connection(rpcUrl, { commitment: 'confirmed' });
}

export function loadKeypair(name: string) {
  const bytes = JSON.parse(readFileSync(resolve(ROOT, '.demo-wallets', `${name}.json`), 'utf8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function programFor(conn: Connection, signer: Keypair) {
  const provider = new AnchorProvider(conn, new Wallet(signer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  return new Program(IDL, provider);
}

export function sha256Bytes(data: Uint8Array | string) {
  return Uint8Array.from(createHash('sha256').update(data).digest());
}

export function sha256File(relativePath: string) {
  return sha256Bytes(readFileSync(resolve(ROOT, relativePath)));
}

export function u64Seed(value: bigint | number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}

export function pda(...seeds: Uint8Array[]) {
  return PublicKey.findProgramAddressSync(seeds.map((seed) => Buffer.from(seed)), PROGRAM_ID)[0];
}

export function projectPda(company: PublicKey, projectId: Uint8Array) {
  return pda(Buffer.from('project'), company.toBuffer(), projectId);
}

export function bondPda(project: PublicKey) {
  return pda(Buffer.from('bond'), project.toBuffer());
}

export function indexedPda(prefix: string, project: PublicKey, index: bigint | number) {
  return pda(Buffer.from(prefix), project.toBuffer(), u64Seed(index));
}

export function childPda(prefix: string, parent: PublicKey) {
  return pda(Buffer.from(prefix), parent.toBuffer());
}

export function shortKey(key: PublicKey | string) {
  const value = typeof key === 'string' ? key : key.toBase58();
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function readDemoConfig() {
  return JSON.parse(readFileSync(resolve(ROOT, 'public/demo-config.json'), 'utf8')) as DemoConfig;
}

export function rootPath(...parts: string[]) {
  return resolve(ROOT, ...parts);
}
