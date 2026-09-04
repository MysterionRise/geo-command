---
heist: codeguessr-poc-readiness
phase: the-hit
review: blocked-handoff-audit
status: concerns
timestamp: 2026-09-04T18:01:19Z
verdict: READY_WITH_DOCUMENTED_FIXES_FOR_BLOCKED_HANDOFF
---

# Independent Handoff Audit

The branch may be committed and pushed as a blocked engineering handoff only
when the findings below remain explicit. It is not ready to merge as a runnable
real-data PoC.

## Critical: Python Stack I/O is outside the bounded transport

The TypeScript runtime constructs the bounded transport in
`ops/poc/prepare/index.ts:193-220`, but starts the Stack workers separately at
`ops/poc/prepare/index.ts:223-246`. The metadata worker calls the dataset SDK
directly at `ops/poc/stack/stream_metadata.py:202-229`, and the blob worker
constructs its own AWS SDK client at `ops/poc/stack/fetch_blob.py:113-121` and
`ops/poc/stack/fetch_blob.py:193-200`.

The implementation therefore does not enforce or prove the signed exact-
endpoint allowlists, manual redirect rejection, credential confinement,
network-request and byte ceilings, or 32 MiB temporary-disk ceiling across
those worker paths. `reserveTemporaryDisk` exists at
`ops/poc/prepare/capacity.ts:224-234` but has no production caller. Existing
Python tests mock the SDKs and do not establish these live network properties.

This contradicts NFR-011, NFR-012, NFR-014, and Acceptance Criterion 20. Reopen
the affected Stack work under mandatory Red-Green-Refactor evidence before any
full live preparation retry.

## Important: success report can outlive failed artifact publication

`ops/poc/prepare/index.ts:177-182` writes the report before publishing the
artifact. If artifact publication fails, the report can remain with
`outcome: "SUCCESS"` even though no artifact was activated. The ordering test
at `ops/poc/prepare/command.test.ts:236-247` preserves this sequence, while the
publication-failure test at `ops/poc/prepare/command.test.ts:281-293` does not
assert report removal or restoration.

This conflicts with FR-027's successful-run binding. Add a failing regression
test, then make publication transactional or restore/remove the report when
artifact publication fails.

The latest checkpoint reopens WP-010, WP-019, and WP-023 and moves them from
completed to blocked so its lifecycle metadata matches these findings.

## Operational blocker: GitHub status remains unclassified

The latest authorized diagnostic stopped at GitHub Search with
`TransportError|UNSUPPORTED_STATUS`. It established neither the numeric status
nor authentication/rate-limit state. A GitHub-only status/header diagnostic
requires fresh operator authorization and must not read the response body.

## Verified strengths

- The signed Contract SHA-256 is exactly
  `3acc586d8fb479e6edfd2dd43e9f38ed5d8d6268ee5b025b449d3a564b32fe41`.
- The Stack release/revision, source split, deterministic composition, source
  validation, artifact hashing, and server-only game validation are covered by
  focused tests.
- The root route remains synthetic and no live artifact or report exists.
- Scoped secret and stale-authority scans found no new credential material or
  removed operative revision.

The generated `apps/game/tsconfig.tsbuildinfo` change is build-cache noise and
is intentionally excluded from the handoff commit.
