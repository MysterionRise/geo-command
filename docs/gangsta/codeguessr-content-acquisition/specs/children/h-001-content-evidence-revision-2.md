---
heist: H-001-content-and-evidence-pipeline
parent-contract: docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md
parent-revision: 7
parent-sha256: 3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5
amends-child-contract: docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md
amends-child-revision: 1
amends-child-sha256: 0dc3e28e54e92f159140a1d88ed42122590cc33abafca7d3aa11b6ee8ccd7cdd
date: 2026-07-27
revision: 2
status: approved
reviewed-draft-sha256: c6925558f19e4f7b6c4db9b3247143fd6d9e813ee3539b82b2a46480bb811b7e
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-27T16:12:01+01:00
    authorization: "Yes"
  - role: Consigliere
    name: Gangsta Consigliere — First Child Dependency Layer
    signed-at: 2026-07-27T16:12:01+01:00
  - role: Underboss
    name: Codex Underboss
    signed-at: 2026-07-27T16:12:01+01:00
---

# Child Contract H-001 Revision 2: Content, Evidence, and Acquisition

## Objective

Extend H-001’s project-controlled content operations with the narrow licensed-GitHub acquisition path authorized by Programme Revision 7. H-001 Revision 2 owns operator acquisition, immutable quarantined drafts, restricted raw evidence, policy enforcement, human promotion, and catalogue handoff. It does not own gameplay delivery or mode truth.

## Authority and Precedence

1. This Contract depends on the exact approved Programme Revision 7 and H-001 Revision 1 hashes in frontmatter.
2. H-001 Revision 1 remains immutable historical evidence.
3. Revision 2 replaces H-001 Revision 1 Child Requirements 1, 3, and 6; the Acceptance Criterion requiring both the Stack Overflow determination and legacy fallback paths; its Dependencies, Out of Scope, and Implementation Authorization; and any Revision 1 text incompatible with Programme Revision 7 AC-005 or AC-014/OOS-ingestion.
4. Every unaffected H-001 Revision 1 requirement and acceptance criterion remains binding.
5. If this child conflicts with Programme Revision 7, Programme Revision 7 controls and implementation stops.

## Inherited Programme Clauses

H-001 inherits all applicable Programme Revision 7 clauses, including FR-006, FR-007, FR-012, FR-014 through FR-018, FR-019, FR-032, FR-034, FR-035, AC-005, AC-014/OOS-ingestion, NFR-003, NFR-007, NFR-011, NFR-015, NFR-016, NFR-020 through NFR-022, AD-ACQ-001 through AD-ACQ-007, AC-ACQ-001 through AC-ACQ-017, all Constitution rules, and risks ACQ-R-001 through ACQ-R-010. Revision 6 correction, complaint, publication, reviewer-independence, accessibility, and corpus-readiness controls remain inherited where Revision 7 does not replace them.

## Child Requirements

1. **H1-FR-001 — Evidence union.** Add a licensed-GitHub source class distinct from Stack Overflow, historical model-output, and project-owned-human evidence. It shall contain every common and source-specific field required by Programme Revision 7 and shall never be represented as project-owned-human.
2. **H1-FR-002 — Policy artifacts.** Maintain immutable Repository Admission Policy and Attribution Marker Policy versions, an Approved Policy Register lineage, and an Operator Authorization Register lineage. Policy flags or command inputs cannot widen an approved policy.
3. **H1-FR-003 — Operator boundary.** Provide acquisition only through an authenticated operator-owned package subpath and command. No participant, browser, gameplay, public endpoint, background job, webhook, or scheduler can invoke it.
4. **H1-FR-004 — Immutable acquisition.** Accept exactly one approved repository, full single-parent commit, approved subtree, purpose, and observation time. Acquire only through the bounded GitHub transport in Programme Revision 7 and bind repository, commit, parent, tree, path, blobs, licenses, policies, operator, receipt time, and hashes.
5. **H1-FR-005 — Same-path source rule.** A candidate path must be a regular text file at the same repository-relative path in both parent and child. Added, deleted, renamed, copied, type-changed, binary, root-commit, and merge-commit cases are rejected in this slice.
6. **H1-FR-006 — Resumable traversal.** Traverse only approved pinned subtrees, checkpoint every verified immutable object, pause only for validated rate limits, and revalidate all source, policy, operator, tool, checkpoint, and stored-object hashes before resume.
7. **H1-FR-007 — Deterministic screening.** Screen without executing, compiling, importing, rendering as markup, formatting, or modeling source. Apply every bound size, path, content, Unicode, secret, personal-data, license, duplicate, and ambiguity rule and emit only non-sensitive reason codes.
8. **H1-FR-008 — Draft boundary.** Acquisition emits only immutable `DRAFT_REVIEW_REQUIRED` artifacts. A draft is structurally incompatible with evidence eligibility, publication eligibility, a catalogue entry, a manifest item, or a playable round.
9. **H1-FR-009 — Restricted storage.** Store raw snapshots only through the external, encrypted, authenticated, atomic, no-follow, owner-only, immutable storage boundary and apply the exact Revision 7 deletion, retention, legal-hold, and authoritative-time rules.
10. **H1-FR-010 — Audit.** Bind every run, pause, resume, rejection, raw-object creation/deletion, draft completion, review transition, and promotion handoff to the named operator and append-only metadata-only audit evidence.
11. **H1-FR-011 — Human promotion.** Promotion is a separate capability. It requires four distinct qualified H-001 reviewers and complete answer-integrity, ambiguity, difficulty, provenance, rights, attribution, secrets, personal-data, safety, inert-rendering, accessibility, evidence-minimization, and version/hash decisions.
12. **H1-FR-012 — Rights gate.** License metadata is admission screening only. Promotion requires item-level coverage, embedded/third-party/vendor, notice, redistribution, presentation, and attribution-timing approval. If attribution must appear before the guess, the item is rejected.
13. **H1-FR-013 — Mode handoff.** A promoted record exposes only the narrow immutable approved-content interface consumed by H-003 or H-004. Acquisition transport, raw evidence, credentials, policies, diagnostics, and operator controls cannot cross that interface.
14. **H1-FR-014 — Reveal attribution.** Exact approved public source identity and attribution may exist in restricted H-001 evidence and the approved catalogue. Participant delivery is possible only through the existing authorized reveal boundary.
15. **H1-FR-015 — Corpus readiness.** `DRAFT_REVIEW_REQUIRED`, historical model-output, and Stack Overflow items do not count toward Revision 7 readiness. Only fully promoted licensed-GitHub positives/language items and affirmatively evidenced project-controlled negatives may count.
16. **H1-FR-016 — Correction lifecycle.** Every promoted item remains subject to the inherited complaint, quarantine, correction, `CONTENT_WITHDRAWN`, purge, deletion, notice, and immutable-history requirements.
17. **H1-FR-017 — Rehearsal support.** Provide the real acquisition, review, promotion, evidence, and catalogue boundaries needed for one non-public language rehearsal and one non-public recorded-agent-participation rehearsal. H-003 and H-004 own mode truth and playable-flow acceptance.

## Acceptance Criteria

1. **H1-AC-001 — Contract lineage.** Parent and amended-child hashes match, H-001 Revision 2 is signed, and the programme’s six-child ledger is complete before acquisition-feature implementation.
2. **H1-AC-002 — Source and policy records.** Schema tests require every Programme Revision 7 licensed-GitHub, policy-register, operator-register, source, receipt-time, retention, screening, and review field and reject unknown or mutable variants.
3. **H1-AC-003 — Transport and traversal.** Programme AC-ACQ-003 and AC-ACQ-004 pass against deterministic transport fixtures and the real adapter boundary without uncontrolled CI network calls.
4. **H1-AC-004 — Draft safety.** Programme AC-ACQ-005 through AC-ACQ-007 pass, including license rules, same-path parent/child reconstruction, every explicit rejected change type, unsafe-content rejection, and byte-identical deterministic drafts.
5. **H1-AC-005 — Storage and audit.** Programme AC-ACQ-010 passes against the real encrypted filesystem adapter in private temporary storage; operator authorization and append-only audit evidence cover every H1-FR-010 event.
6. **H1-AC-006 — Non-publication.** Compile-time, runtime, dependency-graph, bundle, source-map, manifest, telemetry, and capability tests pass Programme AC-ACQ-011, AC-ACQ-012, and AC-ACQ-016.
7. **H1-AC-007 — Promotion.** The real promotion adapter rejects every incomplete evidence or reviewer case and accepts only a complete four-person-reviewed record with exact immutable bindings.
8. **H1-AC-008 — Rights and complaint operations.** Programme AC-005 replacement, AC-ACQ-005, and inherited complaint/quarantine/correction drills pass.
9. **H1-AC-009 — Rehearsal boundary.** H-001’s portion of both Programme AC-ACQ-013 and AC-ACQ-014 passes with real non-public promoted catalogue entries and approved attribution.
10. **H1-AC-010 — Regression and final sweep.** All unaffected H-001 Revision 1 and Programme Revision 6 evidence remains passing, and Programme AC-ACQ-015 and AC-ACQ-017 pass for this territory.

## Dependencies

Entry dependency is the exact approved Programme Revision 7. H-003 Revision 2 and H-004 Revision 2 must cite the final approved H-001 Revision 2 hash before their implementation. H-002, H-005, and H-006 compatibility certificates and the remaining child revisions must all be signed before Resource Development.

## Out of Scope

- Gameplay state, participant enrollment, measurement formulas, mode-specific truth, clue design, scoring, and public presentation.
- General crawling, repository discovery, mutable refs, private repositories, Stack Overflow, HTML, GraphQL, clones, archives, webhooks, schedules, background acquisition, and public acquisition endpoints.
- Automatic reviewer identities, rights decisions, answer approval, difficulty, clues, publication, manifest insertion, or playable-round creation.
- AI detection, exclusive-authorship claims, source execution, or model processing.

The authenticated offline operator’s bounded HTTPS calls to `api.github.com` are explicitly in scope.

## Implementation Authorization

Not authorized while this Contract is draft. After signature, implementation remains blocked until H-003 and H-004 Revision 2, all three Compatibility Certificates, Resource Development, and The Hit authorization are complete.
