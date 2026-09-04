---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T20:37:01Z
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
pending-wps:
  - WP-023
  - WP-024
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/compose.ts
  - ops/poc/prepare/compose.test.ts
---

# Resume Context

WP-022 is accepted. Composition requires exactly three accepted GitHub
provenance fixtures followed by exactly two accepted Stack language fixtures,
binds all five to one profile and crawl snapshot, rejects each independent
cross-source deduplication collision, and validates fixture/public/private
projection continuity before constructing the artifact.

The artifact and round record set pass their strict parsers. Public data excludes
source, author, licence, correct-answer, evidence, explanation, and attribution
material. Raw excerpt SHA-256 is recomputed during composition, closing a tested
coordinated fixture/public drift path. Canonical bytes and content hash replay
identically from the same profile and captured response hashes.

Fresh acceptance evidence is 4/4 focused composition tests, 270/270 preparation
tests, 2,208/2,208 workspace tests, recursive typechecking, and clean debt and
hygiene scans. WP-023 is now in the Tooling Boundary territory. It must expose
one no-argument preparation command, preserve the cumulative per-candidate blob
meter lifecycle, publish atomically, and remain absent from the game/browser
dependency graph.
