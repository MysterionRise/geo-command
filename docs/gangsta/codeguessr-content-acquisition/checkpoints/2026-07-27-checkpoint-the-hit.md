---
heist: codeguessr-content-acquisition
phase: the-hit
status: in-progress
timestamp: 2026-07-27T21:06:27+01:00
next-action: Implement the offline end-to-end acquisition orchestration needed before any authorized WP-024/WP-025 live run
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023]
pending-wps: [WP-024, WP-025, WP-026, WP-027]
failed-wps: []
artifacts:
  - tests/e2e/provenance-accessibility.spec.ts
  - tests/e2e/language-accessibility.spec.ts
  - tests/e2e/privacy-accessibility.spec.ts
  - docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-foundation-territory.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-github-core-territory.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-secure-operator-operations.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-promotion-game-adapters.md
  - packages/content/src/evidence/
  - packages/content/src/rights/source-regime.ts
  - packages/content/src/acquisition/policy/
  - packages/content/src/acquisition/github/
  - packages/content/src/acquisition/draft/
  - packages/content/src/acquisition/storage/
  - packages/content/src/acquisition/operator/
  - packages/content/src/acquisition/promotion/
  - packages/content/src/acquisition/index.ts
  - apps/game/src/server/content/catalogue/
  - apps/game/src/demo/rehearsal-approval-register.ts
  - apps/game/src/demo/rehearsal-catalogue.ts
  - apps/game/src/demo/rehearsal-reveal.ts
  - apps/game/src/demo/rehearsal-server.ts
  - tests/containment/acquisition-boundary.test.mjs
  - packages/domain/src/provenance/index.ts
  - ops/content/policies/
  - ops/content/acquire/
---

## Resume Context

The Don authorized the baseline repair, initial snapshot, safehouse, and The Hit. Initial commit `f6a085a` exists on `heist/code-guessing-startup`; `.worktrees/` is ignored; branch `codex/heist/codeguessr-content-acquisition` is checked out at `/Users/konstantinp/Documents/CodeGuessr/.worktrees/codeguessr-content-acquisition`.

The clean safehouse baseline passes workspace/unit tests (1,622/1,622 plus workspace TAP), TypeScript typecheck, accessibility (37/37), performance (6/6), and Playwright (13/13).

The Evidence and Trusted Policy foundation territory is accepted after independent verification: 350 focused tests and the full workspace typecheck pass. Licensed GitHub evidence, the Revision 7 fixed provenance regime, policy validation, and operator authorization are implemented. Historical evidence and source-regime compatibility remain covered.

The operational policy and operator registers are intentionally non-effective. They contain no fabricated approval. Live acquisition remains blocked until real repository/subtree, vendor-document, dated policy, and named-operator approvals exist.

Promotion of real drafts remains externally blocked until four independent qualified human reviewers are available; implementation may proceed to review-ready drafts and synthetic rehearsal coverage.

The GitHub Acquisition Core territory is accepted after 101/101 focused tests and content-package typecheck. It provides strict immutable request, transport, traversal, checkpoint, screening, diff, marker, license, and non-publishable-draft boundaries. It remains inert until secure operator storage and command surfaces are accepted.

The Secure Operator Operations territory is accepted after corrective independent audit and a fresh root sweep of 1,851/1,851 Vitest tests plus workspace TAP and full workspace/ops typecheck. External authenticated storage, authoritative lifecycle and verified deletion, a project-register-bound durable metadata-only audit sink, Node-only packaging, independently loaded project controls, actual host UID/clock preflight, bounded unauthenticated public transport, and an exact single-parent GitHub commit receipt are implemented.

The operator command deliberately stops at `AUTHORIZED_COMMIT_RECEIPT`. WP-024 must connect that receipt to the already implemented traversal, checkpoint, screening, encrypted storage, audit, and draft boundaries and must pass the same project-authorized run/register binding to the durable audit sink. The current non-effective policies continue to block all live network use.

The Promotion and Game Adapters territory is accepted after adversarial corrections and an independent final audit with no remaining Critical or Important findings. Promotion now requires complete four-human eligibility and exact source, policy, rights, answer, version and canonical-catalogue continuity; it emits a parseable promotion receipt. Revision 7 readiness requires that exact receipt. Server-only language/provenance adapters keep answers and attribution behind H-002 reveal authority, while rehearsal activation requires exact project-register bindings and defaults to synthetic because the active register is empty.

A fresh root sweep passes workspace TAP, 57/57 Vitest files and 1,902/1,902 tests, recursive workspace/operator typecheck, production game build, and all 3 acquisition containment checks.

WP-018 through WP-023 are implementation-complete. This checkpoint does not claim a real-content rehearsal: no live GitHub acquisition, reviewer decision, promotion or activation occurred. Full real-entry traversal through `LanguageFlow` and `ProvenanceFlow`, pre-answer containment, and post-answer attribution remain WP-024 through WP-027 work.

The next safe implementation step is offline orchestration from the existing authorized commit receipt through immutable traversal, checkpointing, screening, encrypted storage, durable audit and `DRAFT_REVIEW_REQUIRED` construction. Any real WP-024/WP-025 network run remains blocked until the project-controlled policy and operator registers are made effective by real authorities.
