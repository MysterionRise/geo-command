---
heist: codeguessr-content-acquisition
phase: the-hit
status: in-progress
timestamp: 2026-07-27T18:35:38+01:00
next-action: Dispatch the Secure Operator Operations work packages
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014]
pending-wps: [WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-025, WP-026, WP-027]
failed-wps: []
artifacts:
  - tests/e2e/provenance-accessibility.spec.ts
  - tests/e2e/language-accessibility.spec.ts
  - tests/e2e/privacy-accessibility.spec.ts
  - docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-foundation-territory.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-github-core-territory.md
  - packages/content/src/evidence/
  - packages/content/src/rights/source-regime.ts
  - packages/content/src/acquisition/policy/
  - packages/content/src/acquisition/github/
  - packages/content/src/acquisition/draft/
  - packages/domain/src/provenance/index.ts
  - ops/content/policies/
---

## Resume Context

The Don authorized the baseline repair, initial snapshot, safehouse, and The Hit. Initial commit `f6a085a` exists on `heist/code-guessing-startup`; `.worktrees/` is ignored; branch `codex/heist/codeguessr-content-acquisition` is checked out at `/Users/konstantinp/Documents/CodeGuessr/.worktrees/codeguessr-content-acquisition`.

The clean safehouse baseline passes workspace/unit tests (1,622/1,622 plus workspace TAP), TypeScript typecheck, accessibility (37/37), performance (6/6), and Playwright (13/13).

The Evidence and Trusted Policy foundation territory is accepted after independent verification: 350 focused tests and the full workspace typecheck pass. Licensed GitHub evidence, the Revision 7 fixed provenance regime, policy validation, and operator authorization are implemented. Historical evidence and source-regime compatibility remain covered.

The operational policy and operator registers are intentionally non-effective. They contain no fabricated approval. Live acquisition remains blocked until real repository/subtree, vendor-document, dated policy, and named-operator approvals exist.

Promotion of real drafts remains externally blocked until four independent qualified human reviewers are available; implementation may proceed to review-ready drafts and synthetic rehearsal coverage.

The GitHub Acquisition Core territory is accepted after 101/101 focused tests and content-package typecheck. It provides strict immutable request, transport, traversal, checkpoint, screening, diff, marker, license, and non-publishable-draft boundaries. It remains inert until secure operator storage and command surfaces are accepted.
