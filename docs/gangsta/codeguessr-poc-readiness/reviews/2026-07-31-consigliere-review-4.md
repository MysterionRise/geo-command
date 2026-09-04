---
heist: codeguessr-poc-readiness
phase: the-sit-down
reviewed-at: 2026-07-31T13:03:00Z
contract-revision: 5
verdict: REJECT
reviewer: Consigliere
---

# Consigliere Review 4

## Verdict

REJECT

## Finding

1. **HIGH — Stack freshness acceptance was mechanically impossible as
   written.** FR-031 and acceptance criterion 12 required exact equality among
   a forty-character Hub repository SHA, the account-holder acknowledged SHA,
   and release label `v2.1.0`. A release label cannot equal a repository SHA.

## Prior-revision closure

The review confirmed that revision 5 closed parent/child provenance binding,
deterministic artifact separation, the substantive Stack pin and update path,
credential and redirect containment, and retry/wait ceilings. Its source split,
selected-blob scope, localhost posture, controlled-Heist isolation, complexity,
citations, and no-code Sit-Down boundary were otherwise accepted.

## Required revision

Define two independent comparisons:

1. Profile immutable revision equals the authenticated current Hub SHA and the
   account-holder acknowledged SHA.
2. Profile release equals the current-card latest release row.

Either comparison's absence or mismatch must reject preparation before metadata
streaming or blob retrieval.
