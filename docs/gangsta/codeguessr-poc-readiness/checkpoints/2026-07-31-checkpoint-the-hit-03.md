---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T15:14:47Z
next-action: Continue Hit
completed-wps: [WP-002, WP-004, WP-005, WP-006, WP-007, WP-011]
pending-wps:
  - WP-001
  - WP-003
  - WP-008
  - WP-009
  - WP-010
  - WP-012
  - WP-013
  - WP-014
  - WP-015
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
  - ops/poc/profiles/local-real-rounds.v1.json
  - ops/poc/prepare/profile.ts
  - ops/poc/prepare/profile.test.ts
  - ops/poc/prepare/canonical.ts
  - ops/poc/prepare/canonical.test.ts
  - ops/poc/prepare/request-policy.ts
  - ops/poc/prepare/request-policy.test.ts
  - ops/poc/prepare/transport.ts
  - ops/poc/prepare/transport.test.ts
  - ops/poc/prepare/retry.ts
  - ops/poc/prepare/retry.test.ts
---

# Resume Context

Preparation Core opened the source-adapter gate after two audit/correction
cycles. The accepted profile now includes deterministic clue and explanation
templates; the request policy forwards only a narrow benign header allowlist;
and the transport deadline covers response-body consumption as well as the
initial fetch. Exact combined evidence is 47/47 focused tests, passing ops
typecheck, and clean identifier/whitespace hygiene.

WP-003 remains pending because the separate run-record parser still lacks some
Contract-defined query, configuration, completeness, byte-total, retry/wait,
and outcome-count fields. Its public/private round parsers, five-to-five binding,
and source consistency checks are implemented and green, but the package earns
no completion credit until the remaining exact-shape correction passes review.

The GitHub source lane is now dispatched through its Capo for sequential work
on commit search, immutable lineage, repository/licence/author admission, and
three honest provenance rounds. Stack metadata and blob execution remains gated
on its later dependency boundaries.
