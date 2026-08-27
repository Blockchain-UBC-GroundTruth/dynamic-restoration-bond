# GroundTruth

GroundTruth is a Solana-based environmental liability ledger for restoration projects. It links evidence, authorized decisions, disputes, append-only corrections, and a test-token bond whose release is enforced by the program.

## What is implemented

- Responsive GroundTruth project dashboard with Phantom wallet connection, role detection, live account loading, Explorer links, and signed regulator actions.
- Anchor program for project creation, evidence submission/rejection/resubmission/verification, liability proposals and decisions, bond deposit, community disputes, regulator resolution, linked liability corrections/reaffirmations, and guarded bond release.
- PDA-owned legacy SPL Token vault with actual token-account balance checks at release time.
- Atomic dispute counter and bond pause updates.
- Project-scoped event sequencing and material transition events.
- Release guard tests for active disputes, outstanding corrections, stale revisions, insufficient funding, and the valid release path.
- Reproducible local-validator seed scripts that create four role wallets, a zero-decimal GTB mint, evidence history, approved liability, funded vault, and active community dispute.
- Generated Anchor IDL and an SBPF v3 deployable artifact compatible with Solana/Agave 4.x.

The dashboard reads `public/demo-config.json`, loads the authoritative project and bond accounts, and derives its stage from on-chain counters and bond status. The remaining three presentation actions are real transactions signed by the configured Regulator account: resolve the dispute, append the required correction, and release the bond.

## Local development

Requirements are pinned in `Anchor.toml`: Anchor 1.1.2, Solana 4.2.1, Rust stable, and Node.js 22 or later.

```bash
npm install
npm run dev
```

### Rebuild a local on-chain demo

Run these in separate terminals:

```bash
# Terminal 1
npm run demo:keys
npm run demo:validator

# Terminal 2, after the validator starts
npm run demo:fund:local
npm run anchor:build
npm run demo:deploy:local
npm run demo:seed
npm run demo:status
npm run dev
```

Open the local URL printed by Vinext. Run `npm run demo:regulator-key`, import that demo-only private key into Phantom, and connect it. Never put real SOL or assets in a generated demo wallet.

As Regulator, open the active case, sign the resolution, append the linked correction, and release the bond after every guard passes. To verify the same path without Phantom, run `npm run demo:advance -- all`. Run `npm run demo:seed` again to create a fresh project in the disputed starting state.

### Devnet publish

Fund the demo deployer below with about 5 Devnet SOL from a faucet. Devnet SOL has no real value; never send Mainnet SOL or exchange assets to this address.

```text
42v28zkAxL1dN23dtrXiDX1WibvfpfHnsPV19NihDCLH
```

Then run:

```bash
npm run anchor:build
npm run demo:deploy:devnet
GROUNDTRUTH_RPC_URL=https://api.devnet.solana.com npm run demo:seed
```

The public config contains only public addresses and evidence references. All role and deployer secret keys remain under the gitignored `.demo-wallets/` directory.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
cargo test --workspace
npm run anchor:build
npm run demo:status
```

## Program identity

- Program ID: `E33zGy2Sb8qYU4uRMzH59EqCq6Ut75oj8DjUMeTtLXvQ`
- Token model for P0: legacy SPL Token, zero decimals, one liability unit equals one GTB base unit.
- Release model for P0: one full approved release; no partial releases or slashing.

Do not treat the current test token or demo records as financial or ecological verification. GroundTruth records authorized human decisions and enforces the resulting workflow; it does not determine whether an environmental claim is scientifically true.
