---
heist: codeguessr-poc-readiness
phase: the-hit
status: blocked
timestamp: 2026-08-03T14:57:41Z
next-action: Don decides whether the fun PoC may accept a bounded organization-scoped incomplete result set as an explicit warning
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-026]
in-progress-wps: [WP-028]
pending-wps: [WP-025, WP-027, WP-029]
failed-wps: []
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-03-public-oss-org-query-observation.md
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-03-org-scope-live-boundary.md
---

# Organization Scoping Is Not Sufficient

The Don-approved organization-scoped profile is implemented and fully green in
captured verification, but live evidence shows that GitHub can mark the same
five-result public organization population either complete or incomplete. It
can also apply secondary throttling while normal public search quota remains.
Strict FR-020 rejection therefore prevents a reliable unauthenticated fun PoC
even after narrowing the population.

The Underboss recommends a PoC-only Contract revision: accept the exact returned
organization-scoped set when it is structurally valid and within the 300-result
and three-page ceilings, preserve and hash the provider's incomplete flag, and
record it visibly as a run warning. Repository admission, licence, author,
immutable lineage, duplicate rejection, exact 3/2 composition, Stack
requirements, and atomic publication remain unchanged. This would make no
claim that the returned set is the complete GitHub population.

Alternatives are requiring an optional GitHub token without evidence that it
stabilizes completeness, or replacing commit search with a materially larger
organization/repository traversal. Neither is recommended for the simple local
PoC.
