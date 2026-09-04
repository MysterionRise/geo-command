---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-08-06T17:03:32Z
updated-at: 2026-08-06T19:12:28Z
next-action: Run WP-028 combined live smoke under signed Contract revision 9
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-024, WP-026]
pending-wps: [WP-025, WP-027, WP-028, WP-029]
failed-wps: []
artifacts:
  - ops/poc/prepare/github-search.ts
  - ops/poc/prepare/github-search-completeness.test.ts
  - ops/poc/prepare/model-run.ts
  - ops/poc/prepare/model-run.test.ts
  - ops/poc/prepare/run-report.test.ts
  - ops/poc/prepare/index.ts
  - ops/poc/prepare/command.test.ts
  - ops/poc/prepare/command-test-harness.ts
  - ops/poc/prepare/integration.test.ts
  - ops/poc/prepare/testdata/captured-run.ts
  - ops/poc/prepare/testdata/captured-responses.ts
  - ops/poc/prepare/testdata/captured-dependencies.ts
---

# Contract Revision 9 Hit Progress

The Source Adapters crew accepted the exact revision-9 GitHub search behavior:
literal profile/tuple authority, Boolean per-page completeness, any-page
provider-incomplete aggregation, exact-total consistency, canonical raw-page
hashing, and frozen per-query classifications. Focused search verification
passed 15/15, the preparation suite passed 314/314, and canonical typecheck
passed.

The Preparation Core crew accepted the matching run-report vocabulary after an
independent review rejected and corrected one test typing error. Successful
reports may now record `PROVIDER_REPORTED_INCOMPLETE` for GitHub only; Stack
success remains complete-only. Focused report verification passed 15/15,
operator TypeScript passed, and isolated captured integration passed 10/10.

The Tooling and Operator Boundary crew is now wiring the frozen search
classifications into the report and the non-sensitive completion warning.
Focused command verification passed 23/23, operator TypeScript passed, and the
full preparation suite passed 322/322 before the captured replay amendment.

Captured replay then exercised a real `incomplete_results:true` response through
the actual search adapter twice. Integration passed 11/11, the amended full
preparation suite passed 323/323, artifact bytes replayed identically across
different execution metadata, reports remained distinct and correlated to the
artifact and snapshot identities, and warning order was proven after report and
publication. No live provider request or artifact publication has occurred in
this batch.
