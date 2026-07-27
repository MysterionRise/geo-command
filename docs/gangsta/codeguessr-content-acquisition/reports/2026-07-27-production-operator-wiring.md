---
heist: codeguessr-content-acquisition
phase: the-hit
territory: real-rehearsal-prerequisite
status: accepted
timestamp: 2026-07-27T22:04:07+01:00
advanced-wps: [WP-024, WP-025]
completed-wps: []
---

# Production Operator Wiring Prerequisite Report

## Accepted Outcomes

- The production operator command preflights project authorization and approved external state before its first network request.
- External state requires an absolute root outside the repository, owner identity, `0700` directories, explicit encrypted-volume and acquisition-ownership attestations, and an exact canonical 32-byte base64 key.
- Snapshot and audit child directories are created and validated during preflight, revalidated before opening, and rejected on symlink, type, permission, ownership or root-identity drift.
- Decoded key bytes have an idempotent disposal capability. The command invokes it on source failure, state-opening failure, acquisition failure and success; the real store receives its own internal key copy before disposal.
- `GitHubObjectAdapter` uses the existing bounded transport for exact immutable Git tree and blob endpoints. It rejects malformed, truncated, non-canonical or size-mismatched responses; the tree walker and blob loader then verify the actual Git object identities.
- The response-date-authorized operator run opens the real encrypted object store and project-register-bound append-only audit sink.
- The production composition reaches the existing offline orchestrator and can return only the quarantined `DRAFT_REVIEW_REQUIRED` draft/checkpoint result. It gains no promotion or publication capability.
- Operator-state failures remain categorical as `OPERATOR_STATE_REJECTED`; unknown acquisition failures remain fail-closed.
- Acquisition dependencies remain available only through the Node/operator subpath and are excluded from participant surfaces and production artifacts.

## TDD and Independent Audit

The initial RED cases covered exact tree/blob adapter behavior, external-state validation and a full deterministic command composition from certified commit receipt through encrypted-store/audit capabilities to a quarantined draft.

The first independent audit returned two Important findings:

1. child directories were first validated only after source network activity, and decoded key bytes lacked an explicit disposal path when source acquisition failed;
2. a categorical state-opening error was rewritten to generic `ACQUISITION_REJECTED`.

Corrective RED cases reproduced malformed child state during preflight, disposal before opening, command-level disposal and categorical opening failure. The minimal correction moved child validation into preflight, added idempotent disposal plus open-time revalidation, disposed from the command `finally`, and preserved `OperatorCommandError`.

The independent re-audit reports no Critical, Important or Minor findings and marks the checkpoint READY.

Final root verification:

- workspace TAP: 1/1 pass;
- Vitest: 60/60 files and 1,919/1,919 tests pass;
- recursive workspace and operator TypeScript typecheck: pass;
- production game build and acquisition containment: 3/3 pass;
- diff hygiene: pass.

## Residual Boundary

This is an accepted implementation prerequisite, not completion of WP-024 or WP-025.

The derived draft and checkpoint currently return to the operator process but are not yet written as durable, project-controlled run evidence. Rate-limit and transient-failure pauses are not yet resumable from the checkpoint.

The active repository, attribution and operator controls remain deliberately non-effective and contain no fabricated approval. Consequently, no live acquisition, real draft, human review, promotion, activation or real-content playable rehearsal is claimed.

The next safe implementation slice is a durable draft/checkpoint evidence sink with resume validation. A live WP-024 or WP-025 run remains contingent on real project-controlled authorization.
