---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T16:28:56Z
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
pending-wps:
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
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/github-search.ts
  - ops/poc/prepare/github-search.test.ts
  - ops/poc/stack/stream_metadata.py
  - ops/poc/stack/test_stream_metadata.py
  - ops/poc/prepare/stack-access.ts
  - ops/poc/prepare/stack-access.test.ts
  - ops/poc/prepare/stack-metadata.ts
  - ops/poc/prepare/stack-metadata.test.ts
---

# Resume Context

WP-001 is closed after its exact locked `uv run` unittest-discovery command
passed all six currently installed Stack worker tests. WP-012 is accepted after
its first implementation was rejected and its corrected nine-test suite proved
all queries/pages, exact requests and response shapes, neutral deterministic
ordering, malformed/incomplete/duplicate/ceiling/off-host rejection, immutable
identities, canonical response hashes, and strict TypeScript integrity.

The first Stack implementations for WP-016 through WP-018 remain rejected
despite passing their local suites. The access module trusted caller-normalized
authority callbacks instead of constructing and parsing the exact bounded Hugging
Face requests. The metadata worker treated its minimal NDJSON projection as the
provider's input schema, so official Stack v2 rows would be rejected. A fresh
worker is correcting those boundaries before WP-019 selected-blob work.

The immutable GitHub lineage/admission/provenance lane and the corrected Stack
lane are running concurrently. No credit has been assigned to rejected Stack
packages.
