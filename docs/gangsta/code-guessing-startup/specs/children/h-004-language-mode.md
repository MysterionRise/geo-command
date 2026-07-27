---
heist: H-004-language-mode
parent-contract: docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md
parent-revision: 6
parent-sha256: 08ef84a2b475a1d3090ef8037d0f4bdaec719bf6682c59fd754bec978b74927f
upstream-interface-contracts:
  - heist: H-001-content-and-evidence-pipeline
    revision: 1
    path: docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md
    sha256: 0dc3e28e54e92f159140a1d88ed42122590cc33abafca7d3aa11b6ee8ccd7cdd
  - heist: H-002-arcade-shell-and-round-state
    revision: 1
    path: docs/gangsta/code-guessing-startup/specs/children/h-002-arcade-state.md
    sha256: e8c135578955a65ed44e2bb75d09f1eaaf4c1b6eb3142f89b7632ece54604d98
date: 2026-07-12
revision: 1
status: approved
signatories:
  - role: Don
    name: Don
    signed-at: 2026-07-12T21:30:25+01:00
    authorization: "yes"
  - role: Consigliere
    name: Gangsta Consigliere — Child Review 2
    signed-at: 2026-07-12T09:36:35+01:00
  - role: Underboss
    name: Codex Underboss
    signed-at: 2026-07-12T21:30:25+01:00
---

# Child Contract H-004: Language Mode

## Objective

Deliver the programming-language coordinate of the shared code-location game with closed, versioned candidate sets and independently defensible answers.

## Inherited Programme Clauses

Primary clauses: FR-001, FR-005, FR-007, FR-010, FR-014, FR-017, FR-031, the language portion of FR-034, NFR-002, NFR-003, NFR-007, NFR-008, NFR-015, NFR-016, NFR-018, AD-001, AD-002, AD-006, AD-009, DEC-001, AC-002 through AC-006, AC-012, AC-014 through AC-018, and risk R-006.

## Child Requirements

1. Define immutable candidate-set versions containing canonical labels, aliases, ordering policy, correct candidate, presented candidate count, distractor rationales, clues, and calibration.
2. Require two distinct qualified technical reviewers to agree on exactly one defensible answer; any competing defensible language makes the item ineligible.
3. Record deterministic or explicit randomized candidate ordering for the bound session and retain the presented candidate count for chance-aware analysis.
4. Reveal correctness, approved evidence, helpful and misleading signals, and all required versions without implying equality with provenance difficulty.
5. Pass secrets, privacy, inert-rendering, accessibility, ambiguity, and difficulty review before eligibility.
6. Provide measurable keyboard, focus, announcement, screen-reader, non-color, responsive, reduced-motion, clue, answer, reveal, correction, and error evidence for the language flow across the parent support matrix.

## Acceptance Criteria

- Parent AC-002 through AC-006, AC-014, AC-016 through AC-018 pass for language.
- Alias, distractor, ordering, candidate-count, ambiguity-rejection, and every clue-count case are exercised.
- No language item is eligible with unresolved polyglot or competing-answer ambiguity.
- Parent AC-012 passes specifically for the complete language flow and every required browser/assistive-technology combination.

## Dependencies

All H-004 implementation is blocked until the signed H-001 and H-002 contracts match the exact revision, path, and SHA-256 references in frontmatter. H-006 consumes immutable language event and candidate-count contracts.

## Out of Scope

Open-ended language entry, compiler execution, project/country/algorithm inference, and provenance-mode answer semantics.

## Implementation Authorization

The child signatures and upstream interface references are complete. Work-package release remains blocked until Resource Development completes, WP-001 prerequisites pass, and the Don authorizes The Hit.
