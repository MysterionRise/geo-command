---
heist: H-002-arcade-shell-and-round-state
parent-contract: docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md
parent-revision: 6
parent-sha256: 08ef84a2b475a1d3090ef8037d0f4bdaec719bf6682c59fd754bec978b74927f
date: 2026-07-12
revision: 1
status: approved
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-12T20:50:06+01:00
    authorization: "Yes"
  - role: Consigliere
    name: Gangsta Consigliere — Child Review 2
    signed-at: 2026-07-12T09:36:35+01:00
  - role: Underboss
    name: Codex Underboss
    signed-at: 2026-07-12T20:50:06+01:00
---

# Child Contract H-002: Arcade Shell and Round State Machine

## Objective

Deliver the shared “GeoGuessr for code” five-round browser shell and authoritative lifecycle on which provenance and language operate, including manifest lineages, progressive clues, immutable answers, scoped reveals, corrections, entertainment results, accessibility, and measurable performance.

## Inherited Programme Clauses

Primary clauses: FR-001 through FR-005, FR-008 through FR-011, FR-013, FR-020, FR-032, NFR-001 through NFR-008, NFR-014 through NFR-019, AD-001, AD-003, AD-004, AD-007, DEC-003, DEC-004, AC-001 through AC-003, AC-006, AC-011 through AC-013, AC-016, AC-017, and AC-019. All applicable negative-scope and security clauses remain inherited.

## Child Requirements

1. Implement one immutable manifest lineage per active beta day, one current issuance version, permanent participant-session binding, and correction-only version promotion.
2. Keep session, interaction, correction, clue, and answer state orthogonal; correction uses ACTIVE, VOID, and CONTENT_WITHDRAWN while participant session withdrawal remains distinct.
3. Accept one answer only in the permitted state conjunction and authorize reveal only for the same lineage, beta day, manifest version, round, and immutable accepted answer.
4. Keep future/correct answers and restricted evidence out of public artifacts; reveal denial contains no correctness, answer, evidence, or reveal payload.
5. Support base excerpt, at most two ordered clues, fixed 1,000/200/300 scoring, correction-adjusted maximums, UTC streak calculation, and spoiler-free shares.
6. Meet the complete keyboard, screen-reader, responsive, browser, viewport, reduced-motion, availability, render, latency, load, sample, and idempotency requirements.

## Acceptance Criteria

- Parent AC-001 through AC-003, AC-006, AC-011 through AC-013, AC-016, AC-017, and AC-019 pass with fresh evidence.
- All permitted and prohibited state conjunctions, grace/expiry cases, correction branches, cross-scope reveal attempts, and replay/idempotency cases are exercised.
- The shell can host provenance and language through isolated mode contracts without changing shared lifecycle semantics.

## Dependencies

Entry dependency: approved programme Contract Revision 6. Content and reveal payload interfaces are coordinated with H-001. H-003, H-004, H-005, and H-006 depend on signed H-002 boundaries.

## Out of Scope

Mode-specific truth/calibration, content acquisition, recruitment policy, beta continuation decisions, public social features, and future modes.

## Implementation Authorization

The child signatures are complete. Work-package release remains blocked until Resource Development completes, WP-001 prerequisites pass, and the Don authorizes The Hit.
