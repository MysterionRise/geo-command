---
heist: codeguessr-content-acquisition
phase: the-hit
territory: real-rehearsal-prerequisite
status: accepted
timestamp: 2026-07-27T21:47:10+01:00
advanced-wps: [WP-024, WP-025]
completed-wps: []
---

# Offline Acquisition Orchestration Prerequisite Report

## Accepted Outcomes

- The bounded operator path now retrieves and certifies the exact child commit, its single parent, both root-tree SHAs, commit message, author, committer, verification result, public repository identity/metadata hash and repository licence identifier.
- The issued operator run binds the exact repository, commit, approved subtree, purpose and observation time. Those bindings are rechecked before network and after authorization against the actual GitHub response date.
- A commit receipt is an opaque in-process capability registered only after the bounded source acquisition succeeds. A byte-identical JSON clone cannot enter orchestration.
- Traversal verifies the immutable child and parent root trees, resolves only the approved subtree and selects a deterministic same-path candidate.
- Secret, personal-data, generated, binary, ambiguous and otherwise ineligible candidates are screened in memory and are never persisted.
- Provenance excerpts are reconstructed from verified parent and child blobs. Marker classification is derived from the certified commit message/account and the exact authorized marker policy; caller-supplied marker facts are not accepted.
- The repository licence path and blob SHA are derived uniquely from the verified child root tree. The licence blob is hash-verified and treated only as admission screening pending human file-level rights review.
- Accepted parent, child and licence bytes are stored as raw-byte-addressed encrypted snapshots. Normalized and raw hashes remain distinct.
- Every new or reused object receives immediate metadata-only audit continuity. If a newly created object's audit event cannot be appended, the authenticated object is removed and absence is verified before the run fails.
- The composed output is an immutable `DRAFT_REVIEW_REQUIRED` plus a source/policy/operator/tool/schema-bound checkpoint. It has no publish, promote or playable capability.

## TDD and Independent Audit

The initial RED cases established language and recorded-agent draft creation, exact authorization binding, raw-versus-normalized snapshot identity, secret non-persistence and categorical audit output.

Independent audit then returned three material findings:

1. separately supplied tree, marker and repository facts were not certified by the commit receipt;
2. the licence blob was not proven to belong to the authorized revision;
3. snapshot writes occurred before their audit events and were not failure-atomic.

Corrections moved every source fact into the bounded GitHub certification path, derived the licence from the verified child root, and added immediate audit plus authenticated rollback.

A second audit found that a structural receipt lookalike could still be forged. The receipt became a module-certified opaque capability and a RED case proved a byte-identical clone fails before object access.

A third audit found that the source issuer could accept commit/subtree drift from a valid operator run. The operator run now binds both fields, response-date reauthorization preserves them, the audit run records them, and a RED case proves drift fails before network.

The independent inspector's final verdict reports no remaining Critical or Important findings and marks this prerequisite ready to checkpoint.

Final root verification:

- workspace TAP: 1/1 pass;
- Vitest: 58/58 files and 1,912/1,912 tests pass;
- recursive workspace and operator TypeScript typecheck: pass;
- production game build and acquisition containment: 3/3 pass;
- diff hygiene: pass.

## Residual Boundary

This is an accepted implementation prerequisite for WP-024 and WP-025, not completion of either work package.

The production command now returns an opaque `AUTHORIZED_COMMIT_RECEIPT`. It does not yet construct the real GitHub tree/blob loaders, open the external encrypted store and durable audit sink from approved operator-only configuration, persist checkpoints/drafts durably or resume paused runs.

The active project policy and operator registers remain non-effective. No live acquisition, real draft, human review, promotion, rehearsal activation or controlled-beta corpus readiness is claimed.
