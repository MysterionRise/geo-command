---
heist: H-005-enrollment-consent-and-withdrawal
parent-contract: docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md
parent-revision: 6
parent-sha256: 08ef84a2b475a1d3090ef8037d0f4bdaec719bf6682c59fd754bec978b74927f
date: 2026-07-12
revision: 1
status: approved
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-13T09:49:36+01:00
    authorization: "yes"
  - role: Consigliere
    name: Gangsta Consigliere — Child Review 2
    signed-at: 2026-07-12T09:36:35+01:00
  - role: Underboss
    name: Codex Underboss
    signed-at: 2026-07-13T09:49:36+01:00
---

# Child Contract H-005: Enrollment, Consent and Withdrawal

## Objective

Deliver controlled accountless enrollment, adult eligibility, consent, participant lineage, credential lifecycle, withdrawal, deletion, provider inventory, and restore reconciliation without leaking recruitment identity into gameplay telemetry.

## Inherited Programme Clauses

Primary clauses: FR-021 through FR-026, participant-state portions of FR-004, FR-008, FR-009, FR-020, and FR-034, NFR-004 through NFR-006, NFR-008 through NFR-013, NFR-018, AD-004, AD-008, AC-003, AC-007 through AC-009, AC-012, AC-013, AC-015 through AC-018, and risks R-007, R-010, and R-011.

## Child Requirements

1. Keep invitation, consent, eligibility, enrollment, start, activation, completion, return, survey, withdrawal, credential, and analytical-inclusion states distinct.
2. Issue one-time enrollment and daily credentials within the parent expiry, secrecy, lineage, scope, replay, reissue, and cascade-revocation rules.
3. Block invitations until the Don signs the exact cohort and adult eligibility/consent policies.
4. Make the authoritative authenticated accountless withdrawal transition atomic across consent withdrawal, analytical exclusion, credential cascade revocation, rejection of future optional telemetry, processing stop, deletion-case creation, and audit. Track active-store deletion, derived-record deletion/de-linking, provider propagation, and backup ageing as asynchronous case steps with the parent thirty-/thirty-five-day ceilings and legal-hold rules; do not describe those later physical operations as atomic.
5. Maintain a complete provider/store/log/backup/export inventory and prevent restored data from becoming reachable before deletion/revocation reconciliation passes.
6. Exclude recruitment identity, free text, raw code, prompts, IP fingerprints, full user agents, and secrets from telemetry.
7. Provide measurable keyboard, focus, announcement, screen-reader, non-color, responsive, reduced-motion, consent, withdrawal, correction, and error-flow evidence across the parent browser and assistive-technology matrix.

## Acceptance Criteria

- Parent AC-003, AC-007 through AC-009, AC-013, and AC-015 through AC-018 pass for the identity/privacy boundary.
- Expiry, reissue, cascade revocation, withdrawal, deletion deadlines, provider propagation, legal hold, backup ageing, and restore drills pass.
- Negative telemetry and credential-leak audits find none of the forbidden fields or locations.
- Parent AC-012 passes for enrollment, consent, withdrawal, correction notice, deletion-status, and error flows across every required client combination.

## Dependencies

H-002 supplies the participant-session and credential-scoping boundary. H-006 consumes consent, eligibility, inclusion, and withdrawal events only through the frozen measurement contract.

## Out of Scope

Public accounts, passwords, profiles, social identity, referral systems, payments, recruitment analytics, and gameplay-mode semantics.

## Implementation Authorization

The child signatures are complete. Work-package release remains blocked until Resource Development closes and the Don separately authorizes The Hit.
