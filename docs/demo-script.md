# GroundTruth demo flow

1. Open the North Ridge Development Site project and explain that the company must restore its former development footprint. Point out the approved liability, fully funded vault, and active dispute.
2. Show that the release checklist names the active dispute as the failed guard.
3. Open the community case and show the supporting report name and content hash.
4. Record the regulator resolution with the correction requirement enabled.
5. Show that the dispute is resolved but release remains paused because a correction is outstanding.
6. Append the linked liability reaffirmation. The original approval remains in the activity trail.
7. Release the bond after all guards turn green.
8. Explain that the production instruction repeats every check on-chain and uses the vault's actual SPL balance.

## Presenter preparation

1. Start the local validator, deploy, and seed using the commands in `README.md`.
2. Run `npm run demo:regulator-key` locally and import the printed demo-only private key into Phantom.
3. Open the local Vinext URL and connect Phantom. The role chip must display `Regulator`.
4. Confirm the green sync strip shows an on-chain event sequence and the project begins with one active dispute.
5. Keep `npm run demo:advance -- all` available as a CLI fallback; it executes the same three regulator instructions.

Each successful browser action displays a transaction link. On localnet the link uses Explorer's custom-cluster URL; after Devnet deployment it automatically uses `cluster=devnet`.
