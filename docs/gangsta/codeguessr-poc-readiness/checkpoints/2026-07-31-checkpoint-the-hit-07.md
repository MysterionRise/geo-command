---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T17:30:25Z
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
pending-wps:
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
  - ops/poc/prepare/model.ts
  - ops/poc/prepare/request-policy.ts
  - ops/poc/prepare/stack-access.ts
  - ops/poc/prepare/stack-metadata.ts
  - ops/poc/stack/stream_metadata.py
  - ops/poc/stack/fetch_blob.py
---

# Resume Context

Preparation Core is accepted again after the Stack schema and freshness-policy
corrections. The exact current-card request is narrowly allowlisted, the model
uses the provider's honest date fields and raw Software Heritage identities,
and the full Core sweep passes 71/71 tests plus typechecking and hygiene checks.

The Stack lane through selected-blob retrieval is accepted. Gated-access
preflight, pinned metadata streaming, the NDJSON bridge, and the Boto3 content
reader pass 16/16 locked Python tests plus the TypeScript sweep. Retrieval uses
only `softwareheritage/content/<raw-sha1>`, validates both raw SHA-1 and
Git/SWH `sha1_git`, enforces immutable lowerable ceilings and a byte-bounded CLI,
streams gzip data, creates no temporary files, and closes content bodies across
success and failure.

The cumulative run meter remains authoritative for attempted blobs, successful
blobs, total bytes, and releases. Downstream composition must call retrieval per
candidate with the remaining immutable limits, release rejected candidates,
accept only after exact Stack-to-GitHub revalidation, continue past rejected
candidates, and stop immediately when the two language fixtures are complete.
WP-020 is now in Red-Green-Refactor; WP-021 remains dependency-gated.
