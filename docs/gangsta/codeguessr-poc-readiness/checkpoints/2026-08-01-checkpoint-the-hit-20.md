---
heist: codeguessr-poc-readiness
phase: the-hit
status: blocked
timestamp: 2026-08-01T20:36:43Z
next-action: Don chooses strict organization-scoped search or a Contract revision that permits incomplete global populations
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-026]
in-progress-wps: [WP-028]
pending-wps: [WP-025, WP-027, WP-029]
failed-wps: []
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-live-smoke-attempt-1.md
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-live-smoke-attempt-2.md
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-live-github-date-observation.md
---

# Don Architecture Decision Required

Three bounded implementation hypotheses corrected independently proven defects:
live provider superset projection and bounded queries, encoded-response byte
accounting, and canonical millisecond timestamp parsing/ordering. Each has
focused RED/Green evidence; the preparation suite now passes 309/309 and the
full typecheck passes.

The post-fix live boundary still fails because GitHub intermittently marks one
of the global marker populations incomplete and sometimes applies secondary
throttling. Contract FR-020 correctly requires incomplete populations to fail
closed. A further implementation attempt would therefore be an architectural
choice, not another bug fix.

The Underboss recommends keeping strict completeness and narrowing the two
marker searches to project-controlled public open-source organization scopes.
This preserves real GitHub crawling, dynamic repository discovery, licence and
author admission, and the 300-result ceiling without seeding repository URLs.
The alternative is a new Contract revision that treats incomplete global
results as an acceptable PoC population, weakening the current deterministic
discovery claim.

No generated artifact exists. The last valid-artifact boundary remains intact,
and WP-025 is not authorized to mount placeholder data.
