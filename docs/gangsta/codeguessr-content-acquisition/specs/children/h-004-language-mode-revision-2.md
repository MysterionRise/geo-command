---
heist: H-004-language-mode
parent-contract: docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md
parent-revision: 7
parent-sha256: 3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5
amends-child-contract: docs/gangsta/code-guessing-startup/specs/children/h-004-language-mode.md
amends-child-revision: 1
amends-child-sha256: 6cfcaa347ce11af721d0d55bb3869b49bea9066919a17204df2dca0d1a638eda
upstream-interface-contracts:
  - heist: H-001-content-and-evidence-pipeline
    revision: 2
    path: docs/gangsta/codeguessr-content-acquisition/specs/children/h-001-content-evidence-revision-2.md
    sha256: 247a82b84df99b8757e52b123e719f3fc67915a1224225791460a1e23e60aedb
  - heist: H-002-arcade-shell-and-round-state
    revision: 1
    path: docs/gangsta/code-guessing-startup/specs/children/h-002-arcade-state.md
    sha256: e8c135578955a65ed44e2bb75d09f1eaaf4c1b6eb3142f89b7632ece54604d98
    compatibility-certificate: docs/gangsta/codeguessr-content-acquisition/specs/compatibility/h-002-revision-7-certificate.md
    compatibility-sha256: 449b34b75433a7d8ce7ee3e59118ba9792c04453dcc614920f4013adf90d2393
date: 2026-07-27
revision: 2
status: approved
reviewed-draft-sha256: b3d9b85d1ed7590856e0ef91d297d7a0ad82f4fcf81e24d2f4179dd7d847ef4f
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-27T16:32:24+01:00
    authorization: "Please continue implementation then"
  - role: Consigliere
    name: Gangsta Consigliere — Final Child Layer Review 2
    signed-at: 2026-07-27T16:32:24+01:00
  - role: Underboss
    name: Codex Underboss
    signed-at: 2026-07-27T16:32:24+01:00
---

# Child Contract H-004 Revision 2: Licensed GitHub Language Mode

## Objective

Deliver the programming-language coordinate of the “GeoGuessr for code” arcade using independently reviewed, licensed, immutable GitHub code changes while preserving closed candidate sets, defensible answers, fair clues, approved reveal attribution, and the existing gameplay and measurement interfaces.

## Authority and Precedence

1. This Contract depends on the exact approved Programme Revision 7, H-001 Revision 2, H-002 Revision 1, and H-002 Compatibility Certificate hashes in frontmatter.
2. H-004 Revision 1 remains immutable historical evidence.
3. Revision 2 replaces H-004 Revision 1 Child Requirements 1, 2, 4, and 5 only where licensed-GitHub evidence and reveal attribution add detail; its Dependencies, Out of Scope, and Implementation Authorization are replaced.
4. Every unaffected H-004 Revision 1 language, ordering, calibration, accessibility, browser, interaction, correction, and error requirement remains binding.
5. Programme Revision 7 controls any conflict.

## Inherited Programme Clauses

H-004 inherits Programme Revision 7 FR-007, FR-010, FR-012, FR-014, FR-017, FR-018, FR-034, FR-035, AC-005, AC-014/OOS-ingestion, NFR-003, NFR-007, NFR-011, NFR-015, NFR-020 through NFR-022, AD-ACQ-001 through AD-ACQ-007, AC-ACQ-001 through AC-ACQ-017, all applicable Revision 6 mode, scoring, state, accessibility, correction, measurement, reviewer-independence, Constitution, and risk controls, and the exact approved H-001 evidence/promotion boundary.

## Child Requirements

1. **H4-FR-001 — Licensed source.** A Revision 7 language item requires a promoted licensed-GitHub record bound to an approved repository, commit, parent, same path, child/parent blobs, pinned license, policies, screening, rights decisions, review lineage, and immutable hashes.
2. **H4-FR-002 — Proposal only.** File extension, path, GitHub metadata, syntax heuristic, or automated detector may propose a language but cannot decide eligibility or the correct answer.
3. **H4-FR-003 — Independent answer review.** Two distinct qualified technical reviewers must agree that exactly one language answer is defensible for the displayed excerpt and clues. Any polyglot, embedded-language, DSL, templating, generated, ambiguous, or competing-answer case is ineligible.
4. **H4-FR-004 — Candidate-set integrity.** Every round binds an immutable candidate-set version containing canonical labels, aliases, ordering policy, correct candidate, presented candidate count, distractor rationales, clue set, answer, and calibration.
5. **H4-FR-005 — Source-to-excerpt binding.** The excerpt and clues derive only from the approved promoted child blob and remain bound to source, content, excerpt, evidence, candidate-set, clue-set, rules, scoring, and renderer versions.
6. **H4-FR-006 — Rights-compatible hidden identity.** Rights review must approve file-level coverage, notices, redistribution, display, and attribution timing. If required attribution before answer would reveal the language or source, the item is rejected.
7. **H4-FR-007 — No source leak.** Repository, path, commit, author, source URL, license attribution, correct language, evidence, and restricted acquisition data remain absent from all pre-reveal, static, manifest, public-bundle, source-map, log, and telemetry locations.
8. **H4-FR-008 — Authorized reveal.** Only the inherited authorized reveal may return correctness, canonical language answer, approved evidence/source/attribution, helpful and misleading signals, distractor explanation, and immutable version references.
9. **H4-FR-009 — Human promotion.** H-004 consumes only H-001 promoted catalogue records. It cannot acquire, approve rights, manufacture reviewers, promote, publish, or access raw snapshots.
10. **H4-FR-010 — Calibration.** Candidate ordering is deterministic or explicitly randomized within the bound session; presented candidate count is retained for the existing chance baseline. Difficulty and clue calibration cannot imply equality with provenance.
11. **H4-FR-011 — Measurement preservation.** `Answer accepted` and `Reveal authorized` retain exactly their Revision 6 event-specific facts. No repository, language evidence, source, or new event field enters telemetry.
12. **H4-FR-012 — Correction and withdrawal.** Language rounds inherit every H-001 complaint, correction, quarantine, `CONTENT_WITHDRAWN`, reveal denial, notice, purge, deletion, score adjustment, and analytical exclusion behavior.
13. **H4-FR-013 — Accessibility.** The complete language journey preserves every H-004 Revision 1 keyboard, focus, announcement, screen-reader, non-color, responsive, reduced-motion, clue, answer, reveal, correction, and error requirement.
14. **H4-FR-014 — Real rehearsal.** One approved licensed-GitHub language item must traverse the real H-001 promotion adapter, approved catalogue, H-002 state/reveal boundary, and H-004 mode as a complete non-public playable round with no pre-answer source leak and exact post-answer attribution.

## Acceptance Criteria

1. **H4-AC-001 — Lineage.** Every frontmatter hash matches an approved artifact and the six-child ledger is complete before implementation.
2. **H4-AC-002 — Source integrity.** Tests reject missing/mismatched source, license, policy, rights, review, blob, excerpt, evidence, and version bindings.
3. **H4-AC-003 — Answer integrity.** Alias, candidate, distractor, ordering, candidate-count, extension-only, polyglot, embedded-language, DSL, template, generated, competing-answer, and ambiguity fixtures prove that only one independently defensible answer can be promoted.
4. **H4-AC-004 — Rights and containment.** Rights evidence proves delayed attribution compatibility. Negative artifact audits prove no pre-reveal language, source, attribution, or restricted evidence leak.
5. **H4-AC-005 — Authorized reveal.** Positive tests prove the reveal returns only approved answer, evidence, attribution, explanations, and versions; cross-scope, premature, replayed, expired, and corrected reveals disclose none.
6. **H4-AC-006 — Calibration and accessibility.** Candidate ordering/count, chance baseline, all clue counts, difficulty, explanations, complete supported-client accessibility flow, correction, and error cases pass.
7. **H4-AC-007 — Measurement.** Exact event-schema comparison proves no Revision 6 event field changed and no source/evidence payload entered telemetry.
8. **H4-AC-008 — Rehearsal.** Programme AC-ACQ-013 passes through the real language acquisition-to-playable path with all required reviewers and exact reveal attribution.
9. **H4-AC-009 — Regression and sweep.** Every unaffected H-004 Revision 1 test and applicable Programme acceptance row remains passing with no unresolved critical answer, rights, ambiguity, security, accessibility, or scope defect.

## Dependencies

H-001 Revision 2 supplies the only licensed-GitHub draft, evidence, promotion, and catalogue boundary. H-002 Revision 1 plus its signed Compatibility Certificate supplies unchanged gameplay state and authorized reveal. H-006 collects unchanged measurement/final-gate evidence. Implementation remains blocked until H-003 Revision 2 and every Programme Revision 7 child/certificate artifact are signed.

## Out of Scope

- GitHub acquisition, raw storage, policy administration, rights approval, reviewer impersonation, promotion, or publication capability inside H-004.
- Open-ended language entry, compiler execution, source execution, model processing, or extension-only truth.
- Provenance, algorithm, project, or country answer semantics.
- Public attribution before the authorized reveal.

## Implementation Authorization

Not authorized while this Contract is draft. After signature, implementation remains blocked until the complete six-child layer, Resource Development, and The Hit authorization are complete.
