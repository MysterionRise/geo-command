---
heist: H-003-provenance-mode
parent-contract: docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md
parent-revision: 7
parent-sha256: 3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5
amends-child-contract: docs/gangsta/code-guessing-startup/specs/children/h-003-provenance-mode.md
amends-child-revision: 1
amends-child-sha256: 750530ac503238e85d3f16e28ad1fbf2942a5293c27dbf095ef97354a917f99c
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
draft-amendment: 2
status: approved
reviewed-draft-sha256: e0e73c6290d90d40c66f789af43a7c34ef1ec0ed2f0bef46e7a7d2bbad53e7d5
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

# Child Contract H-003 Revision 2: Recorded Agent Participation

## Objective

Deliver the provenance coordinate of the “GeoGuessr for code” arcade as a fair inference about one exact code change: whether durable accepted evidence records an AI coding agent as participating. Preserve the distinction between a named model, a generic agent, and unsupported inference without claiming AI detection, exclusive authorship, human identity, or code quality.

## Authority and Precedence

1. This Contract depends on the exact approved Programme Revision 7, H-001 Revision 2, H-002 Revision 1, and H-002 Compatibility Certificate hashes in frontmatter.
2. H-003 Revision 1 remains immutable historical evidence.
3. Revision 2 replaces the H-003 Revision 1 Objective; Child Requirements 1 through 5; source-regime, candidate-label, and provenance-copy acceptance text; Dependencies; Out of Scope; and Implementation Authorization.
4. H-003 Revision 1 accessibility, browser, interaction, correction, and mode-isolation requirements remain binding where unchanged.
5. Programme Revision 7 controls any conflict.

## Inherited Programme Clauses

H-003 inherits Programme Revision 7 FR-006, FR-010, FR-014, FR-016 through FR-018, FR-034, FR-035, AC-005, AC-014/OOS-ingestion, NFR-003, NFR-007, NFR-011, NFR-015, NFR-016, NFR-020 through NFR-022, AD-ACQ-003 through AD-ACQ-007, AC-ACQ-001 through AC-ACQ-017, all applicable Revision 6 mode, scoring, state, accessibility, correction, measurement, reviewer-independence, Constitution, and risk controls, and the exact approved H-001 evidence/promotion boundary.

## Child Requirements

1. **H3-FR-001 — Fixed question.** The provenance prompt is exactly: “Is an AI coding agent durably recorded as participating in this code change?”
2. **H3-FR-002 — Fixed candidates.** The immutable two-answer candidate set is exactly `RECORDED_AGENT_PARTICIPATION` and `PROJECT_CONTROLLED_HUMAN_ONLY`; candidate count is two for every Revision 7 provenance round.
3. **H3-FR-003 — Positive evidence.** `RECORDED_AGENT_PARTICIPATION` requires a promoted licensed-GitHub record with accepted `NAMED_MODEL_RECORDED` or `AGENT_RECORDED` evidence bound to the exact single-parent, same-path parent/child code change.
4. **H3-FR-004 — Negative evidence.** `PROJECT_CONTROLLED_HUMAN_ONLY` requires an immutable project-owned or commissioned single-parent code change, recorded project authorization, creator/process identity where lawful, and affirmative attestation that no AI coding agent participated in that exact change. Missing attribution, unfamiliar style, or an automated score never qualifies.
5. **H3-FR-005 — Active regime.** Stack Overflow, standalone model output, arbitrary public GitHub negatives, synthetic demo fixtures, style detection, and undocumented AI claims are inactive for Revision 7 corpus eligibility.
6. **H3-FR-006 — Evidence tier.** A named model may be revealed only for `NAMED_MODEL_RECORDED` and only using the exact recorded name. The `AGENT_RECORDED` classification always uses the generic public phrase “AI coding agent.” Approved post-answer source attribution may separately name a bot or agent account where supported or required, but that attribution does not create a named-agent classification and never permits model inference. A conventional trailer is described as a durable record, never authenticated proof of actual contribution.
7. **H3-FR-007 — Change binding.** The playable excerpt contains at least one eligible child-side changed code line and bounded context from the same child blob. Parent/child blob identities, deterministic diff version, coordinates, excerpt hash, and evidence hash remain bound through promotion and reveal.
8. **H3-FR-008 — No source leak.** Commit message, marker, repository, author, committer, source URL, attribution, model/agent identity, correct answer, and restricted evidence remain absent from every pre-reveal, static, manifest, public-bundle, source-map, log, and telemetry location.
9. **H3-FR-009 — Authorized reveal.** Only the inherited authorized reveal transition may return correctness, the exact approved public evidence tier, approved source identity and attribution, helpful/misleading-signal explanation, and immutable content, candidate-set, rules, scoring, and evidence/reveal versions.
10. **H3-FR-010 — Honest explanation.** Reveal and report copy states what the accepted record contains. It never says the agent authored every line, that no human participated, that an unmarked change is human-written, or that the game detects AI.
11. **H3-FR-011 — Candidate and clue calibration.** Freeze candidate ordering policy, source-regime version, clue set, explanation, difficulty, chance baseline of one half, and calibration evidence before invitations. Both answers and clue counts zero, one, and two must be represented without pre-answer leakage.
12. **H3-FR-012 — Independent review.** Promotion requires the four distinct H-001 roles, including two qualified technical reviewers who agree on answer integrity, changed-line binding, evidence tier, ambiguity, difficulty, and fair clue/reveal design.
13. **H3-FR-013 — Measurement preservation.** `Answer accepted` and `Reveal authorized` retain exactly their Revision 6 event-specific facts. Source regime resolves through existing immutable version bindings; no raw source, marker, model, agent, or new event field is added.
14. **H3-FR-014 — Correction and withdrawal.** Provenance rounds inherit every H-001 complaint, correction, quarantine, `CONTENT_WITHDRAWN`, reveal denial, notice, purge, deletion, score adjustment, and analytical exclusion behavior.
15. **H3-FR-015 — Accessibility.** The complete provenance journey preserves every H-003 Revision 1 keyboard, focus, announcement, screen-reader, non-color, responsive, reduced-motion, clue, answer, reveal, correction, and error requirement.
16. **H3-FR-016 — Real rehearsal.** One approved licensed-GitHub positive change must traverse the real H-001 promotion adapter, approved catalogue, H-002 state/reveal boundary, and H-003 mode as a complete non-public playable round with no pre-answer source leak and exact post-answer evidence/attribution.

## Acceptance Criteria

1. **H3-AC-001 — Lineage.** Every frontmatter hash matches an approved artifact and the six-child ledger is complete before implementation.
2. **H3-AC-002 — Candidate semantics.** Schema, UI, copy, reveal, report, and telemetry tests prove the exact prompt, two labels, candidate count, source-regime version, and prohibited-claim boundary.
3. **H3-AC-003 — Evidence classes.** Fixtures accept a valid named-model record, generic-agent record, and verified bot author; preserve their distinct public claims; prove that every `AGENT_RECORDED` classification stays “AI coding agent” even when separate attribution names a bot/account; and reject malformed, altered, undocumented, ambiguous, purpose-incompatible, generic-to-named, named-agent-tier, or model-inference upgrades.
4. **H3-AC-004 — Negative integrity.** Fixtures accept only complete project-controlled affirmative no-agent evidence and reject missing-marker, arbitrary GitHub, style-only, standalone-model, Stack Overflow, and incomplete-attestation negatives.
5. **H3-AC-005 — Diff and excerpt integrity.** The H-001 same-path parent/child reconstruction, eligibility filters, coordinates, hashes, displayed-patch non-authority, clue context, and immutable bindings pass for every accepted round.
6. **H3-AC-006 — Containment and reveal.** Positive tests prove the authorized reveal returns only approved public evidence and attribution and keeps any named bot/account attribution separate from the generic `AGENT_RECORDED` classification. Negative tests and artifact audits prove no pre-reveal answer, source, marker, attribution, model/agent identity, restricted evidence, named-agent classification, or inferred model leak.
7. **H3-AC-007 — Calibration and accessibility.** Both answers, all three clue counts, ordering, chance baseline, explanations, ambiguity/difficulty review, complete supported-client accessibility flow, correction, and error cases pass.
8. **H3-AC-008 — Measurement.** Exact event-schema comparison proves no Revision 6 event field changed and no source-regime or evidence payload entered telemetry.
9. **H3-AC-009 — Rehearsal.** Programme AC-ACQ-014 passes through the real positive acquisition-to-playable path with all required reviewers and exact reveal attribution.
10. **H3-AC-010 — Regression and sweep.** Every unaffected H-003 Revision 1 test and applicable Programme acceptance row remains passing with no unresolved critical provenance, rights, ambiguity, security, accessibility, or scope defect.

## Dependencies

H-001 Revision 2 supplies the only licensed-GitHub draft, evidence, promotion, and catalogue boundary. H-002 Revision 1 plus its signed Compatibility Certificate supplies unchanged gameplay state and authorized reveal. H-006 collects unchanged measurement/final-gate evidence. Implementation remains blocked until H-004 Revision 2 and every Programme Revision 7 child/certificate artifact are signed.

## Out of Scope

- AI detection, probabilistic authorship, exclusive authorship, code quality, plagiarism, recruiting, or human-identity claims.
- GitHub acquisition, raw storage, policy administration, reviewer impersonation, or publication capability inside H-003.
- Stack Overflow, standalone model-output rounds, arbitrary public GitHub negatives, or missing-marker human inference.
- Language, algorithm, project, or country answer semantics.

## Implementation Authorization

Not authorized while this Contract is draft. After signature, implementation remains blocked until the complete six-child layer, Resource Development, and The Hit authorization are complete.
