# GroundTruth architecture

## Authority boundary

Solana stores role authorities and enforces who can make each material decision. Evidence files remain off-chain; their exact-byte SHA-256 hash and stable storage reference are recorded on-chain. The blockchain does not decide whether ecological evidence is true.

## Append-only history

Evidence resubmissions, verification decisions, liability decisions, disputes, resolutions, and corrections each receive a separate PDA. `Project` contains counters and current pointers for efficient validation, while the historical accounts remain queryable.

## Release authority

The PDA-owned SPL vault is released only when the current liability decision is approved, project and bond revisions match, required liability and bond amount match, the actual vault balance is sufficient, no dispute is active, no correction remains outstanding, and the bond is not paused or previously released.

`outstanding_correction_count` is maintained atomically because a Solana program cannot scan every historical dispute during one instruction. Each required correction is linked to its resolution and may satisfy it only once.

## Current integration boundary

The frontend is a complete interactive scenario backed by local React state. The next slice replaces that adapter with generated Anchor client calls while preserving the same domain states and view components. Supabase remains an index and file-metadata service; it is never authoritative for release decisions.
