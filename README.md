# GroundTruth

GroundTruth is a Solana-based environmental liability ledger for restoration projects. It links evidence, authorized decisions, disputes, append-only corrections, and a test-token bond whose release is enforced by the program.

## What is implemented

- Responsive GroundTruth project dashboard with role switching and a complete interactive demo flow.
- Anchor program for project creation, evidence submission/rejection/resubmission/verification, liability proposals and decisions, bond deposit, community disputes, regulator resolution, linked liability corrections/reaffirmations, and guarded bond release.
- PDA-owned legacy SPL Token vault with actual token-account balance checks at release time.
- Atomic dispute counter and bond pause updates.
- Project-scoped event sequencing and material transition events.
- Release guard tests for active disputes, outstanding corrections, stale revisions, insufficient funding, and the valid release path.
- Generated Anchor IDL and deployable SBF artifact.

The current website uses a deterministic in-browser scenario so the product flow can be reviewed without a wallet. The Anchor program is built and ready for local-validator integration. Phantom, Supabase Storage, live account loading, and Devnet deployment are the next integration slice.

## Local development

Requirements are pinned in `Anchor.toml`: Anchor 1.1.2, Solana 4.2.1, Rust stable, and Node.js 22 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Click the connected-wallet control to cycle through the four demo roles. As Regulator, open the active case and record its resolution, append the required correction, then release the bond after every guard passes.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
cargo test --workspace
anchor build
```

## Program identity

- Program ID: `E33zGy2Sb8qYU4uRMzH59EqCq6Ut75oj8DjUMeTtLXvQ`
- Token model for P0: legacy SPL Token, zero decimals, one liability unit equals one GTB base unit.
- Release model for P0: one full approved release; no partial releases or slashing.

Do not treat the current test token or demo records as financial or ecological verification. GroundTruth records authorized human decisions and enforces the resulting workflow; it does not determine whether an environmental claim is scientifically true.
