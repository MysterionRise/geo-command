---
heist: code-guessing-startup
evidence: source-register-verification
date: 2026-07-12
contract-revision: 6
contract-sha256: 08ef84a2b475a1d3090ef8037d0f4bdaec719bf6682c59fd754bec978b74927f
result: PASS
---

# Source Register Verification

Every SRC row was parsed from Contract Revision 6. For each row, the artifact path was resolved from the project root, the file was required to exist, its SHA-256 was calculated with `shasum -a 256`, and the calculated value was compared byte-for-byte with the registered value. The verification process exited successfully with no missing file or mismatch.

| Source | Result | Verified SHA-256 | Artifact |
|---|---|---|---|
| SRC-001 | PASS | `3ba2f5fb146f55884f344a98c3f55b0f79b757ad47caef9732484ce3235a3347` | `docs/gangsta/code-guessing-startup/recon/2026-07-10-recon-dossier.md` |
| SRC-002 | PASS | `48d04f185ad4afcf803ccf7a8005ed6bb90f0e0fddba168ddeb0ee0c1a262d62` | `docs/gangsta/code-guessing-startup/checkpoints/2026-07-11-checkpoint-the-grilling.md` |
| SRC-003 | PASS | `2f7c6fca45acc7edc6459f03645ee9e20e9249f771577b466908aa76b335b3a6` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-1.md` |
| SRC-004 | PASS | `8b8444e3f84e56a644f29e2716bd46cd85845a47c12d522833279f57bfbcfb60` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-2.md` |
| SRC-005 | PASS | `b81ce70117957c0aaf5dfde32a7b44615e972ae553a9a9f7d8562e6aa0306e49` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-3.md` |
| SRC-006 | PASS | `46297f1faf297051f6421c0af1e3914b015d3e7c3bd1b0375cf488559609b272` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-4.md` |
| SRC-007 | PASS | `2297b9d1ba91cfedbb6db54943e3a19d63d8f863f8f5c7bb9287b81b0f8f316f` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-5.md` |
| SRC-008 | PASS | `229eb88c5ab1a959b03e2bce2f8864fcf3ed91f6be2c385330cdf29a78c8a5c6` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-contract-revalidation-report.md` |
| SRC-009 | PASS | `5311d42e17874a879637158344d967ac3c3e114465a4765df583c93f006900ff` | `docs/gangsta/code-guessing-startup/evidence/omerta-1.11.2.md` |
| SRC-010 | PASS | `4cdfb168f7306bfc242637dfb1b85e57dab2e277d1eac8e7d5fb5c6331855e29` | `docs/gangsta/code-guessing-startup/reviews/2026-07-11-consigliere-review-6.md` |

## Structural Sweep

- Portable source paths: PASS; Contract contains no `/Users/` path.
- Requirement/decision definitions: 64.
- Requirement-to-acceptance rows: 64.
- Coverage difference: none.
- Acceptance criteria: 19.
- Contract code fences: zero.
