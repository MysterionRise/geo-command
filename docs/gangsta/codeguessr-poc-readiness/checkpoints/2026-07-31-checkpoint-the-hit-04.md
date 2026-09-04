---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T16:04:25Z
next-action: Continue Hit
completed-wps:
  - WP-002
  - WP-003
  - WP-004
  - WP-005
  - WP-006
  - WP-007
  - WP-008
  - WP-009
  - WP-010
  - WP-011
pending-wps:
  - WP-001
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
  - ops/poc/prepare/model.ts
  - ops/poc/prepare/model-validation.ts
  - ops/poc/prepare/model-rounds.ts
  - ops/poc/prepare/model.test.ts
  - ops/poc/prepare/model-run.test.ts
  - ops/poc/prepare/run-report.ts
  - ops/poc/prepare/run-report.test.ts
  - ops/poc/prepare/artifact-store.ts
  - ops/poc/prepare/artifact-store.test.ts
  - ops/poc/prepare/capacity.ts
  - ops/poc/prepare/capacity.test.ts
  - docs/gangsta/codeguessr-poc-readiness/plans/2026-07-31-execution-plan.md
---

# Resume Context

Preparation Core is fully accepted after repeated adversarial review and fresh
correction cycles. Its final sweep passed 68/68 focused tests. All production
files are at most 300 lines, all tests are below the 500-line hard block, Core-
only strict typechecking passes, and identifier/whitespace hygiene is clean.

Artifact publication now restores the prior bytes after tested rename or
directory-sync failures using a same-directory hard-link backup. Run reports
are separate, redacted, recursively immutable operational records with bounded
counts and no gameplay compatibility. Capacity accounting meters every signed
dimension transactionally.

The first GitHub-search attempt stalled; its retry was rejected despite a green
test because it handled only one query/page, trusted malformed fields, and
failed typechecking. A later correction correctly escalated a package-boundary
ambiguity: commit-search responses have no path/blob identity. Underboss review
confirmed that FR-020 discovery orders by query index, date, repository, and
commit; WP-013 then resolves path/blob and applies the complete final GitHub
ordering. This clarification is recorded in the execution plan without moving
immutable ingestion into search.

GitHub and Stack source lanes may now execute in parallel. WP-001 remains
verification-pending until Stack Python tests exist and its exact unittest-
discovery command can pass.
