---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T16:57:55Z
next-action: Continue Hit
completed-wps:
  - WP-001
  - WP-002
  - WP-004
  - WP-006
  - WP-007
  - WP-008
  - WP-009
  - WP-010
  - WP-011
  - WP-012
  - WP-013
  - WP-014
  - WP-015
pending-wps:
  - WP-003
  - WP-005
  - WP-016
  - WP-017
  - WP-018
  - WP-019
  - WP-020
  - WP-021
  - WP-022
  - WP-023
  - WP-024
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/github-lineage.ts
  - ops/poc/prepare/github-lineage.test.ts
  - ops/poc/prepare/github-admission.ts
  - ops/poc/prepare/github-admission.test.ts
  - ops/poc/prepare/provenance-rounds.ts
  - ops/poc/prepare/provenance-rounds.test.ts
  - ops/poc/stack/stream_metadata.py
  - ops/poc/stack/test_stream_metadata.py
---

# Resume Context

The full GitHub provenance lane is accepted. Search, parent/child lineage,
repository/licence/author admission, and three provenance rounds passed 101/101
focused tests plus full typechecking and hygiene checks. Public round identifiers
are opaque canonical hashes rather than commit-derived values; pinned file/blob
attribution is private until reveal; literal configured markers determine the
experimental answer without authorship or generation claims.

The corrected Stack metadata streamer is implementation-accepted at 8/8 locked
Python tests but remains dependency-gated. It now parses the documented provider
row separately from its minimal output and emits honest `sourceEncoding`,
`visitDate`, `revisionDate`, and `committerDate` fields. It does not map those
values into invented first/last-crawl semantics.

Preparation Core is reopened narrowly: the model must align with the honest
Stack projection and raw identity formats, and request policy must allow only
the exact mutable `raw/main/README.md` endpoint needed to compare the current
card release independently from the pinned metadata revision. Prior accepted
Core behavior remains under regression test. WP-017 receives no completion
credit until those dependencies pass.
