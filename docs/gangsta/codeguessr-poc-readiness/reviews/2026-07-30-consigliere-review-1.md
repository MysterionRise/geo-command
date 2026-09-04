---
heist: codeguessr-poc-readiness
phase: the-sit-down
review: consigliere
revision-reviewed: 1
timestamp: 2026-07-30T22:55:19+01:00
verdict: REJECT
---

# Consigliere Review 1: CodeGuessr Local Real-Round PoC Contract

## Assessment

The draft is disciplined about WP-024 through WP-027 receiving no credit,
excluding the rejected production architecture, and containing no code or
pseudocode. Revision 1 is nevertheless rejected until the following
specification-integrity findings are resolved.

## Findings

1. **HIGH — Source, author, and licence validation is not concrete enough.**
   FR-005 requires only non-blank fields. It does not define author, validate a
   full SHA as forty lowercase hexadecimal characters, bind repository,
   commit, blob, and licence identities to the same repository and revision,
   or make internally inconsistent records fail.
2. **HIGH — The experimental class lacks acceptance proof that it cannot
   impersonate approved provenance.** Its exact permitted and prohibited fields
   and its inability to activate controlled gates are not tested.
3. **HIGH — Direct root replacement leaves preservation of synthetic and
   approved-rehearsal semantics ambiguous.** The intentionally changed route
   binding is not distinguished from the catalogue-selection, fallback,
   approval-lineage, and reveal semantics that must remain unchanged.
4. **MEDIUM — Protected reveal shape and attribution timing are ambiguous.**
   Pre-answer attribution must be unconditionally absent, and the existing
   browser reveal boundary permits one attribution string rather than separate
   source, author, and licence fields.
5. **MEDIUM — Several requirements use non-durable shorthand citations or
   sources that do not establish the stated rule.**

## Required Revisions

1. Define exact, mutually consistent source, author, and licence record
   semantics and validation.
2. Require proof that `LOCAL_UNREVIEWED_EXPERIMENT` rejects controlled
   approval, promotion, review, beta, and catalogue markers and cannot activate
   approved gates.
3. State that only root activation changes and enumerate the preserved
   controlled semantics.
4. Define one exact protected browser reveal payload and make pre-answer
   attribution prohibition unconditional.
5. Replace shorthand and unsupported citations with exact durable sources.

## Source Basis

- Contract revision 1:
  `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:1-377`
- Final Grilling consensus:
  `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:32-76`
- Approach A selection:
  `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-sit-down-approach-selection.md:12-20`
- Existing full-SHA definition:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:93-100`
- Existing controlled provenance semantics:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:119-132`
- Existing approved activation boundary:
  `apps/game/src/demo/rehearsal-catalogue.ts:147-189`
- Existing approval and fallback tests:
  `apps/game/test/rehearsal-catalogue.test.ts:245-268`
- Existing route-mount assertion:
  `apps/game/test/rehearsal-catalogue.test.ts:438-458`
- Existing exact browser reveal projection:
  `apps/game/src/components/arcade/arcade-shell.tsx:15-27`;
  `apps/game/src/components/arcade/arcade-shell.tsx:60-82`
