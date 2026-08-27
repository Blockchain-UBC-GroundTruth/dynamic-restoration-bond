'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Idl, Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import idl from './restoration_bond.json';

if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;

export type ChainStage = 'disputed' | 'correction-required' | 'release-ready' | 'released';
export type WalletRole = 'Regulator' | 'Company' | 'Auditor' | 'Community' | 'Observer';

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
  on?(event: 'accountChanged', handler: (key: PublicKey | null) => void): void;
  removeListener?(event: 'accountChanged', handler: (key: PublicKey | null) => void): void;
};

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  }
}

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
  evidence: { initialUri: string; restoredUri: string; reportUri: string; reportHashHex: string };
};

export type ChainSnapshot = {
  stage: ChainStage;
  activeDisputes: number;
  outstandingCorrections: number;
  liability: number;
  revision: number;
  deposited: number;
  released: number;
  bondStatus: string;
  eventSequence: number;
};

const readOnlyKey = new PublicKey('11111111111111111111111111111111');

function phantomProvider() {
  if (typeof window === 'undefined') return null;
  return window.phantom?.solana ?? window.solana ?? null;
}

async function anchorProgram(config: DemoConfig, provider: PhantomProvider | null) {
  const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
  const connection = new Connection(config.rpcUrl, { commitment: 'confirmed' });
  const wallet = provider?.publicKey
    ? {
        publicKey: provider.publicKey,
        signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => provider.signTransaction(transaction),
        signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => provider.signAllTransactions(transactions),
      }
    : {
        publicKey: readOnlyKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(_transaction: T) => {
          void _transaction;
          throw new Error('Connect Phantom before sending a transaction.');
        },
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(_transactions: T[]) => {
          void _transactions;
          throw new Error('Connect Phantom before sending a transaction.');
        },
      };
  const anchorProvider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  return new Program(idl as Idl, anchorProvider);
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

function roleFor(config: DemoConfig | null, key: PublicKey | null): WalletRole {
  if (!config || !key) return 'Observer';
  const address = key.toBase58();
  if (address === config.roles.regulator) return 'Regulator';
  if (address === config.roles.company) return 'Company';
  if (address === config.roles.auditor) return 'Auditor';
  if (address === config.roles.community) return 'Community';
  return 'Observer';
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('User rejected')) return 'Wallet signature was cancelled.';
    const anchorLine = error.message.split('\n').find((line) => line.includes('Error Message:'));
    return anchorLine?.replace('Error Message:', '').trim() ?? error.message;
  }
  return 'The transaction could not be completed.';
}

export function useGroundTruth() {
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [walletKey, setWalletKey] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionLabel, setTransactionLabel] = useState('');
  const [lastSignature, setLastSignature] = useState('');
  const [error, setError] = useState('');
  const configRef = useRef<DemoConfig | null>(null);

  const role = useMemo(() => roleFor(config, walletKey), [config, walletKey]);
  const seeded = Boolean(config && config.seededAt !== 'not-seeded' && config.accounts.project);

  const refresh = useCallback(async (nextConfig?: DemoConfig) => {
    const activeConfig = nextConfig ?? configRef.current;
    if (!activeConfig || activeConfig.seededAt === 'not-seeded' || !activeConfig.accounts.project) {
      setLoading(false);
      return;
    }
    try {
      const program = await anchorProgram(activeConfig, phantomProvider());
      const [project, bond] = await Promise.all([
        (program.account as any).project.fetch(new PublicKey(activeConfig.accounts.project)),
        (program.account as any).bondEscrow.fetch(new PublicKey(activeConfig.accounts.bond)),
      ]);
      const bondStatus = Object.keys(bond.status)[0] ?? 'unknown';
      const activeDisputes = numberValue(project.activeDisputeCount);
      const outstandingCorrections = numberValue(project.outstandingCorrectionCount);
      const stage: ChainStage = bondStatus === 'released'
        ? 'released'
        : activeDisputes > 0
          ? 'disputed'
          : outstandingCorrections > 0
            ? 'correction-required'
            : 'release-ready';
      setSnapshot({
        stage,
        activeDisputes,
        outstandingCorrections,
        liability: numberValue(project.currentApprovedLiability),
        revision: numberValue(project.currentLiabilityRevision),
        deposited: numberValue(bond.depositedAmount),
        released: numberValue(bond.releasedAmount),
        bondStatus,
        eventSequence: numberValue(project.eventSequence),
      });
      setError('');
    } catch (nextError) {
      setError(`RPC unavailable: ${errorMessage(nextError)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/demo-config.json', { cache: 'no-store' })
      .then((response) => response.json() as Promise<DemoConfig>)
      .then((nextConfig) => {
        if (cancelled) return;
        configRef.current = nextConfig;
        setConfig(nextConfig);
        return refresh(nextConfig);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(errorMessage(nextError));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    const provider = phantomProvider();
    if (!provider) return;
    provider.connect({ onlyIfTrusted: true })
      .then(({ publicKey }) => setWalletKey(publicKey))
      .catch(() => undefined);
    const onAccountChanged = (key: PublicKey | null) => setWalletKey(key);
    provider.on?.('accountChanged', onAccountChanged);
    return () => provider.removeListener?.('accountChanged', onAccountChanged);
  }, []);

  useEffect(() => {
    if (!seeded) return;
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(timer);
  }, [refresh, seeded]);

  const connectWallet = useCallback(async () => {
    const provider = phantomProvider();
    if (!provider?.isPhantom) {
      window.open('https://phantom.com/', '_blank', 'noopener,noreferrer');
      setError('Install Phantom to sign the regulator transactions.');
      return;
    }
    const connected = await provider.connect();
    setWalletKey(connected.publicKey);
    setError('');
  }, []);

  const disconnectWallet = useCallback(async () => {
    await phantomProvider()?.disconnect();
    setWalletKey(null);
  }, []);

  const runTransaction = useCallback(async (label: string, build: (program: Program) => Promise<string>) => {
    if (!config || !seeded) throw new Error('The on-chain demo has not been seeded yet.');
    const provider = phantomProvider();
    if (!provider?.publicKey) throw new Error('Connect Phantom first.');
    if (role !== 'Regulator') throw new Error('Switch Phantom to the configured Regulator demo account.');
    setTransactionLabel(label);
    setError('');
    try {
      const signature = await build(await anchorProgram(config, provider));
      setLastSignature(signature);
      await refresh(config);
      return signature;
    } catch (nextError) {
      const message = errorMessage(nextError);
      setError(message);
      throw new Error(message);
    } finally {
      setTransactionLabel('');
    }
  }, [config, refresh, role, seeded]);

  const resolveDispute = useCallback(() => runTransaction('Recording resolution…', async (program) => {
    const account = (name: string) => new PublicKey(config!.accounts[name]);
    return (program.methods as any)
      .resolveDispute(
        { remediationRequired: {} },
        'The concern is upheld for the demo and requires an append-only liability correction.',
        Array.from(Buffer.from(config!.evidence.reportHashHex, 'hex')),
        config!.evidence.reportUri,
        true,
      )
      .accountsStrict({
        project: account('project'),
        regulator: walletKey!,
        dispute: account('dispute'),
        resolution: account('resolution'),
        bond: account('bond'),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }), [config, runTransaction, walletKey]);

  const appendCorrection = useCallback(() => runTransaction('Appending correction…', async (program) => {
    const account = (name: string) => new PublicKey(config!.accounts[name]);
    const project = await (program.account as any).project.fetch(account('project'));
    return (program.methods as any)
      .appendLiabilityCorrection(
        { reaffirmed: {} },
        'Revision 02 retains the 125,000 GTB liability and links the community water report.',
        Array.from(Buffer.from(config!.evidence.reportHashHex, 'hex')),
        config!.evidence.reportUri,
        null,
        project.latestCorrection,
      )
      .accountsStrict({
        project: account('project'),
        regulator: walletKey!,
        targetDecision: account('decision'),
        resolution: account('resolution'),
        correction: account('correction'),
        bond: account('bond'),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }), [config, runTransaction, walletKey]);

  const releaseBond = useCallback(() => runTransaction('Releasing bond…', async (program) => {
    const account = (name: string) => new PublicKey(config!.accounts[name]);
    return (program.methods as any)
      .releaseBond()
      .accountsStrict({
        project: account('project'),
        regulator: walletKey!,
        latestDecision: account('decision'),
        bond: account('bond'),
        vault: account('vault'),
        recipientToken: account('recipientToken'),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }), [config, runTransaction, walletKey]);

  const explorerUrl = useCallback((addressOrSignature: string, type: 'address' | 'tx' = 'address') => {
    if (!config) return '#';
    const base = `https://explorer.solana.com/${type}/${addressOrSignature}`;
    if (config.cluster === 'devnet') return `${base}?cluster=devnet`;
    return `${base}?cluster=custom&customUrl=${encodeURIComponent(config.rpcUrl)}`;
  }, [config]);

  return {
    config,
    snapshot,
    stage: snapshot?.stage ?? 'disputed' as ChainStage,
    seeded,
    loading,
    walletKey,
    role,
    transactionLabel,
    lastSignature,
    error,
    connectWallet,
    disconnectWallet,
    refresh,
    resolveDispute,
    appendCorrection,
    releaseBond,
    explorerUrl,
  };
}
