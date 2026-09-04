---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T21:48:17Z
next-action: Continue Hit
completed-wps:
  - WP-001
  - WP-002
  - WP-003
  - WP-004
  - WP-005
  - WP-006
  - WP-007
  - WP-008
  - WP-009
  - WP-010
  - WP-011
  - WP-012
  - WP-013
  - WP-014
  - WP-015
  - WP-016
  - WP-017
  - WP-018
  - WP-019
  - WP-020
  - WP-021
  - WP-022
  - WP-023
  - WP-024
pending-wps:
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - apps/game/src/demo/local-real-experiment.server.ts
  - apps/game/test/local-real-experiment.test.ts
---

# Resume Context

WP-024 is accepted. The server-only local experiment factory consumes exactly
one ingestion artifact plus an independently trusted canonical artifact hash.
It revalidates the exact experimental shape, immutable GitHub bindings, Stack
release and revision, source split, snapshot continuity, timestamps, candidate
semantics, public containment, and cross-round uniqueness before deriving the
public five-round mode and private round-ID reveal map from the same lifetime.
There is no synthetic or approved-catalogue fallback.

The reveal authority rejects inexact shape, order, round/version, candidate,
clue-count, reachable-score, and reveal-map failures without returning protected
data. A valid submission preserves existing scoring, result, version, evidence,
explanation, signal, and attribution behavior. Source, author, licence, commit,
URL, correct-answer, evidence, and explanation material remains absent from the
public contract and guessing copy.

The worker recorded a 7/7 missing-authority Red and additional review-driven
Red cases for microsecond timestamps, coherent public spoiler/claim edits, and
hash-trust misuse. Its Inspector found no remaining Critical or Important
issue. The Underboss independently reran the focused acceptance: 25/25 across
the new authority, synthetic demo, and rehearsal suites, plus the game package
typecheck and clean whitespace/forbidden-import scans.

WP-025 must preserve the factory's trust boundary: its trusted artifact hash
must be independently pinned and must not be recomputed from the artifact being
loaded. WP-026 remains in progress and is exercising the complete preparation
path through captured GitHub, Stack, selected-blob, and revalidation responses.
