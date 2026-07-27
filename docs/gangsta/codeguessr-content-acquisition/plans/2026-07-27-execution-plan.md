---
heist: codeguessr-content-acquisition
date: 2026-07-27
status: approved
total-work-packages: 27
territories: 6
estimated-total-budget: 49000
target: real-content-non-public-mvp-rehearsal
---

# Execution Plan: CodeGuessr Licensed GitHub Content Acquisition

## Outcome

Deliver the smallest real vertical slice that advances CodeGuessr as “GeoGuessr for code”:

1. An authenticated operator acquires one allowlisted language change and one allowlisted recorded-agent-participation change at exact GitHub commits.
2. Each becomes an immutable encrypted `DRAFT_REVIEW_REQUIRED` artifact.
3. Four independent qualified reviewers promote eligible drafts through the existing evidence boundary.
4. The promoted items run as non-public language and provenance rounds through the real game/reveal paths.

This plan does not claim controlled-beta readiness. The seventy scheduled and fifteen reserve items, production staffing, and complete launch evidence remain separate operational blockers after the two-round MVP rehearsal.

## Signed Contract Lineage

| Artifact | Final signed SHA-256 |
|---|---|
| Programme Revision 7 | `3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5` |
| H-001 Revision 2 | `247a82b84df99b8757e52b123e719f3fc67915a1224225791460a1e23e60aedb` |
| H-002 Compatibility Certificate | `449b34b75433a7d8ce7ee3e59118ba9792c04453dcc614920f4013adf90d2393` |
| H-003 Revision 2 | `0cc2f7164079074e2c8b8b14309303aa7f1c05ff9a90cc26b20e1b3cc07e80e8` |
| H-004 Revision 2 | `43f531752ca69cc820836a4e9a9e780b2e19e846503740b8b7867e2504717fa3` |
| H-005 Compatibility Certificate | `5c8e8782f5250ee6acb8a31aeb7cfb796d249120d156b0eb758ad40054310a71` |
| H-006 Compatibility Certificate | `81604f5b25ad39eeb6ec0c27e9743e0f6e2ce43f4dce650211fdc9d9a43dfd2f` |

## Prerequisite Status

1. **Baseline browser repair: SATISFIED.** The five stale/locator assertions were repaired without product-code changes; all thirteen Playwright tests pass.
2. **Initial Git baseline: AUTHORIZED.** The Don authorized an initial snapshot, safehouse branch, and worktree on 2026-07-27.
3. **The Hit authorization: SATISFIED.** The Don explicitly replied “Authorized” to the combined execution gate on 2026-07-27.
4. **Human review staffing.** Two playable rehearsals require four distinct qualified named reviewers. Codex cannot manufacture these approvals. Implementation can reach review-ready drafts without them, but promotion and a contract-compliant real playable demo remain blocked.

## Isolation Strategy

The Safehouse workflow cannot create a worktree from an unborn repository. Until the initial snapshot is authorized, no code work begins. After the snapshot:

- create branch `codex/heist/codeguessr-content-acquisition`;
- prefer a project-local `.worktrees/` safehouse only after it is explicitly ignored and the ignore rule is committed;
- use one worker per territory until isolated worktrees exist;
- preserve all unrelated user changes and prohibit cross-territory edits without Underboss coordination.

## Territories

### Territory: Baseline and Build Integrity

**Crew Lead Domain:** Existing test truth, package scripts, dependency and branch prerequisites  
**Files:** `tests/e2e/**`, `package.json`, `pnpm-lock.yaml`, `.gitignore`  
**Work Packages:** WP-001, WP-017, WP-023, WP-027  
**Workers:** 1  
**Budget:** 6000 tokens

### Territory: Evidence and Trusted Policy

**Crew Lead Domain:** Evidence schema, source regime, policy registers, operator authorization and time  
**Files:** `packages/content/src/evidence/**`, `packages/content/src/rights/**`, `packages/content/src/acquisition/policy/**`, `ops/content/policies/**`  
**Work Packages:** WP-002 through WP-005  
**Workers:** 1  
**Budget:** 7500 tokens

### Territory: GitHub Acquisition Core

**Crew Lead Domain:** Inputs, transport, immutable traversal, resume, screening, diff, marker and license evidence, draft construction  
**Files:** `packages/content/src/acquisition/github/**`, `packages/content/src/acquisition/draft/**`  
**Work Packages:** WP-006 through WP-014  
**Workers:** 1  
**Budget:** 17000 tokens

### Territory: Secure Operator Operations

**Crew Lead Domain:** Encrypted external storage, retention/deletion, audit and command boundary  
**Files:** `packages/content/src/acquisition/storage/**`, `packages/content/src/acquisition/operator/**`, `ops/content/acquire/**`  
**Work Packages:** WP-015 through WP-017  
**Workers:** 1  
**Budget:** 7000 tokens

### Territory: Promotion and Game Adapters

**Crew Lead Domain:** Human promotion, readiness, language/provenance catalogue adapters and non-public demo loading  
**Files:** `packages/content/src/acquisition/promotion/**`, `packages/content/src/inventory/**`, `apps/game/src/server/content/**`, `apps/game/src/modes/**`, `apps/game/src/demo/**`  
**Work Packages:** WP-018 through WP-022  
**Workers:** 1  
**Budget:** 7500 tokens

### Territory: Real Rehearsal and Sweep

**Crew Lead Domain:** Controlled live runs, independent reviews, playable rehearsals and final evidence  
**Files:** `ops/content/runs/**`, external encrypted state root, `tests/e2e/**`, `docs/gangsta/codeguessr-content-acquisition/evidence/**`  
**Work Packages:** WP-024 through WP-027  
**Workers:** 1  
**Budget:** 4000 tokens plus external reviewer time

## Work Packages

**Prevention Guidance (all Work Packages):** Do not reproduce Gangsta-internal requirement or work-package identifiers in source code, test files, code comments, package metadata, operator output, policies, or product documentation. Those identifiers belong only in `docs/gangsta/`.

### WP-001: Restore a Truthful Browser Baseline

**Territory:** Baseline and Build Integrity  
**Contract Clause:** H1-AC-010; H3-AC-007; H4-AC-006  
**Files:** Modify `tests/e2e/provenance-accessibility.spec.ts`, `tests/e2e/language-accessibility.spec.ts`, `tests/e2e/privacy-accessibility.spec.ts`  
**Acceptance Criteria:**
1. Local demo controls are not misclassified as complete operational provenance/language support evidence.
2. All no-JavaScript tests assert the same observable fallback without relying on a locator that excludes `<noscript>`.
3. No product code changes are used to satisfy stale assertions.
4. All thirteen Playwright tests pass.
**Verification:** `pnpm test:e2e`  
**Budget:** 1500 tokens  
**Dependencies:** Don authorization for baseline repair

### WP-002: Add the Licensed GitHub Evidence Record

**Territory:** Evidence and Trusted Policy  
**Contract Clause:** H1-FR-001; H1-FR-004; H1-AC-002  
**Files:** Modify `packages/content/src/evidence/records.ts`, `packages/content/src/evidence/records.test.ts`, `packages/content/src/index.ts`  
**Acceptance Criteria:**
1. `licensed-github` is a distinct exact evidence source with every signed field.
2. Historical source types remain parseable but cannot impersonate the new class.
3. Unknown, missing, mutable, or extra fields fail closed.
**Verification:** `pnpm exec vitest run packages/content/src/evidence/records.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-001

### WP-003: Freeze the Revision 7 Source Regime

**Territory:** Evidence and Trusted Policy  
**Contract Clause:** H3-FR-002 through H3-FR-005; H1-FR-015  
**Files:** Modify `packages/content/src/rights/source-regime.ts`, `packages/content/src/rights/source-regime.test.ts`, `packages/domain/src/modes/provenance/**`, `packages/domain/test/provenance-regime.test.ts`  
**Acceptance Criteria:**
1. New provenance eligibility is licensed-GitHub positive versus affirmatively evidenced project-controlled negative.
2. Stack Overflow, standalone model output, synthetic fixtures, and missing-marker negatives are inactive for readiness.
3. Candidate count remains exactly two.
**Verification:** `pnpm exec vitest run packages/content/src/rights/source-regime.test.ts packages/domain/test/provenance-regime.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-002

### WP-004: Implement Canonical Policy and Approval Registers

**Territory:** Evidence and Trusted Policy  
**Contract Clause:** H1-FR-002; H1-AC-002; AC-ACQ-002  
**Files:** Create `packages/content/src/acquisition/policy/policy-register.ts`, `packages/content/src/acquisition/policy/policy-register.test.ts`, `ops/content/policies/repository-admission.v1.json`, `ops/content/policies/attribution-markers.v1.json`, `ops/content/policies/approved-policy-register.v1.json`  
**Acceptance Criteria:**
1. Only the two signed policy classes are accepted.
2. Canonical hashes, purpose, validity, approval and exact register-entry binding are enforced.
3. Policy content includes exact repositories, subtrees, licenses, filters, bounds, retention and accepted marker documents.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/policy/policy-register.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-002

### WP-005: Implement Operator Authorization and Authoritative Time

**Territory:** Evidence and Trusted Policy  
**Contract Clause:** NFR-020; NFR-021; H1-FR-010  
**Files:** Create `packages/content/src/acquisition/policy/operator-authorization.ts`, `packages/content/src/acquisition/policy/operator-authorization.test.ts`, `ops/content/policies/operator-authorization.v1.json`  
**Acceptance Criteria:**
1. Named operator, operating-system identity, repository, purpose, token allowance and UTC validity are exact.
2. Observation time and authoritative receipt time remain distinct.
3. Missing GitHub `Date`, clock skew beyond five minutes, and invalid authorization reject before draft completion.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/policy/operator-authorization.test.ts`  
**Budget:** 1500 tokens  
**Dependencies:** WP-004

### WP-006: Validate Acquisition Inputs and Endpoint Allowlist

**Territory:** GitHub Acquisition Core  
**Contract Clause:** NFR-021 items 1–2; H1-FR-004  
**Files:** Create `packages/content/src/acquisition/github/request.ts`, `packages/content/src/acquisition/github/request.test.ts`  
**Acceptance Criteria:**
1. One approved repository, forty-character lowercase commit, subtree, purpose and time are mandatory.
2. Mutable refs, arbitrary URLs, alternate hosts, redirects, GraphQL, archives, clones and policy-widening inputs reject.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/request.test.ts`  
**Budget:** 1500 tokens  
**Dependencies:** WP-004, WP-005

### WP-007: Build the Bounded GitHub Transport

**Territory:** GitHub Acquisition Core  
**Contract Clause:** NFR-021 items 2–6; AC-ACQ-003  
**Files:** Create `packages/content/src/acquisition/github/transport.ts`, `packages/content/src/acquisition/github/transport.test.ts`  
**Acceptance Criteria:**
1. Injected transport enforces HTTPS `api.github.com`, no redirects, fifteen-second timeout, four-request concurrency and response/request byte bounds.
2. Only validated 403/429 rate-limit signals pause; other errors reject.
3. Tokens and raw responses never enter diagnostics.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/transport.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-006

### WP-008: Traverse Only Immutable Approved Subtrees

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H1-FR-006; NFR-021 item 7; AC-ACQ-004  
**Files:** Create `packages/content/src/acquisition/github/tree-walk.ts`, `packages/content/src/acquisition/github/tree-walk.test.ts`  
**Acceptance Criteria:**
1. Non-recursive tree walking begins at the approved subtree and verifies every tree/blob identity.
2. Truncation, symlink, submodule, path escape, malformed entry, entry limit and blob limit reject.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/tree-walk.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-007

### WP-009: Add Hash-Verified Pause and Resume

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H1-FR-006; AC-ACQ-004  
**Files:** Create `packages/content/src/acquisition/github/checkpoint.ts`, `packages/content/src/acquisition/github/checkpoint.test.ts`  
**Acceptance Criteria:**
1. Checkpoints contain only immutable non-sensitive identities and verified progress.
2. Resume revalidates source, policy, operator, tool, checkpoint and stored objects.
3. Repetition cannot duplicate an object or draft.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/checkpoint.test.ts`  
**Budget:** 1800 tokens  
**Dependencies:** WP-008

### WP-010: Decode, Normalize and Screen Blobs

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H1-FR-007; NFR-022; AC-ACQ-006  
**Files:** Create `packages/content/src/acquisition/github/blob-screen.ts`, `packages/content/src/acquisition/github/blob-screen.test.ts`  
**Acceptance Criteria:**
1. Raw and normalized hashes remain distinct and line endings normalize deterministically.
2. Binary, oversize, unsupported, generated, vendor, minified, lockfile, deceptive-control, secret-like, suspicious-personal-data and duplicate content reject.
3. Source is never executed or sent to a model.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/blob-screen.test.ts`  
**Budget:** 2200 tokens  
**Dependencies:** WP-008

### WP-011: Reconstruct Same-Path Parent/Child Changes

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H1-FR-005; H3-FR-007; AC-ACQ-007  
**Files:** Create `packages/content/src/acquisition/github/changed-lines.ts`, `packages/content/src/acquisition/github/changed-lines.test.ts`  
**Acceptance Criteria:**
1. Deterministic diff uses pinned parent and child text blobs for one unchanged path.
2. Added, deleted, renamed, copied, type-changed, root, merge, binary and unchanged cases reject.
3. Excerpt coordinates, changed lines, bounded context, algorithm version and hashes are immutable.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/changed-lines.test.ts`  
**Budget:** 2500 tokens  
**Dependencies:** WP-010

### WP-012: Classify Recorded Agent Evidence

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H3-FR-003; H3-FR-006; H3-AC-003  
**Files:** Create `packages/content/src/acquisition/github/agent-marker.ts`, `packages/content/src/acquisition/github/agent-marker.test.ts`  
**Acceptance Criteria:**
1. Only bound vendor-documented marker rules and verified bot identities are accepted.
2. Named model and generic agent remain separate.
3. Generic classification always says “AI coding agent”; named bot/account attribution remains separate and cannot infer a model.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/agent-marker.test.ts`  
**Budget:** 1800 tokens  
**Dependencies:** WP-004, WP-011

### WP-013: Bind Pinned License and Rights-Screening Evidence

**Territory:** GitHub Acquisition Core  
**Contract Clause:** FR-018; H1-FR-012; AC-ACQ-005  
**Files:** Create `packages/content/src/acquisition/github/license-evidence.ts`, `packages/content/src/acquisition/github/license-evidence.test.ts`  
**Acceptance Criteria:**
1. Only the five exact V1 identifiers pass automated admission.
2. Pinned license blob and text hashes are mandatory.
3. Automated output states screening only and cannot satisfy file-level rights or attribution timing.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/github/license-evidence.test.ts`  
**Budget:** 1600 tokens  
**Dependencies:** WP-004, WP-008

### WP-014: Construct Immutable Non-Publishable Drafts

**Territory:** GitHub Acquisition Core  
**Contract Clause:** H1-FR-008; H1-AC-004; AC-ACQ-011  
**Files:** Create `packages/content/src/acquisition/draft/acquisition-draft.ts`, `packages/content/src/acquisition/draft/acquisition-draft.test.ts`  
**Acceptance Criteria:**
1. Draft contains every exact source, hash, policy/register, operator, time, screening, storage and purpose field.
2. Identical inputs produce byte-identical draft bytes.
3. Draft cannot typecheck or validate as evidence, publication eligibility, catalogue, manifest or playable round.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/draft/acquisition-draft.test.ts`  
**Budget:** 1600 tokens  
**Dependencies:** WP-009 through WP-013

### WP-015: Implement the Encrypted External Object Store

**Territory:** Secure Operator Operations  
**Contract Clause:** NFR-011; H1-FR-009; H1-AC-005  
**Files:** Create `packages/content/src/acquisition/storage/encrypted-store.ts`, `packages/content/src/acquisition/storage/encrypted-store.test.ts`  
**Acceptance Criteria:**
1. External absolute root, containment, owner-only permissions, no-follow exclusive temporary creation, authenticated encryption, durable flush and atomic rename are enforced.
2. Keys, plaintext, tokens and tags never enter repository artifacts or logs.
3. Stored objects are immutable and deduplicated by verified identity.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/storage/encrypted-store.test.ts`  
**Budget:** 2800 tokens  
**Dependencies:** WP-014

### WP-016: Enforce Retention, Deletion and Append-Only Audit

**Territory:** Secure Operator Operations  
**Contract Clause:** NFR-011 items 5–8; H1-FR-010  
**Files:** Create `packages/content/src/acquisition/storage/lifecycle.ts`, `packages/content/src/acquisition/storage/lifecycle.test.ts`, `packages/content/src/acquisition/operator/audit.ts`, `packages/content/src/acquisition/operator/audit.test.ts`  
**Acceptance Criteria:**
1. Secret/PII, other rejected, unresolved and post-review deadlines use authoritative time exactly.
2. Deletion is verified and legal holds are explicit.
3. Every required operator event is metadata-only and append-only.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/storage/lifecycle.test.ts packages/content/src/acquisition/operator/audit.test.ts`  
**Budget:** 2200 tokens  
**Dependencies:** WP-005, WP-015

### WP-017: Expose the Operator-Only Command

**Territory:** Secure Operator Operations; Baseline and Build Integrity  
**Contract Clause:** NFR-020; H1-FR-003; AC-ACQ-012  
**Files:** Modify `package.json`, `pnpm-lock.yaml`, `packages/content/package.json`; create `packages/content/src/acquisition/index.ts`, `ops/content/acquire/index.ts`, `ops/content/acquire/operator-command.test.ts`  
**Acceptance Criteria:**
1. Acquisition is exposed only from an explicit operator subpath and command.
2. The locked TypeScript command runner is a development/operator tool, not a game runtime dependency.
3. Token enters only through the approved secret channel.
4. Browser/game imports cannot resolve acquisition.
**Verification:** `pnpm exec vitest run ops/content/acquire/operator-command.test.ts && pnpm typecheck`  
**Budget:** 2000 tokens  
**Dependencies:** WP-006 through WP-016

### WP-018: Build the Human Promotion Adapter

**Territory:** Promotion and Game Adapters  
**Contract Clause:** H1-FR-011 through H1-FR-014; H1-AC-007  
**Files:** Create `packages/content/src/acquisition/promotion/promote-draft.ts`, `packages/content/src/acquisition/promotion/promote-draft.test.ts`; modify `packages/content/src/index.ts`  
**Acceptance Criteria:**
1. Promotion requires complete four-person eligibility, file-level rights, attribution timing, answer and version evidence.
2. Missing or conflicting human facts always reject.
3. Accepted output is a normal immutable H-001 record/catalogue handoff, never an acquisition draft mutation.
**Verification:** `pnpm exec vitest run packages/content/src/acquisition/promotion/promote-draft.test.ts`  
**Budget:** 2000 tokens  
**Dependencies:** WP-002, WP-014

### WP-019: Update Corpus Readiness for Revision 7

**Territory:** Promotion and Game Adapters  
**Contract Clause:** H1-FR-015; H1-AC-010  
**Files:** Modify `packages/content/src/inventory/corpus-readiness.ts`, `packages/content/src/inventory/corpus-readiness.test.ts`  
**Acceptance Criteria:**
1. Licensed-GitHub positives/language items and affirmative project-controlled negatives are the only active classes.
2. Drafts, historical model output, Stack Overflow and synthetic fixtures cannot satisfy authentic readiness.
3. Existing 70/15, 3:2, uniqueness, review and version checks remain intact.
**Verification:** `pnpm exec vitest run packages/content/src/inventory/corpus-readiness.test.ts`  
**Budget:** 1600 tokens  
**Dependencies:** WP-003, WP-018

### WP-020: Adapt Approved Language Content to the Real Flow

**Territory:** Promotion and Game Adapters  
**Contract Clause:** H4-FR-001 through H4-FR-010; H4-AC-002 through H4-AC-005  
**Files:** Create `apps/game/src/server/content/catalogue/language-entry.ts`, `apps/game/test/language-catalogue-entry.test.ts`; modify language server boundary only as required  
**Acceptance Criteria:**
1. Only promoted licensed-GitHub language records enter.
2. Candidate, ambiguity, source, rights, clue, version and approved reveal attribution bindings remain exact.
3. No acquisition/raw evidence crosses the adapter.
**Verification:** `pnpm exec vitest run apps/game/test/language-catalogue-entry.test.ts apps/game/test/language-flow.test.ts`  
**Budget:** 1600 tokens  
**Dependencies:** WP-018

### WP-021: Adapt Approved Provenance Content to the Real Flow

**Territory:** Promotion and Game Adapters  
**Contract Clause:** H3-FR-001 through H3-FR-013; H3-AC-002 through H3-AC-008  
**Files:** Create `apps/game/src/server/content/catalogue/provenance-entry.ts`, `apps/game/test/provenance-catalogue-entry.test.ts`; modify provenance server boundary only as required  
**Acceptance Criteria:**
1. Positive and negative evidence classes remain exact.
2. Named model, generic agent and separate attribution treatments cannot drift.
3. Source and evidence are absent before authorized reveal and telemetry remains unchanged.
**Verification:** `pnpm exec vitest run apps/game/test/provenance-catalogue-entry.test.ts apps/game/test/provenance-flow.test.ts apps/game/test/provenance-projection.test.ts`  
**Budget:** 1800 tokens  
**Dependencies:** WP-018

### WP-022: Load Approved Non-Public Rehearsal Content

**Territory:** Promotion and Game Adapters  
**Contract Clause:** H3-FR-016; H4-FR-014; AD-ACQ-007  
**Files:** Create `apps/game/src/demo/rehearsal-catalogue.ts`, `apps/game/test/rehearsal-catalogue.test.ts`; modify `apps/game/src/app/page.tsx`, `apps/game/src/demo/demo-game.ts` only to select an explicitly approved local rehearsal catalogue  
**Acceptance Criteria:**
1. Default synthetic demo remains clearly identified until both promoted entries exist.
2. Approved rehearsal mode loads one real language and one real positive provenance item without embedding restricted evidence.
3. Failure to load approved entries falls back safely and never fabricates approval.
**Verification:** `pnpm exec vitest run apps/game/test/rehearsal-catalogue.test.ts apps/game/test/demo-game.test.ts`  
**Budget:** 1500 tokens  
**Dependencies:** WP-020, WP-021

### WP-023: Prove Runtime and Bundle Containment

**Territory:** Baseline and Build Integrity  
**Contract Clause:** NFR-020; AC-ACQ-012; AC-ACQ-016  
**Files:** Create `tests/containment/acquisition-boundary.test.mjs`; modify package exports/build checks only as required  
**Acceptance Criteria:**
1. Browser, game runtime, bundles, source maps, manifests and telemetry contain no transport, token, store, policy, raw evidence or diagnostics.
2. Approved public attribution enters only through reveal.
3. No prohibited acquisition route or background trigger exists.
**Verification:** `node --test tests/containment/acquisition-boundary.test.mjs && pnpm --filter @codeguessr/game build`  
**Budget:** 1800 tokens  
**Dependencies:** WP-017, WP-022

### WP-024: Acquire One Real Language Draft

**Territory:** Real Rehearsal and Sweep  
**Contract Clause:** AC-ACQ-013; H4-FR-014  
**Files:** Create immutable run evidence under `docs/gangsta/codeguessr-content-acquisition/evidence/`; raw data remains only in external encrypted storage  
**Acceptance Criteria:**
1. Controlled operator command uses one exact approved repository/commit/subtree.
2. Live response hashes, policy/operator bindings and draft pass all automated gates.
3. Output remains `DRAFT_REVIEW_REQUIRED`.
**Verification:** `pnpm acquire:content -- --run <approved-language-run>` plus offline draft verifier  
**Budget:** 1000 tokens  
**Dependencies:** WP-017

### WP-025: Acquire One Real Recorded-Agent Draft

**Territory:** Real Rehearsal and Sweep  
**Contract Clause:** AC-ACQ-014; H3-FR-016  
**Files:** Create immutable run evidence under `docs/gangsta/codeguessr-content-acquisition/evidence/`; raw data remains only in external encrypted storage  
**Acceptance Criteria:**
1. Exact approved single-parent same-path change has accepted marker evidence and at least one eligible changed code line.
2. Named-model/generic-agent tier and separate attribution are exact.
3. Output remains `DRAFT_REVIEW_REQUIRED`.
**Verification:** `pnpm acquire:content -- --run <approved-provenance-run>` plus offline draft verifier  
**Budget:** 1000 tokens  
**Dependencies:** WP-017

### WP-026: Complete Independent Review and Promotion

**Territory:** Real Rehearsal and Sweep  
**Contract Clause:** H1-FR-011; H3-FR-012; AC-ACQ-013; AC-ACQ-014  
**Files:** Add signed review/promotion evidence under `docs/gangsta/codeguessr-content-acquisition/evidence/`; no raw source in Git  
**Acceptance Criteria:**
1. Each item has four different named qualified reviewers and every affirmative decision.
2. Rights review approves file coverage, notices and delayed attribution.
3. Exact promoted catalogue records are immutable and verifiable.
**Verification:** offline promotion verifier plus `pnpm exec vitest run packages/content/src/acquisition/promotion/promote-draft.test.ts`  
**Budget:** 500 tokens plus external reviewer time  
**Dependencies:** WP-018, WP-024, WP-025; external reviewers

### WP-027: Run Both Playable Rehearsals and the Final Sweep

**Territory:** Real Rehearsal and Sweep; Baseline and Build Integrity  
**Contract Clause:** AC-ACQ-013 through AC-ACQ-017; H3-AC-009; H4-AC-008  
**Files:** Create `tests/e2e/real-content-rehearsal.spec.ts` and final evidence report under `docs/gangsta/codeguessr-content-acquisition/evidence/`  
**Acceptance Criteria:**
1. One language and one recorded-agent round complete through real catalogue, answer and authorized reveal.
2. Pre-answer source containment and exact post-answer attribution pass.
3. Unit, typecheck, accessibility, performance, browser, containment and build suites pass.
4. The report says “MVP rehearsal ready” only; it does not claim full controlled-beta corpus readiness.
**Verification:** `pnpm test && pnpm typecheck && pnpm test:a11y && pnpm test:performance && pnpm test:e2e && node --test tests/containment/*.test.mjs && pnpm --filter @codeguessr/game build`  
**Budget:** 1500 tokens  
**Dependencies:** WP-001 through WP-026

## Execution Order

1. **Prerequisite gate:** authorize and complete WP-001; rerun all baseline suites.
2. **Isolation gate:** create the authorized initial snapshot, branch and safehouse.
3. **Foundation:** WP-002, then WP-003; WP-004, then WP-005.
4. **Acquisition core:** WP-006 → WP-007 → WP-008; then WP-009 and WP-010; then WP-011, WP-012 and WP-013; then WP-014.
5. **Secure operations:** WP-015 → WP-016 → WP-017.
6. **Promotion and game adapters:** WP-018; then WP-019, WP-020 and WP-021; then WP-022 and WP-023.
7. **Real artifacts:** WP-024 and WP-025 may run independently; WP-026 requires both and external reviewers.
8. **Acceptance:** WP-027.

## Baseline Verification

| Check | Result | Evidence |
|---|---|---|
| Workspace/unit tests | PASS | TAP 1/1 and Vitest 1,622/1,622 |
| TypeScript typecheck | PASS | All five participating workspace projects |
| Accessibility support gate | PASS | 37/37 |
| Performance gate | PASS | 6/6 |
| Playwright browser suite | PASS | 13/13 after the authorized test-only repair |
| Focused no-JavaScript comparison | PASS | All three mode suites use the observable body-text fallback |
| Dependencies | AVAILABLE | Node 20.18.0, pnpm 9.15.9, lockfile and installed modules present |
| Git baseline | AUTHORIZED | Initial snapshot authorization recorded; creation follows this plan update |
| Safehouse | AUTHORIZED | Project-local `.worktrees/` selected and ignored |

## Resource Development Status

The Execution Plan is approved and executable. WP-001 is complete, all baseline suites are green, and the Don authorized the initial snapshot, `codex/heist/codeguessr-content-acquisition` safehouse, and The Hit.

Even after technical execution, WP-026 requires four real independent reviewers before a contract-compliant real-content playable rehearsal can be claimed.
