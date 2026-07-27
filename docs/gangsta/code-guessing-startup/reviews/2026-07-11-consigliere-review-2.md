---
heist: code-guessing-startup
phase: the-sit-down
review: consigliere-spec-integrity-2
date: 2026-07-11
verdict: REJECT
subject: Contract revision 2
---

# Consigliere Assessment 2

## Remaining Findings

1. **HIGH — Late-session versus Day 7 freeze.** Daily credential issuance, expiry, answer/event cutoff, and incomplete-session behavior are not combined into one rule.
2. **HIGH — Withdrawal transition incomplete.** Withdrawal does not normatively revoke credentials, stop optional processing, update consent/analytical inclusion, and trigger deletion.
3. **HIGH — Restricted-evidence retention trigger undefined.** “Final withdrawal” may never occur and does not establish the earliest controlling deadline.
4. **HIGH — Complaint intake lacks deadlines.** A credible rights/privacy/provenance/safety complaint can remain unresolved while content ships.
5. **HIGH — Matrix coverage is formal rather than substantive.** Reveal payload, distinct participant states, coherence measures, forbidden telemetry, version classes, backup coverage, and several out-of-scope negatives lack explicit pass conditions.
6. **HIGH — Post-answer VOID/WITHDRAWN behavior incomplete.** Unanswered participants, completion, scoring, streaks, analytics, reveal, and correction outcomes are undefined.

## Confirmed Closed

- Durable Grilling conclusions and citations.
- Cohort preparation versus Day 8 authorization.
- Credential, endpoint, operator, evidence, attribution, answer-state, availability, and provider-control architecture.
- GeoGuessr-for-code product frame.
- Zero implementation code or pseudocode.

## Required Revisions

Apply the six remaining findings as binding lifecycle, withdrawal, retention, complaint, acceptance, and void-state clauses, then re-review.
