---
heist: H-006-beta-operations-and-measurement
certificate: programme-revision-7-compatibility
programme-contract: docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md
programme-revision: 7
programme-sha256: 3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5
child-contract: docs/gangsta/code-guessing-startup/specs/children/h-006-beta-operations.md
child-revision: 1
child-sha256: 2b2162f438f710cadc6dcccbad01b0cd0e14e6b31b668e51d4a0db9ea06a04d0
date: 2026-07-27
status: approved
compatibility-result: COMPATIBLE_UNCHANGED
reviewed-draft-sha256: cdb66ad28da441cddb63bd60a7d7dd1bb54b1f682d3958b1181e2ee8bfbb84c5
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-27T16:12:01+01:00
    authorization: "Yes"
  - role: Child Territory Owner
    name: Codex Underboss
    signed-at: 2026-07-27T16:12:01+01:00
  - role: Consigliere
    name: Gangsta Consigliere — First Child Dependency Layer
    signed-at: 2026-07-27T16:12:01+01:00
---

# H-006 Programme Revision 7 Compatibility Certificate

## Assessment

H-006 remains `COMPATIBLE_UNCHANGED`.

1. Programme Revision 7 preserves all Revision 6 event families, event-specific facts, common event fields, scoring, denominators, analytical transitions, formulas, candidate-count handling, and forbidden telemetry fields.
2. `Answer accepted` retains exactly round identifier, immutable candidate identifier, candidate count, clue count, acceptance time, mode, and scoring version as its event-specific facts.
3. `Reveal authorized` retains exactly accepted-answer identifier, reveal time, correctness, evidence/reveal version, and successful authorization outcome as its event-specific facts.
4. Revision 7 provenance prompt, labels, and source regime resolve through existing immutable content, round, candidate-set, rules, and evidence/reveal versions rather than new telemetry fields.
5. H-006 applies the Revision 7 AC-005 and AC-014/OOS-ingestion replacements. The authenticated offline H-001 operator command is the sole acquisition exception; every participant, gameplay, public, background, discovery, private-repository, Stack Overflow, mutable-ref, and general-crawling path remains prohibited.
6. H-001, H-003, and H-004 own new acquisition acceptance evidence. H-006 collects their signed results into the final gate without implementing acquisition runtime behavior.
7. The six-child dependency ledger shall contain the three approved Revision 2 child hashes and the three signed Compatibility Certificate hashes.

## Required Compatibility Evidence

- Exact programme and child hashes match.
- A schema comparison proves no Revision 6 measurement event or field changed.
- Existing H-006 scoring, reporting, Day 7, lifecycle, privacy, accessibility, performance, incident, and negative-capability evidence remains passing.
- The final gate rejects missing acquisition acceptance evidence, child revisions, certificates, rehearsals, or six-child lineage.
- Dependency and runtime audits prove H-006 does not contain or invoke acquisition transport, storage, policy, credential, or operator code.

## Result

`COMPATIBLE_UNCHANGED` is valid only for the exact hashes in frontmatter. Any event, formula, denominator, inclusion, runtime, or telemetry change makes the result `REVISION_REQUIRED`.

## Authorization

This draft does not authorize implementation. The result becomes effective only after signature by the H-006 territory owner and Consigliere.
