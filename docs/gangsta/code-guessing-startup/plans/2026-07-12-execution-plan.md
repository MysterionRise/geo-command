---
heist: code-guessing-startup
date: 2026-07-12
parent-contract-revision: 6
parent-contract-sha256: 08ef84a2b475a1d3090ef8037d0f4bdaec719bf6682c59fd754bec978b74927f
total-work-packages: 37
territories: 6
estimated-total-budget: 168000
current-reforecast-budget: 932050
branch: heist/code-guessing-startup
status: the-hit-in-progress
approved-by: Don
approved-at: 2026-07-12T20:50:06+01:00
---

# Execution Plan: Code Mystery Arcade Beta

## Release Gate

The Don approved this plan and all six child Contracts are signed. This plan still authorizes no implementation until the Don separately authorizes The Hit. After that authorization, only dependency-ready packages inside their signed territories may be released; H-006 integration still requires accepted evidence from H-001 through H-005.

## Child Contract Ledger

| Child | Revision | Status | Immutable signed SHA-256 |
|---|---:|---|---|
| H-001 | 1 | APPROVED | `0dc3e28e54e92f159140a1d88ed42122590cc33abafca7d3aa11b6ee8ccd7cdd` |
| H-002 | 1 | APPROVED | `e8c135578955a65ed44e2bb75d09f1eaaf4c1b6eb3142f89b7632ece54604d98` |
| H-003 | 1 | APPROVED | `750530ac503238e85d3f16e28ad1fbf2942a5293c27dbf095ef97354a917f99c` |
| H-004 | 1 | APPROVED | `6cfcaa347ce11af721d0d55bb3869b49bea9066919a17204df2dca0d1a638eda` |
| H-005 | 1 | APPROVED | `8cacbbcb9752d06e5382b987abc47bfbe782a81dd9ecb56b7e08111768f583b3` |
| H-006 | 1 | APPROVED | `2b2162f438f710cadc6dcccbad01b0cd0e14e6b31b668e51d4a0db9ea06a04d0` |

## Budget Variance Ledger

| Package | Planned | Estimated used | Variance | Decision |
|---|---:|---:|---:|---|
| WP-001 | 4,000 | 4,000 | 0 | Accepted |
| WP-002 | 4,000 | 7,000 | +3,000 | Approved by Underboss; functional scope accepted |
| WP-003 | 4,000 | 5,500 | +1,500 | Approved by Underboss; reviewer-policy matrix and audit coverage accepted |
| WP-004 | 4,000 | 6,300 | +2,300 | Approved by Underboss; temporal and explicit-false rights-gate rework accepted |
| WP-006 | 4,000 | 9,000 | +5,000 | Approved by Underboss after Capo rejection and focused security rework |
| WP-007 | 4,000 | 6,500 | +2,500 | Approved by Underboss after deadline and mandatory sequencing rework |
| WP-008 | 5,000 | 8,000 | +3,000 | Approved by Underboss; second RED cycle added the missing mode-ratio guard |
| WP-009 | 5,000 | 7,000 | +2,000 | Approved by Underboss; exhaustive answer-state and gate conjunction proof accepted |
| WP-010 | 5,000 | 4,800 | -200 | Accepted by H-002 Capo; fixed scoring and spoiler audit complete within budget |
| WP-011 | 5,000 | 8,200 | +3,200 | Accepted after replay/containment rework; includes a recorded unauthorized 1,000 process overrun |
| WP-012 | 5,000 | 9,550 | +4,550 | Accepted after three Capo-directed RED/GREEN rework cycles |
| WP-013 | 5,000 | 18,400 | +13,400 | Accepted after contract and exact-E2E remediation; 2,600 unauthorized overrun remains recorded; 100 returned from ceiling |
| WP-014 | 5,000 | 14,600 | +9,600 | Implementation accepted; real browser/AT/load/sample/availability evidence remains invitation-blocking INDETERMINATE; 100 returned |
| WP-015 | 4,000 | 7,850 | +3,850 | Accepted after strict binding to the full accepted WP-004 rights-regime snapshot; 150 returned from ceiling |
| WP-016 | 4,000 | 16,850 | +12,850 | Reaccepted after distinct accepted-transition/candidate regression; 150 returned from ceiling |
| WP-017 | 4,000 | 20,900 | +16,900 | Accepted after pre-public, exact-envelope, real-state and compiler/API rework; 100 returned from ceiling |
| WP-018 | 4,000 | 17,800 | +13,800 | Accepted after Capo-completed RED, strict flow/calibration/event/claims proof and independent Inspector closure; 200 returned |
| WP-019 | 4,000 | 19,150 | +15,150 | Accepted after acceptance-matrix and private factory-certification rework; 1,850 returned from ceiling |
| WP-020 | 4,000 | 37,500 | +33,500 | Accepted after full Drill recovery and strict opaque-ID regression; 1,500 returned from ceiling |
| WP-021 | 4,000 | 93,500 | +89,500 | Accepted after Inspector-driven annotation-content and invisible-control strict regressions; 1,500 returned |
| WP-022 | 4,000 | 11,200 | +7,200 | Accepted as test-only cross-contract audit after strict-compile, opaque-ID and nested-detachment rework; 800 returned |
| WP-023 | 5,000 | 10,000 | +5,000 | Approved by Underboss after Capo and Underboss authorization rework |
| WP-024 | 5,000 | 9,700 | +4,700 | Approved by Underboss after typed-exclusion and version-bound authorization rework |
| WP-025 | 5,000 | 18,400 | +13,400 | Approved by Underboss after consolidated access-control and strict TDD remediation |
| WP-026 | 5,000 | 18,900 | +13,900 | Accepted after strict atomicity, enforcement, deadline-evidence and chronology rework |
| WP-027 | 5,000 | 25,100 | +20,100 | Technical GREEN verified; operationally blocked pending Don-approved provider schedule; 900 returned from ceiling |
| WP-028 | 5,000 | 69,000 | +64,000 | Accepted after exact-whitelist recovery and Inspector-driven telemetry-normalization/type-contract regressions; 6,000 returned from ceiling |
| WP-029 | 5,000 | 157,500 | +152,500 | Reaccepted after delayed-audit RED/GREEN closed effective-time freeze, exact terminal/acknowledgement joins and semantic candidate/correction binding; 2,500 returned |
| WP-030 | 5,000 | 162,000 | +157,000 | Accepted after four independent-audit RED/GREEN cycles closed authority, durability, trust-domain, corruption, row-mutation and valid-seal tail-truncation defects; 3,000 returned from ceiling |
| WP-031 | 5,000 | 38,000 | +33,000 | Technical GREEN after signed-occurrence, exact-scope, quarantine-integrity and trust-domain rework; operational acceptance blocked pending Don-approved provider schedule; 2,000 returned from ceiling |
| WP-035 | 4,000 | 24,000 | +20,000 | Technical GREEN after Inspector-driven synthetic, ordered-session and duplicate-row false-PASS rework; AC-012 operational evidence remains INDETERMINATE; 1,000 returned |
| WP-036 | 4,000 | 20,000 | +16,000 | Technical GREEN after Capo-directed exact-matrix and malformed-evidence rework; AC-012 operational evidence remains INDETERMINATE; 1,000 returned |
| WP-037 | 4,000 | 26,000 | +22,000 | Technical GREEN after Capo-directed full matrix, malformed/nested, privacy-forbidden and cold-start rework; AC-012 operational evidence remains INDETERMINATE |

Current operational reforecast: 932,050 tokens. Future packages remain paused at their original territory gates until individually released.

## Resource Decisions

- Runtime and language: installed Node.js 20.18.0 with strict TypeScript.
- Package/build boundary: installed pnpm 9.15.9 workspace with one lockfile.
- Application shape: one static-first Next.js browser application with server-only authoritative route handlers; pure domain logic remains outside framework code.
- Persistence: PostgreSQL through a migration-controlled adapter; local verification uses Docker because no host `psql` is installed.
- Restricted evidence: project-controlled object-storage adapter, never the public bundle or repository.
- Test stack: unit/contract tests, browser end-to-end tests, automated accessibility checks, and deterministic load/idempotency checks. Exact dependency versions are selected once at bootstrap, recorded in the lockfile, and cannot float afterward.
- Repository layout: `apps/game`, `packages/domain`, `packages/content`, `packages/measurement`, `packages/test-support`, `tests/e2e`, `ops`, and non-Gangsta product/operations documentation.
- Isolation: the programme branch is `heist/code-guessing-startup`. Worktrees are deferred until an initial baseline commit exists; thereafter one worktree may be created per signed territory.

## Territories

### Territory H-001: Content and Evidence

**Domain:** Evidence schemas, rights, review, inventory, complaints, correction, restricted evidence.  
**Files:** `packages/content/**`, `apps/game/src/server/content/**`, `ops/content/**`, `docs/product/content/**`  
**Work Packages:** WP-002 through WP-007  
**Workers:** 1, expandable to 2 after schema freeze  
**Budget:** 24,000 tokens

### Territory H-002: Arcade and State

**Domain:** Workspace foundation, manifest/state domain, answer/reveal, shared UI, accessibility/performance.  
**Files:** root manifests, `apps/game/**`, `packages/domain/**`, `packages/test-support/**`  
**Work Packages:** WP-001, WP-008 through WP-014  
**Workers:** 2 after WP-001  
**Budget:** 39,000 tokens

### Territory H-003: Provenance Mode

**Domain:** Recorded-source candidates, evidence projection, clues/reveal, calibration and claims.  
**Files:** `apps/game/src/modes/provenance/**`, `packages/domain/src/provenance/**`, provenance tests  
**Work Packages:** WP-015 through WP-018, WP-035  
**Workers:** 1  
**Budget:** 20,000 tokens

### Territory H-004: Language Mode

**Domain:** Candidate sets, aliases, ambiguity, clues/reveal, calibration and ordering.  
**Files:** `apps/game/src/modes/language/**`, `packages/domain/src/language/**`, language tests  
**Work Packages:** WP-019 through WP-022, WP-036  
**Workers:** 1  
**Budget:** 20,000 tokens

### Territory H-005: Enrollment and Privacy

**Domain:** Invitation lineage, consent/eligibility, credentials, withdrawal/deletion, provider/restore controls.  
**Files:** `apps/game/src/server/identity/**`, `apps/game/src/server/privacy/**`, `ops/privacy/**`, privacy/security tests  
**Work Packages:** WP-023 through WP-027, WP-037  
**Workers:** 1, with independent security review  
**Budget:** 29,000 tokens

### Territory H-006: Beta Operations and Measurement

**Domain:** Events, formulas, UTC lifecycle, incidents, runbook, negative-scope and integrated gate evidence.  
**Files:** `packages/measurement/**`, `apps/game/src/server/operations/**`, `ops/beta/**`, `tests/e2e/**`, `docs/operations/**`  
**Work Packages:** WP-028 through WP-034  
**Workers:** 2 after upstream interface freeze  
**Budget:** 36,000 tokens

## Work Packages

**Prevention Guidance (all Work Packages):** Do not reproduce Gangsta-internal identifiers in source code, tests, comments, user-facing copy, product documentation, or operations documentation. Identifiers remain only under `docs/gangsta/`. Every implementation package follows Red-Green-Refactor and must begin with a failing test.

### WP-001: Workspace and Test Harness
**Territory:** H-002  
**Contract Clauses:** NFR-001, NFR-015, AD-004  
**Files:** Create root workspace manifests, `apps/game`, shared packages, test configuration, Docker PostgreSQL configuration  
**Acceptance:** Strict TypeScript boundaries, one lockfile, server/client separation, unit and browser test commands  
**Verification:** `pnpm install --frozen-lockfile && pnpm test && pnpm test:e2e --list`  
**Budget:** 4,000  
**Dependencies:** Signed H-002

### WP-002: Common and Source-Specific Evidence Records
**Territory:** H-001  
**Contract Clauses:** FR-014 through FR-016, NFR-015  
**Files:** `packages/content/src/evidence/**`, evidence contract tests  
**Acceptance:** Common, Stack Overflow, model, and project-owned-human records reject every missing required field  
**Verification:** `pnpm --filter @codeguessr/content test -- evidence`  
**Budget:** 4,000  
**Dependencies:** WP-001; signed H-001

### WP-003: Reviewer Independence and Eligibility
**Territory:** H-001  
**Contract Clauses:** FR-007, FR-017, AD-008  
**Files:** `packages/content/src/review/**`, reviewer-policy tests  
**Acceptance:** Four distinct item roles, qualifications, ambiguity rejection, conflicts and decision audit  
**Verification:** `pnpm --filter @codeguessr/content test -- review`  
**Budget:** 4,000  
**Dependencies:** WP-002

### WP-004: Rights Gate and Source-Regime Freeze
**Territory:** H-001  
**Contract Clauses:** FR-006, FR-018, DEC-005  
**Files:** `packages/content/src/rights/**`, rights-gate tests  
**Acceptance:** Stack Overflow cannot become eligible without the written determination; fallback is exclusive and frozen  
**Verification:** `pnpm --filter @codeguessr/content test -- rights`  
**Budget:** 4,000  
**Dependencies:** WP-002, WP-003

### WP-005: Corpus and Reserve Readiness
**Territory:** H-001  
**Contract Clauses:** FR-012, FR-013, AC-004  
**Files:** `packages/content/src/inventory/**`, `ops/content/**`, readiness tests  
**Acceptance:** Seventy scheduled/fifteen reserve, unique, eligible, ratio-correct, difficulty-compatible inventory  
**Verification:** `pnpm --filter @codeguessr/content test -- inventory`  
**Budget:** 4,000  
**Dependencies:** WP-003, WP-004

### WP-006: Restricted Evidence Boundary
**Territory:** H-001  
**Contract Clauses:** NFR-003, NFR-010, NFR-011, NFR-013  
**Files:** `apps/game/src/server/content/vault/**`, evidence-isolation tests  
**Acceptance:** Encryption/access/audit/retention interface and negative proof against bundles, logs and analytics  
**Verification:** `pnpm test -- evidence-isolation && pnpm build`  
**Budget:** 4,000  
**Dependencies:** WP-001, WP-002

### WP-007: Complaints, Quarantine and Corrections
**Territory:** H-001  
**Contract Clauses:** FR-019, FR-032, AC-005, AC-011  
**Files:** `apps/game/src/server/content/corrections/**`, `ops/content/**`, correction tests  
**Acceptance:** Severity deadlines, independent decision, VOID/CONTENT_WITHDRAWN, five-minute purge and history  
**Verification:** `pnpm test -- corrections complaints`  
**Budget:** 4,000  
**Dependencies:** WP-003, WP-006, WP-008

### WP-008: Manifest Lineage and Issuance
**Territory:** H-002  
**Contract Clauses:** FR-002 through FR-004, DEC-003  
**Files:** `packages/domain/src/manifest/**`, migrations, manifest tests  
**Acceptance:** One lineage/day, one issuance version, immutable binding, UTC/grace/expiry and correction promotion  
**Verification:** `pnpm --filter @codeguessr/domain test -- manifest`  
**Budget:** 5,000  
**Dependencies:** WP-001; signed H-002

### WP-009: Orthogonal State Machine
**Territory:** H-002  
**Contract Clauses:** FR-008, DEC-004  
**Files:** `packages/domain/src/session/**`, state-transition tests  
**Acceptance:** Every permitted and prohibited session/interaction/correction/clue/answer conjunction  
**Verification:** `pnpm --filter @codeguessr/domain test -- state`  
**Budget:** 5,000  
**Dependencies:** WP-008

### WP-010: Clues, Answer and Fixed Scoring
**Territory:** H-002  
**Contract Clauses:** FR-005, FR-008, FR-011  
**Files:** `packages/domain/src/round/**`, scoring tests  
**Acceptance:** One answer, ordered clues, 1,000/200/300 scoring, zero incorrect, immutable facts  
**Verification:** `pnpm --filter @codeguessr/domain test -- round scoring`  
**Budget:** 5,000  
**Dependencies:** WP-009

### WP-011: Reveal Authorization and Containment
**Territory:** H-002  
**Contract Clauses:** FR-009, FR-010, NFR-003 through NFR-005  
**Files:** `apps/game/src/server/reveal/**`, authorization and bundle-leak tests  
**Acceptance:** Same lineage/day/manifest-version/round/answer only; denial contains no protected fields  
**Verification:** `pnpm test -- reveal authorization answer-containment && pnpm build`  
**Budget:** 5,000  
**Dependencies:** WP-009, WP-010

### WP-012: Correction-Aware Re-entry and Results
**Territory:** H-002  
**Contract Clauses:** FR-004, FR-011, FR-013, FR-032  
**Files:** `packages/domain/src/results/**`, correction/re-entry tests  
**Acceptance:** All pre-issue, issued-unanswered and post-answer branches; adjusted maximum, streak/share and read-only replay  
**Verification:** `pnpm --filter @codeguessr/domain test -- corrections results reentry`  
**Budget:** 5,000  
**Dependencies:** WP-008 through WP-011, WP-007

### WP-013: Static Arcade Shell
**Territory:** H-002  
**Contract Clauses:** FR-001, FR-010, FR-011, NFR-001, NFR-002  
**Files:** `apps/game/src/app/**`, `apps/game/src/components/arcade/**`, shell tests  
**Acceptance:** Five-round mode-neutral journey, progressive evidence, reveal, results, no-JavaScript explanation  
**Verification:** `pnpm --filter @codeguessr/game test -- arcade && pnpm test:e2e -- --project=arcade`  
**Budget:** 5,000  
**Dependencies:** WP-010 through WP-012

### WP-014: Accessibility, Browser and Performance Boundary
**Territory:** H-002  
**Contract Clauses:** NFR-007, NFR-008, NFR-014, NFR-018, NFR-019  
**Files:** shared UI, accessibility/browser/load tests, performance harness  
**Acceptance:** Parent support matrix and exact viewport/render/input/server/load/sample/idempotency targets  
**Verification:** `pnpm test:a11y && pnpm test:e2e && pnpm test:performance`  
**Budget:** 5,000  
**Dependencies:** WP-013

### WP-015: Provenance Candidate and Source Regime
**Territory:** H-003  
**Contract Clauses:** FR-006, FR-018, AD-002, AD-009  
**Files:** `packages/domain/src/provenance/**`, provenance candidate tests  
**Acceptance:** Exactly one frozen permitted source regime and honest recorded-source labels  
**Verification:** `pnpm --filter @codeguessr/domain test -- provenance-regime`  
**Budget:** 4,000  
**Dependencies:** WP-004, WP-010; signed H-001, H-002, and H-003 interface Contracts

### WP-016: Provenance Public Projection
**Territory:** H-003  
**Contract Clauses:** FR-010, FR-014 through FR-018, NFR-003  
**Files:** `apps/game/src/modes/provenance/server/**`, projection tests  
**Acceptance:** Only approved display evidence/disclosure leaves restricted records; no premature source answer  
**Verification:** `pnpm test -- provenance-projection answer-containment`  
**Budget:** 4,000  
**Dependencies:** WP-002, WP-006, WP-011, WP-015

### WP-017: Provenance Round, Clues and Reveal
**Territory:** H-003  
**Contract Clauses:** FR-001, FR-005, FR-010, NFR-002  
**Files:** `apps/game/src/modes/provenance/**`, mode flow tests  
**Acceptance:** Mode contract supplies candidates, two clues, answer semantics and evidence-backed explanation  
**Verification:** `pnpm test -- provenance-flow && pnpm test:e2e -- --project=provenance`  
**Budget:** 4,000  
**Dependencies:** WP-013, WP-016

### WP-018: Provenance Calibration and Claims Audit
**Territory:** H-003  
**Contract Clauses:** FR-031, NFR-016, AC-014  
**Files:** provenance calibration and copy-audit tests, non-Gangsta product copy  
**Acceptance:** Chance-aware records and zero AI-detection/authorship/quality/equal-ability claims  
**Verification:** `pnpm test -- provenance-calibration claims-audit`  
**Budget:** 4,000  
**Dependencies:** WP-017, WP-028

### WP-019: Language Candidate Sets and Aliases
**Territory:** H-004  
**Contract Clauses:** FR-007, FR-031  
**Files:** `packages/domain/src/language/**`, candidate tests  
**Acceptance:** Immutable labels, aliases, counts, correct answer, distractor rationale and ordering record  
**Verification:** `pnpm --filter @codeguessr/domain test -- language-candidates`  
**Budget:** 4,000  
**Dependencies:** WP-002, WP-003, WP-010; signed H-001, H-002, and H-004 interface Contracts

### WP-020: Language Ambiguity Eligibility
**Territory:** H-004  
**Contract Clauses:** FR-007, FR-017  
**Files:** `packages/content/src/language-review/**`, ambiguity tests  
**Acceptance:** Two distinct qualified reviewers; any competing defensible answer rejects eligibility  
**Verification:** `pnpm --filter @codeguessr/content test -- language-ambiguity`  
**Budget:** 4,000  
**Dependencies:** WP-003, WP-019

### WP-021: Language Round, Clues and Reveal
**Territory:** H-004  
**Contract Clauses:** FR-001, FR-005, FR-010, NFR-002  
**Files:** `apps/game/src/modes/language/**`, mode flow tests  
**Acceptance:** Mode contract supplies closed candidates, clues, answer semantics and evidence-backed explanation  
**Verification:** `pnpm test -- language-flow && pnpm test:e2e -- --project=language`  
**Budget:** 4,000  
**Dependencies:** WP-013, WP-019, WP-020

### WP-022: Language Calibration and Ordering Audit
**Territory:** H-004  
**Contract Clauses:** FR-007, FR-031, NFR-015  
**Files:** language calibration/ordering tests  
**Acceptance:** Candidate-count chance baseline, deterministic/recorded ordering and every clue-count calibration  
**Verification:** `pnpm test -- language-calibration candidate-ordering`  
**Budget:** 4,000  
**Dependencies:** WP-021, WP-028

### WP-023: Invitation and Enrollment Lineage
**Territory:** H-005  
**Contract Clauses:** FR-021 through FR-025  
**Files:** `apps/game/src/server/identity/enrollment/**`, migrations, enrollment tests  
**Acceptance:** Recruitment block, one-time credential, lineage binding, reissue verification and predecessor revocation  
**Verification:** `pnpm test -- enrollment lineage`  
**Budget:** 5,000  
**Dependencies:** WP-001, WP-008; signed H-005

### WP-024: Consent, Eligibility and Participant States
**Territory:** H-005  
**Contract Clauses:** FR-022 through FR-024, FR-034  
**Files:** `apps/game/src/server/identity/consent/**`, state tests  
**Acceptance:** Adult policy versions and every invitation/consent/eligibility/activation/analysis state remain distinct  
**Verification:** `pnpm test -- consent participant-states`  
**Budget:** 5,000  
**Dependencies:** WP-023

### WP-025: Daily Credentials and Endpoint Controls
**Territory:** H-005  
**Contract Clauses:** FR-025, NFR-004 through NFR-006  
**Files:** `apps/game/src/server/security/**`, credential/endpoint tests  
**Acceptance:** Scope, expiry, storage, replay, anti-forgery, bounds, rate limits, cascade revocation and operator audit  
**Verification:** `pnpm test -- credentials endpoint-security`  
**Budget:** 5,000  
**Dependencies:** WP-023, WP-009

### WP-026: Atomic Withdrawal and Deletion
**Territory:** H-005  
**Contract Clauses:** FR-026, NFR-009, NFR-010  
**Files:** `apps/game/src/server/privacy/withdrawal/**`, deletion tests  
**Acceptance:** Atomic state/credential/telemetry/processing/deletion transition and every retention deadline  
**Verification:** `pnpm test -- withdrawal deletion retention`  
**Budget:** 5,000  
**Dependencies:** WP-024, WP-025

### WP-027: Provider Inventory and Restore Reconciliation
**Territory:** H-005  
**Contract Clauses:** NFR-011 through NFR-013  
**Files:** provider adapters, `ops/privacy/**`, restore tests  
**Acceptance:** Complete inventory and restored data unreachable before consent/deletion/revocation replay passes  
**Verification:** `pnpm test -- provider-inventory restore-reconciliation`  
**Budget:** 5,000  
**Dependencies:** WP-006, WP-026

### WP-028: Authoritative Event Schema
**Territory:** H-006  
**Contract Clauses:** FR-023, FR-034, Measurement Interface Contract  
**Files:** `packages/measurement/src/events/**`, schema/forbidden-field tests  
**Acceptance:** Every frozen family/field and absence rule, including offer/acknowledgement/defect and reveal denial  
**Verification:** `pnpm --filter @codeguessr/measurement test -- events`  
**Budget:** 5,000  
**Dependencies:** WP-001; signed H-006; signed upstream event interfaces

### WP-029: Scoring, Denominators and Formula Reproduction
**Territory:** H-006  
**Contract Clauses:** FR-027 through FR-031, FR-034  
**Files:** `packages/measurement/src/formulas/**`, reproduction tests  
**Acceptance:** Raw numerators/denominators/missing/exclusions/versions and chance-aware mode separation  
**Verification:** `pnpm --filter @codeguessr/measurement test -- formulas`  
**Budget:** 5,000  
**Dependencies:** WP-028, WP-018, WP-022, WP-024

### WP-030: UTC Release and Day 7 Gate
**Territory:** H-006  
**Contract Clauses:** FR-002 through FR-004, FR-020, FR-028, FR-029  
**Files:** `apps/game/src/server/operations/release/**`, lifecycle tests  
**Acceptance:** Fourteen half-open UTC days, grace/freeze, PASS/FAIL/INDETERMINATE and hard Day 8 block  
**Verification:** `pnpm test -- utc-lifecycle day7-gate`  
**Budget:** 5,000  
**Dependencies:** WP-008, WP-025, WP-029

### WP-031: Incident, Outage and Freshness Operations
**Territory:** H-006  
**Contract Clauses:** FR-019, FR-032, NFR-014  
**Files:** `apps/game/src/server/operations/incidents/**`, `ops/beta/**`, incident tests  
**Acceptance:** Severity/outage treatment, five-minute freshness/purge, fail closed, streak protection and honest recall limits  
**Verification:** `pnpm test -- incidents outages revocation-freshness`  
**Budget:** 5,000  
**Dependencies:** WP-007, WP-012, WP-027

### WP-032: Pre-Recruitment Gate and Runbook
**Territory:** H-006  
**Contract Clauses:** FR-024, FR-027, AC-009, AC-015  
**Files:** `ops/beta/gate/**`, `docs/operations/**`, gate completeness tests  
**Acceptance:** Every required signed artifact, role, backup, threshold, manifest and report field blocks invitations when absent  
**Verification:** `pnpm test -- prerecruitment-gate runbook`  
**Budget:** 5,000  
**Dependencies:** WP-005, WP-014, WP-027, WP-029 through WP-031

### WP-033: Version and Negative-Scope Audit
**Territory:** H-006  
**Contract Clauses:** FR-033, NFR-015 through NFR-017, AC-014, AC-016  
**Files:** repository audit tests and release policy  
**Acceptance:** Every version class resolves immutably; all eleven negative-capability blocks and brand block pass  
**Verification:** `pnpm test -- version-coverage negative-scope claims-audit`  
**Budget:** 5,000  
**Dependencies:** WP-014, WP-018, WP-022, WP-027, WP-032

### WP-034: Integrated Programme Sweep
**Territory:** H-006  
**Contract Clauses:** FR-035, AC-017, all programme requirements  
**Files:** `tests/e2e/**`, release evidence index, dependency ledger  
**Acceptance:** Fresh evidence for every matrix row, all child gates passed, zero unresolved critical defect, no forbidden capability  
**Verification:** `pnpm test && pnpm test:e2e && pnpm test:a11y && pnpm test:performance && pnpm audit:release`  
**Budget:** 6,000  
**Dependencies:** WP-002 through WP-033, WP-035 through WP-037

### WP-035: Provenance Accessibility Evidence
**Territory:** H-003  
**Contract Clauses:** NFR-008, NFR-018, AC-012  
**Files:** provenance accessibility/browser tests and mode interaction fixtures  
**Acceptance:** Complete provenance clue/answer/reveal/correction/error flow passes every required browser, viewport, keyboard and assistive-technology combination  
**Verification:** `pnpm test:a11y -- --mode=provenance && pnpm test:e2e -- --project=provenance-accessibility`  
**Budget:** 4,000  
**Dependencies:** WP-014, WP-017

### WP-036: Language Accessibility Evidence
**Territory:** H-004  
**Contract Clauses:** NFR-008, NFR-018, AC-012  
**Files:** language accessibility/browser tests and mode interaction fixtures  
**Acceptance:** Complete language clue/answer/reveal/correction/error flow passes every required browser, viewport, keyboard and assistive-technology combination  
**Verification:** `pnpm test:a11y -- --mode=language && pnpm test:e2e -- --project=language-accessibility`  
**Budget:** 4,000  
**Dependencies:** WP-014, WP-021

### WP-037: Enrollment and Withdrawal Accessibility Evidence
**Territory:** H-005  
**Contract Clauses:** NFR-008, NFR-018, AC-012  
**Files:** enrollment/privacy accessibility/browser tests and flow fixtures  
**Acceptance:** Enrollment, consent, withdrawal, correction notice, deletion status and error flows pass every required browser, viewport, keyboard and assistive-technology combination  
**Verification:** `pnpm test:a11y -- --flow=privacy && pnpm test:e2e -- --project=privacy-accessibility`  
**Budget:** 4,000  
**Dependencies:** WP-014, WP-024, WP-026

## Requirement Allocation Matrix

The primary territory owns proof; secondary territories provide interfaces or evidence.

| Clause | Primary | Secondary |
|---|---|---|
| FR-001 | H-002 | H-003, H-004 |
| FR-002 | H-006 | H-002 |
| FR-003 | H-002 | H-006 |
| FR-004 | H-002 | H-005, H-006 |
| FR-005 | H-002 | H-003, H-004 |
| FR-006 | H-003 | H-001 |
| FR-007 | H-004 | H-001 |
| FR-008 | H-002 | H-005 |
| FR-009 | H-002 | H-005 |
| FR-010 | H-002 | H-001, H-003, H-004 |
| FR-011 | H-002 | H-006 |
| FR-012 | H-001 | H-006 |
| FR-013 | H-002 | H-001, H-006 |
| FR-014 | H-001 | H-003, H-004 |
| FR-015 | H-001 | H-003 |
| FR-016 | H-001 | H-003 |
| FR-017 | H-001 | H-003, H-004 |
| FR-018 | H-001 | H-003 |
| FR-019 | H-001 | H-006 |
| FR-020 | H-006 | H-002, H-005 |
| FR-021 | H-005 | — |
| FR-022 | H-005 | H-006 |
| FR-023 | H-005 | H-006 |
| FR-024 | H-005 | H-006 |
| FR-025 | H-005 | H-002 |
| FR-026 | H-005 | H-006 |
| FR-027 | H-006 | H-001 through H-005 |
| FR-028 | H-006 | H-002, H-005 |
| FR-029 | H-006 | — |
| FR-030 | H-006 | H-003, H-004 |
| FR-031 | H-006 | H-003, H-004 |
| FR-032 | H-001 | H-002, H-005, H-006 |
| FR-033 | H-006 | H-003, H-004 |
| FR-034 | H-006 | H-001 through H-005 |
| FR-035 | H-006 | H-001 through H-005 |
| NFR-001 | H-002 | H-006 |
| NFR-002 | H-002 | H-003, H-004 |
| NFR-003 | H-002 | H-001, H-003, H-004 |
| NFR-004 | H-005 | H-002 |
| NFR-005 | H-002 | H-005 |
| NFR-006 | H-005 | H-001, H-006 |
| NFR-007 | H-002 | H-001, H-003, H-004 |
| NFR-008 | H-002 | H-003, H-004, H-005 |
| NFR-009 | H-005 | H-006 |
| NFR-010 | H-005 | H-001 |
| NFR-011 | H-001 | H-005 |
| NFR-012 | H-005 | H-006 |
| NFR-013 | H-005 | H-001 |
| NFR-014 | H-002 | H-006 |
| NFR-015 | H-006 | H-001 through H-005 |
| NFR-016 | H-006 | H-003, H-004 |
| NFR-017 | H-006 | — |
| NFR-018 | H-002 | H-003, H-004, H-005 |
| NFR-019 | H-002 | H-006 |
| AD-001 | H-002 | H-003, H-004 |
| AD-002 | H-006 | H-003, H-004 |
| AD-003 | H-002 | H-006 |
| AD-004 | H-002 | H-005 |
| AD-005 | H-001 | H-003, H-004 |
| AD-006 | H-006 | H-002, H-003, H-004 |
| AD-007 | H-006 | H-002 |
| AD-008 | H-001 | H-005, H-006 |
| AD-009 | H-006 | H-003, H-004 |
| AD-010 | H-006 | H-001 through H-005 |
| OOS-brand | H-006 | — |
| OOS-country | H-006 | H-003, H-004 |
| OOS-future-modes | H-006 | H-003, H-004 |
| OOS-ingestion | H-006 | H-001 |
| OOS-execution | H-006 | H-002 |
| OOS-detector | H-006 | H-003 |
| OOS-social | H-006 | H-002, H-005 |
| OOS-mobile | H-006 | H-002 |
| OOS-verticals | H-006 | — |
| OOS-business | H-006 | — |
| OOS-scaling | H-006 | H-002 |

## Risk Allocation

| Risks | Primary Territory |
|---|---|
| R-001, R-006, R-008 | H-006 |
| R-002, R-003, R-005, R-009 | H-001 |
| R-004 | H-006 |
| R-007, R-011 | H-005 |
| R-010 | H-001 with H-005/H-006 backup duties |

## Execution Order

1. Don approves this plan; Consigliere reviews all six child Contracts; Don signs each accepted child Contract.
2. WP-001 establishes the locked workspace and failing baseline tests.
3. Foundation wave A runs in parallel: WP-002 establishes content records while WP-008 establishes manifest issuance.
4. Foundation wave B respects those dependencies: WP-003 and WP-006 follow WP-002; WP-009 and WP-023 follow WP-008.
5. H-001/H-002 finish their signed shared interfaces. Only then may H-003 and H-004 implementation begin; WP-019 additionally waits for WP-002 and WP-003.
6. H-005 completes consent, credential, withdrawal, provider and accessibility boundaries. WP-028 begins only after signed H-001 through H-005 event interfaces are available and their owners confirm the parent schema mapping.
7. H-003, H-004 and H-005 accessibility packages WP-035 through WP-037 pass before integrated acceptance.
8. H-006 integrates frozen events, formulas and operations after upstream interfaces are accepted.
9. WP-034 performs the final programme sweep. The Hit cannot be declared complete before it passes.

## Baseline Verification

- Existing tests: PASS by absence; no application or test files exist outside Gangsta documentation.
- Runtime: Node.js 20.18.0 available.
- Package manager: pnpm 9.15.9 available.
- Container runtime: Docker 20.10.8 available.
- PostgreSQL client: not installed; local database must run through Docker.
- Dependencies: no application manifests or lockfile exist by design; WP-001 is the first The Hit action and must select compatible exact versions, create the immutable lockfile, and prove the fresh dependency baseline before any dependent package is released.
- Branch: `heist/code-guessing-startup` created from the unborn `master` baseline.
- Merge conflicts: none; repository has no commits and only `docs/` is untracked.
- The Hit gate: READY FOR DON AUTHORIZATION. The plan and all child Contracts are approved; installed runtime/package/container tooling is available. After authorization, WP-001 performs dependency/bootstrap verification and remains the hard release gate for every dependent package.
