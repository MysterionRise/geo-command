---
heist: H-002-arcade-shell-and-round-state
certificate: programme-revision-7-compatibility
programme-contract: docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md
programme-revision: 7
programme-sha256: 3bb58442f0416042b9820bbe4f1eadae517a3da76edc396aa11129558c1f95b5
child-contract: docs/gangsta/code-guessing-startup/specs/children/h-002-arcade-state.md
child-revision: 1
child-sha256: e8c135578955a65ed44e2bb75d09f1eaaf4c1b6eb3142f89b7632ece54604d98
date: 2026-07-27
status: approved
compatibility-result: COMPATIBLE_UNCHANGED
reviewed-draft-sha256: a178c4e3069118c91b82337ab8ea2d0e2fd13a2c447b6f47386b228b92226509
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

# H-002 Programme Revision 7 Compatibility Certificate

## Assessment

H-002 remains `COMPATIBLE_UNCHANGED`.

1. Programme Revision 7 changes content acquisition, H-001 evidence, and H-003/H-004 mode semantics; it does not change H-002’s session, manifest, clue, answer, reveal-authorization, scoring, correction, accessibility, or performance interfaces.
2. The provenance candidate count remains two and the daily manifest remains three provenance rounds and two language rounds.
3. The Revision 6 `Answer accepted` and `Reveal authorized` event fields remain exact.
4. H-002’s existing authorized reveal boundary already permits approved public evidence and attribution after answer while preventing pre-reveal disclosure.
5. H-002’s “content acquisition” Out-of-Scope statement remains a territory boundary: H-002 does not implement acquisition. It does not prohibit the separately isolated H-001 operator command authorized by Revision 7.
6. H-002 must not import acquisition packages, credentials, storage, policies, raw evidence, or diagnostics. Existing mode interfaces receive only promoted approved catalogue data.

## Required Compatibility Evidence

- Exact programme and child hashes match.
- Existing H-002 lifecycle, reveal, correction, accessibility, performance, and negative-disclosure tests remain passing.
- Dependency and built-artifact audits prove the acquisition capability is absent from H-002.
- One approved language and one approved provenance rehearsal cross the existing H-002 reveal boundary without interface or event-schema changes.

## Result

`COMPATIBLE_UNCHANGED` is valid only for the exact hashes in frontmatter. Any H-002 interface or event-field change, pre-reveal source exposure, acquisition dependency, or failed regression changes the result to `REVISION_REQUIRED`.

## Authorization

This draft does not authorize implementation. The result becomes effective only after signature by the H-002 territory owner and Consigliere.
