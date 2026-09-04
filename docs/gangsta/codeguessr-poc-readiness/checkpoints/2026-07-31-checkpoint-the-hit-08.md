---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T20:16:31Z
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
pending-wps:
  - WP-022
  - WP-023
  - WP-024
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/github-search.ts
  - ops/poc/prepare/github-lineage.ts
  - ops/poc/prepare/github-admission.ts
  - ops/poc/prepare/provenance-rounds.ts
  - ops/poc/prepare/stack-access.ts
  - ops/poc/prepare/stack-metadata.ts
  - ops/poc/stack/stream_metadata.py
  - ops/poc/stack/fetch_blob.py
  - ops/poc/prepare/stack-revalidation.ts
  - ops/poc/prepare/language-rounds.ts
---

# Resume Context

The complete Source Adapter territory is accepted. The GitHub discovery lane
produces three honest, immutable provenance rounds; the mandatory Stack v2 lane
preflights gated access, streams pinned metadata, retrieves only selected
Software Heritage blobs, revalidates exact bytes/licence/author/path against
public GitHub, and produces exactly one Python and one TypeScript round.

Final independent evidence is 194/194 Source Adapter TypeScript tests, 16/16
locked Stack Python tests, full operator typechecking, and clean diff/hygiene
scans. Language selection is ordinal and locale-independent, requires one crawl
snapshot, deduplicates each configured identity independently, preserves real
code whitespace, avoids short-label spoiler false positives, rejects polyglot
and protected-source leakage, and binds frozen public rounds to private reveals.

WP-022 may now compose the exact three-plus-two artifact. Composition must drive
the run-owned blob meter per candidate: reject and release failed candidates,
continue the pool without batch abort, accept only after exact revalidation, and
stop as soon as the two language fixtures exist. The canonical artifact must
bind all five fixtures to the same crawl snapshot and replay byte-identically.
