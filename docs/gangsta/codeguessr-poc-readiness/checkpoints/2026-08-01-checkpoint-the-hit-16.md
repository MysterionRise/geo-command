---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-08-01T20:01:57Z
next-action: Correct the captured-only GitHub search assumptions through a fresh TDD Worker, then retry WP-028
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-026]
in-progress-wps: [WP-012, WP-028]
pending-wps: [WP-025, WP-027, WP-029]
failed-wps: []
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-live-smoke-attempt-1.md
---

# GitHub Search Interrogation Complete

The first revision-8 live smoke failed before artifact publication. The
Interrogation Brief reproduced the failure at the GitHub search boundary after
a passing Stack preflight. Cross-examination of live count/key metadata,
captured tests, Contract FR-020, and GitHub's official commit-search qualifier
documentation established the root cause: captured responses taught the
adapter to reject documented extra provider fields, while the unqualified
profile populations cannot remain both complete and within 300 results.

The single theory to test is that validating/projecting only required GitHub
identity fields and fixing the project-controlled queries with documented
bounded qualifiers will make discovery Contract-compliant without weakening
missing-field, identity, completeness, duplication, or ceiling rejection.
WP-012 is reopened for that test-first correction. WP-028 remains incomplete;
no artifact exists and WP-025 stays blocked.
