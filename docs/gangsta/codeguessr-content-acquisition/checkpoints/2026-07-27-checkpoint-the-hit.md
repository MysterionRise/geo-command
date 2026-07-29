---
heist: codeguessr-content-acquisition
phase: the-hit
status: in-progress
timestamp: 2026-07-27T22:17:01+01:00
next-action: Obtain real control/operator approvals and encrypted-state authorization, then execute the two controlled live WP-024/WP-025 draft runs
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
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-offline-acquisition-orchestration.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-production-operator-wiring.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-durable-acquisition-artifacts.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-29-real-target-and-resumable-operator.md
  - docs/gangsta/codeguessr-content-acquisition/reports/2026-07-29-public-smoke-crawl.md
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

The offline acquisition orchestration prerequisite is accepted after three corrective independent audits. The operator now issues an opaque source receipt only after bounded child/parent/repository requests certify commit, tree, identity, verification, metadata and licence-admission facts. The issued operator run binds the exact commit and subtree; a byte-identical cloned receipt and a drifted request both fail before object access or network respectively.

The orchestrator verifies both root/subtree revisions, screens before persistence, reconstructs provenance changes from raw blobs, derives the licence blob from the verified child root, stores raw bytes in the encrypted capability, records immediate metadata-only audit continuity, rolls back a newly created object when its audit event fails, and emits only `DRAFT_REVIEW_REQUIRED` plus a bound checkpoint.

Fresh root evidence is workspace TAP, 58/58 Vitest files and 1,912/1,912 tests, recursive workspace/operator typecheck, production game build, and all 3 containment checks.

WP-024 and WP-025 remain pending. The production command stops at the certified source receipt; it still needs real Git tree/blob adapters and approved external store, audit, checkpoint and draft-output configuration. Non-effective project controls continue to prohibit a live run.

The production operator wiring prerequisite is accepted after corrective independent audit. The command now preflights an approved absolute external state root, owner-only directories, encrypted-store key and storage attestations before network; it explicitly disposes decoded key bytes on every later outcome. The bounded GitHub object adapter retrieves exact tree and blob endpoints through the existing transport, while downstream verification binds their Git identities before draft construction.

After source certification, the command opens the real encrypted store and durable audit sink with the response-date-authorized operator run, traverses the exact approved revision and emits an in-memory `DRAFT_REVIEW_REQUIRED` result plus checkpoint. State-child replacement is revalidated before opening, and state failures retain a categorical `OPERATOR_STATE_REJECTED` boundary.

Fresh root evidence is workspace TAP, 60/60 Vitest files and 1,919/1,919 tests, recursive workspace/operator typecheck, production game build, all 3 containment checks and clean diff hygiene. Independent audit reports no remaining Critical, Important or Minor findings and marks the slice READY.

WP-024 and WP-025 remain pending. The command does not yet durably write the derived draft/checkpoint evidence or resume a paused rate-limited run. Active project policy and operator registers remain non-effective, so no live GitHub run, real draft, review, promotion or playable rehearsal has occurred.

The durable acquisition-artifact prerequisite is accepted after one corrective independent audit. A completed run now stores the full draft and checkpoint through the authenticated encrypted object store, stores a deterministic artifact index binding both complete storage identities to the draft/checkpoint logical hashes, and places the index object ID in the durable `DRAFT_COMPLETED` audit event. Failure to persist or audit completion rolls back every newly created derived artifact.

The actual operator command now requires prepared external state before transport construction or network access and returns only a frozen metadata-safe receipt containing status, logical hashes and encrypted artifact identities. Receipt-only acquisition exists solely as an explicitly named internal step and is not used by the CLI.

Fresh root evidence is workspace TAP, 60/60 Vitest files and 1,921/1,921 tests, recursive workspace/operator typecheck, production game build, all 3 containment checks and clean diff hygiene. Independent re-audit reports no Critical, Important or Minor findings and marks the slice READY.

WP-024 and WP-025 remain pending because valid GitHub rate-limit pauses are not yet durably checkpointed or explicitly resumable. Active controls remain non-effective; no live acquisition or real-content claim has occurred.

The real-target and resumable-operator prerequisite is accepted after
corrective TDD and repeated independent audit. The pinned MIT target, exact
Claude Opus 4.6 attribution marker, vendor evidence and review-ready policy
hashes are project-controlled. GitHub case-preserving identity is handled
without widening the canonical repository.

Validated rate-limit pauses now retain encrypted, hash-bound safe Git objects;
explicit resume reauthorizes exact source, policy-entry, register, operator,
tool and object bindings before network, replays completed objects without
refetch, and preserves one logical audit run ID. Unsafe blobs are never cached,
and all run-owned raw objects are removed on terminal failure across
orchestration, pause and command boundaries while pre-existing reused objects
remain intact.

Fresh root evidence is workspace TAP, 61/61 Vitest files and 1,935/1,935
tests, recursive workspace/operator typecheck, production game build, all 3
containment checks and clean diff hygiene. Final independent audit reports no
Critical or Important runtime findings; one non-blocking Minor test-coverage
observation remains recorded in the territory report.

WP-024 and WP-025 remain pending only at the live control boundary. The
approved-policy and operator registers are deliberately non-effective, no
approved encrypted external state root has been selected, and no real GitHub
draft has been created. WP-026/WP-027 remain blocked on the required four
independent human reviews and non-public playable rehearsal.

A bounded, unauthenticated public GitHub smoke crawl was completed on
2026-07-29 against the qualified commit. Repository, commit, tree, parent,
licence and source Git identities matched the qualification evidence. The
production blob screen accepted the live parent and child bytes, and the
production changed-line reconstruction reproduced changed line 84, excerpt
lines 82–86 and excerpt SHA-256
`ae408e14bdb4d5b5a742bef7b208df02a85a3136b159c2476cf910b71512d61b`.
This was a non-authorizing engineering check using temporary responses only;
it did not invoke the production operator, persist a draft or change the
remaining approval and encrypted-state gates.
