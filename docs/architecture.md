# GroundTruth architecture

## Authority boundary

Solana stores role authorities and enforces who can make each material decision. Evidence files remain off-chain; their exact-byte SHA-256 hash and stable storage reference are recorded on-chain. The blockchain does not decide whether ecological evidence is true.

## Append-only history

Evidence resubmissions, verification decisions, liability decisions, disputes, resolutions, and corrections each receive a separate PDA. `Project` contains counters and current pointers for efficient validation, while the historical accounts remain queryable.

## Release authority

The PDA-owned SPL vault is released only when the current liability decision is approved, project and bond revisions match, required liability and bond amount match, the actual vault balance is sufficient, no dispute is active, no correction remains outstanding, and the bond is not paused or previously released.

`outstanding_correction_count` is maintained atomically because a Solana program cannot scan every historical dispute during one instruction. Each required correction is linked to its resolution and may satisfy it only once.

## Current integration boundary

The frontend reads the project and bond accounts directly from the RPC endpoint in `public/demo-config.json`. Phantom supplies the connected Solana public key and signs the three remaining regulator transactions. Anchor sends the signed transaction through the configured connection, then the UI reloads the authoritative accounts and derives the next stage from their counters and bond status.

The checked-in evidence files are synthetic demo artifacts. Their exact-byte SHA-256 hashes and stable URIs are linked from on-chain records. No off-chain database is authoritative for release decisions.
