---
heist: code-guessing-startup
phase: the-sit-down
review: consigliere-spec-integrity-6
date: 2026-07-11
verdict: REJECT
subject: Contract revision 6, first pass
---

# Consigliere Assessment 6

## Verdict

**REJECT** — Revision 6 materially resolved B-001 through B-012 and B-014, but B-013 and B-015 remained incomplete in the reviewed draft.

## Blocking Findings

1. The Measurement Interface Contract lacked authoritative Survey Offered, Correction Notice Acknowledged, and Critical Defect Changed events required by its own denominators.
2. The Contract deferred scoring point values even though the adopted revalidation finding permitted only gate thresholds and final survey wording to remain release configuration.
3. NFR-019’s rendering clause was subjective and deferred maximum excerpt, load, and sample values instead of specifying a measurable rendering target.
4. The Reveal Authorized event combined correctness with a general authorization outcome, leaving denial-event answer containment ambiguous.

## Required Corrections

- Add the three missing event families and their required facts.
- Freeze point values in the programme charter.
- Define fixed load, maximum excerpt, render readiness, interaction latency, and sample requirements.
- Separate successful reveal authorization from denial auditing; denial events must contain no correctness, answer, evidence, or reveal payload.

