# GroundTruth demo evidence pack

This folder contains a fully synthetic dataset for the GroundTruth dynamic restoration bond hackathon demonstration. Every place, party, measurement, threshold, and result is fictional. Do not use these files for scientific, legal, regulatory, environmental, or health decisions.

## Suggested demo order

1. Upload `01-drone-initial-sparse-vegetation.png` as project-operator evidence revision 1.
2. Use `05-vegetation-analysis-summary.csv` to show 37.4% coverage against the fictional 40% target, then reject the revision.
3. Upload `02-drone-resubmission-restored.png` as correction revision 2 and verify its 68.2% coverage.
4. Upload `03-community-water-sampling.png` and `04-community-water-quality-report.pdf` as community supporting evidence.
5. Open a dispute against liability revision 3. The report's fictional exceedances should pause release.
6. Resolve the dispute, record the correction, and demonstrate guarded bond release.

## Integrity and metadata

- `06-project-and-evidence-metadata.json` describes the project, evidence roles, revisions, timestamps, and expected workflow decisions.
- `SHA256SUMS.txt` contains the digest to display before each upload or persist alongside an off-chain URI.
- Regenerate the digest file after changing any asset: `shasum -a 256 0* > SHA256SUMS.txt` from this directory, excluding `SHA256SUMS.txt` itself.

The three PNG files were created with OpenAI's built-in image generation tool and visibly marked `SIMULATED DEMO EVIDENCE`. The PDF is generated from `scripts/create-demo-water-report.py`.
