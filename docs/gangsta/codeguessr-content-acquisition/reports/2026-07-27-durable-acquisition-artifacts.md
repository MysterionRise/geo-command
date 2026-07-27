---
heist: codeguessr-content-acquisition
phase: the-hit
territory: real-rehearsal-prerequisite
status: accepted
timestamp: 2026-07-27T22:17:01+01:00
advanced-wps: [WP-024, WP-025]
completed-wps: []
---

# Durable Acquisition Artifacts Report

## Accepted Outcomes

- A completed acquisition serializes its full immutable draft and checkpoint and stores both through the existing authenticated encrypted object store.
- A third deterministic encrypted artifact index binds the complete draft/checkpoint storage identities to their logical draft and checkpoint hashes.
- `DRAFT_COMPLETED.subjectHash` is the artifact-index object ID. The durable audit chain can therefore locate and validate both encrypted output artifacts even if the process exits before printing its receipt.
- Persistence of draft, checkpoint and index precedes completion audit. A persistence or completion-audit failure removes every newly created derived object and reports a categorical failure.
- Reused immutable objects are not removed during rollback.
- The production operator command requires prepared external state before transport construction or network access.
- The production command returns only `DRAFT_REVIEW_REQUIRED`, draft/checkpoint hashes and encrypted artifact identities. It does not print the draft, source path, code, marker or restricted evidence.
- Source-receipt-only behavior remains available only through an explicitly named internal operation step and is not reachable from the production CLI dependency set.

## TDD and Independent Audit

Initial RED cases proved that the draft/checkpoint were not stored, failed completion auditing had no derived objects to roll back, and the command returned its complete restricted draft.

The first GREEN stored both artifacts, rolled them back on audit failure and replaced the command output with a metadata-only receipt.

Independent audit then returned two Important findings:

1. optional state still left a receipt-only persistence bypass;
2. `DRAFT_COMPLETED` did not durably identify the encrypted draft and checkpoint objects.

Corrective RED cases proved that missing state still reached the network and that completion lacked an artifact index and three-object rollback. The correction made state mandatory for the real command and introduced the audit-bound encrypted index.

The independent re-audit reports no Critical, Important or Minor findings and marks the checkpoint READY.

Final root verification:

- workspace TAP: 1/1 pass;
- Vitest: 60/60 files and 1,921/1,921 tests pass;
- recursive workspace and operator TypeScript typecheck: pass;
- production game build and acquisition containment: 3/3 pass;
- diff hygiene: pass.

## Residual Boundary

This is an accepted prerequisite, not WP-024 or WP-025 completion.

Validated rate-limit pauses are not yet converted into durable paused checkpoints, and no explicit operator resume path yet revalidates their source, policy, operator, tool and stored-object bindings.

The active controls remain deliberately non-effective. No live GitHub acquisition, real draft, independent content review, promotion, activation or real-content playable rehearsal is claimed.
