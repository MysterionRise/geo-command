---
heist: codeguessr-content-acquisition
phase: the-hit
territory: github-acquisition-core
status: accepted
timestamp: 2026-07-27T18:35:38+01:00
completed-wps: [WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014]
---

# GitHub Acquisition Core Territory Report

## Accepted Outcomes

- Acquisition requests accept only an approved repository, full lowercase 40-character commit SHA, approved subtree, purpose, and whole-second UTC time.
- GitHub traffic is restricted to immutable API endpoints and bounded by request count, concurrency, aggregate bytes, whole-body timeout, redirect, retry, and rate-limit rules.
- Subtree traversal and checkpoints verify Git tree/blob object identities, reject unsafe entries, and preserve deterministic resume and idempotency state.
- Blob screening normalizes inert source, verifies raw and normalized hashes, and rejects binary, invalid UTF-8, unsafe paths, generated/vendor/minified/lock/documentation content, secrets, PII, and duplicates.
- Changed-line reconstruction is deterministic, same-path, single-parent, bounded, and capped at a 21-line excerpt.
- Agent-marker classification is bound to the canonical attribution policy and captured vendor evidence, including explicit ambiguous-marker and bot-plus-marker rejection.
- License screening accepts only the five approved identifiers with pinned text and hashes and remains explicitly admission-screening-only.
- The immutable `DRAFT_REVIEW_REQUIRED` output contains exact source, policy, operator, time, storage, screening, diff, and provenance bindings and cannot be used as evidence, eligibility, catalogue, manifest, or a playable round.

## TDD Evidence

The request/transport/tree/checkpoint work proceeded through focused RED/GREEN passes. Marker classification and license screening each required negative-branch correction passes. The draft builder required separate semantic, parent/child binding, and 21-line cap RED cases before acceptance.

Final independent verification:

- acquisition territory tests: 101/101 pass across nine files;
- `@codeguessr/content` TypeScript typecheck: pass;
- changed implementation diff hygiene and internal-ID scan: pass;
- all nine production files are at most 268 lines;
- no production function exceeds 50 lines;
- no cross-file duplicated five-line implementation window was found.

## Accepted Variance

`agent-marker.test.ts` is 318 lines, 18 lines above the 300-line target and below the 500-line hard cap. The variance is test-only and was accepted because splitting it would not improve the production boundary.

## Resource Accounting

The original territory estimate was 17,000 tokens. Reported hard-bounded consumption was at most 36,250 tokens. The variance came from rejected or incomplete early passes in changed-line reconstruction, marker classification, license screening, and the draft boundary; every correction pass received an explicit bounded authorization.

## Integration Finding

A package-filtered test invocation produced three false failures because several existing tests resolve project files from the workspace root. The authoritative root invocation isolated 11 real failures to historical provenance test fixtures that overlaid source classes on a model-output record while retaining source-forbidden fields. The production parser is behaving as specified; the fixtures are being corrected without weakening the boundary.

## Remaining Gates

The core is intentionally inert. It cannot durably store source, expose an operator command, promote a draft, or make a playable round until the secure storage, lifecycle/audit, operator, promotion, readiness, and game-adapter work packages are accepted.
