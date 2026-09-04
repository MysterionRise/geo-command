---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T21:58:21Z
next-action: Run combined live smoke
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
  - WP-026
pending-wps:
  - WP-025
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/integration.test.ts
  - ops/poc/prepare/testdata/captured-run.ts
  - ops/poc/prepare/testdata/captured-dependencies.ts
  - ops/poc/prepare/testdata/captured-responses.ts
  - ops/poc/prepare/testdata/captured-values.ts
  - ops/poc/prepare/provenance-rounds.ts
  - ops/poc/prepare/provenance-rounds.test.ts
---

# Resume Context

WP-026 is accepted. The captured harness drives the complete preparation
orchestrator through GitHub search, lineage and admission, Stack access and
metadata, selected blobs, GitHub revalidation, generation, composition,
reporting, and atomic publication without live network access.

Two executions with different times and identifiers emit byte-identical exact
three/two artifacts and distinct redacted reports. Explicit Hugging Face,
GitHub, AWS-provider, and author-email canaries are absent from both artifact
and reports. A rejecting global-fetch sentinel proves no adapter escapes the
captured transport. Malformed, capacity, freshness, credential, redirect,
retry, cleanup, and insufficient-pool cases assert their exact fault boundary
and leave the prior artifact byte-for-byte unchanged.

Captured replay exposed one production defect: normal newline-terminated GitHub
excerpts passed lineage and admission but were rejected by provenance
generation. A byte-exact Red regression reproduced the failure. The accepted
fix adds an excerpt-only nonblank code-text validator; it neither normalizes
bytes nor loosens strict metadata validation. Captured blobs were separately
expanded so public excerpts remain proper subsets and production containment
was not weakened.

The Capo's Inspector accepted the revised package with no findings. Fresh
evidence is 10/10 integration tests, 301/301 preparation tests across 21 files,
27/27 focused audit tests, recursive workspace typechecking, and clean hygiene
checks. No live credentials, network, staging, or commit were used.

There are 25 accepted packages and four pending packages. The live combined
smoke should now run before the root mount so WP-025 can pin the real artifact's
hash independently instead of using a placeholder or circular runtime hash.
