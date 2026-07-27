---
heist: codeguessr-content-acquisition
phase: the-sit-down
review: 2
date: 2026-07-27
subject-sha256: 03ccfb460fc4c9dbf9e900c8e90fde71d56b6952bd49965a8e977f2c71e48d64
verdict: REJECT
status: superseded-by-amendment-revision-3
---

# Consigliere Assessment

**Subject:** Programme Revision 7 amendment revision 2, SHA-256 `03ccfb460fc4c9dbf9e900c8e90fde71d56b6952bd49965a8e977f2c71e48d64`

**Verdict:** REJECT

## Findings

1. **CRITICAL — Revision 6 AC-005 still prohibits the new source regime.** Revision 6 AC-005 required the no-Stack-Overflow corpus to use exclusively project-owned human samples and project-authorized model outputs. Revision 7 admitted licensed GitHub items but had not explicitly replaced AC-005.
2. **HIGH — Dependency containment contradicts authorized reveals.** The draft prohibited all source identities from the gameplay server and browser even though FR-018 and inherited FR-010/AC-003 require approved source identity and attribution after authorized reveal.
3. **HIGH — FR-034 did not preserve the frozen measurement interface exactly.** It referred to an undefined `candidateOutcome` and appeared to add source-regime and correctness fields to `Answer accepted`, although Revision 6 puts correctness in `Reveal authorized` and defines no source-regime event field.
4. **LOW — Review 1 corrections and source integrity otherwise passed.** All ten registered hashes matched, and the ingestion exception, six-child mechanism, active provenance regime, diff restriction, transport handling, policy trust, time/operator controls, GeoGuessr-for-code frame, rights gate, quarantine, storage, isolation, and rehearsals were coherent.

## Required Corrections

1. Replace Revision 6 AC-005’s legacy source-regime wording while preserving its complaint-SLA requirements.
2. Permit exact approved public source identity and attribution only through the post-answer authorized reveal boundary while keeping acquisition infrastructure and restricted evidence isolated.
3. Preserve the exact Revision 6 `Answer accepted` and `Reveal authorized` event fields and resolve source regime only through existing immutable version bindings.
4. Re-run the contradiction and measurement-interface review.

## Citations

- Rejected draft SHA-256: `03ccfb460fc4c9dbf9e900c8e90fde71d56b6952bd49965a8e977f2c71e48d64`
- Programme Revision 6: `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md`
- Consigliere Review 1: `docs/gangsta/codeguessr-content-acquisition/reviews/2026-07-27-consigliere-review-1.md`
