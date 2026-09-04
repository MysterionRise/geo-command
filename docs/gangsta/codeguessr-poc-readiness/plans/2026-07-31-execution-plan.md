---
heist: codeguessr-poc-readiness
date: 2026-07-31
status: approved
revision: 5
approved-at: 2026-08-15T13:17:05Z
amended-at: 2026-08-15T13:17:05Z
total-work-packages: 35
territories: 5
estimated-total-budget: 71800
target: localhost-five-real-round-poc
branch: codex/heist/codeguessr-poc-readiness
baseline-commit: fd6f34cd0d8b4a344fb537e87256bc8f8e69837a
---

# Execution Plan: CodeGuessr Local Real-Round PoC

## Outcome

Deliver one locally runnable five-round CodeGuessr experiment prepared by one
operator command:

1. GitHub commit search discovers exactly three provenance rounds.
2. The Stack v2 supplies exactly two language rounds through revision-pinned
   metadata streaming and selected Software Heritage blob reads only.
3. Every selected source is rebound to immutable public GitHub commit, tree,
   path, blob, author, and licence records.
4. One canonical hash-bound artifact drives the existing root arcade, private
   reveal, scoring, completion, and replay flow.
5. The result stays an automatically prepared, unreviewed localhost experiment;
   it earns no controlled-acquisition or beta credit.

## Signed Contract Lineage

| Artifact | Binding |
| --- | --- |
| Contract revision | 11, signed 2026-08-15 |
| Contract SHA-256 | `3acc586d8fb479e6edfd2dd43e9f38ed5d8d6268ee5b025b449d3a564b32fe41` |
| Signed revision-10 baseline | `9f8b4e00694550fad2033fffc981ef8e706dfd040e6f5c3a437aa29d5c7ed5c7` |
| Signed revision-9 baseline | `c1600425ab6f568b392d2e24234fe272666d659d3e3b7cc9b6de6320b18fd685` |
| Stack release | `v2.2.0` |
| Stack Hub revision | `e565caa3a78c2423bd374333a472b049eb090e47` |
| Baseline commit | `fd6f34cd0d8b4a344fb537e87256bc8f8e69837a` |

## Isolation Strategy

- Execute on `codex/heist/codeguessr-poc-readiness`, created from the baseline
  commit above.
- Use one shared branch initially. Worktrees are deferred because the generated
  artifact, root command, package metadata, and game fixture authority form one
  short integration chain.
- Territory ownership is exclusive during The Hit; cross-territory edits require
  Underboss coordination.
- Preserve unrelated user changes. Do not stage, commit, push, or open a pull
  request without a separate authorized exit step.

## Runtime and Dependency Decision

- Keep orchestration, GitHub access, canonical artifact generation, and game
  integration in the pinned Node 20.18.0 and pnpm 9.15.9 toolchain.
- Use an operator-only `uv` 0.9.25 environment with managed Python 3.12 for
  Hugging Face `datasets==5.0.0` and `boto3==1.43.61`.
- Pin all Python transitive dependencies in `ops/poc/stack/uv.lock`.
- The Python worker exposes only bounded metadata rows or selected decompressed
  blob bytes to the Node preparer. It never enters the game package, browser
  bundle, or gameplay-time process graph.
- Hugging Face documents revision-pinned streaming and gated tokens in its
  Datasets API. Software Heritage blob access follows The Stack v2's documented
  S3 path. No Dataset Viewer cache is used as the immutable source authority.
  — Sources:
  `https://huggingface.co/docs/datasets/v5.0.0/en/package_reference/loading_methods`;
  `https://pypi.org/project/datasets/5.0.0/`;
  `https://pypi.org/project/boto3/1.43.61/`;
  `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/e565caa3a78c2423bd374333a472b049eb090e47/README.md#downloading-the-file-contents`

## Territories

### Territory: Tooling and Operator Boundary

**Crew Lead Domain:** Locked preparation runtime, package scripts, and Node-only
operator exposure
**Files:** `package.json`, `pnpm-lock.yaml`, `.gitignore`,
`packages/content/package.json`, `packages/content/src/acquisition/local-poc-support.ts`,
`ops/poc/stack/**`, `ops/poc/prepare/index.ts`
**Work Packages:** WP-001, WP-011, WP-023
**Workers:** 1
**Budget:** 5400 tokens

### Territory: Preparation Core

**Crew Lead Domain:** Profiles, schemas, canonical identity, bounded transport,
retry budgets, diagnostics, capacity, and atomic replacement
**Files:** `ops/poc/profiles/**`, `ops/poc/prepare/profile*`,
`ops/poc/prepare/model*`, `ops/poc/prepare/canonical*`,
`ops/poc/prepare/request-policy*`, `ops/poc/prepare/transport*`,
`ops/poc/prepare/retry*`, `ops/poc/prepare/run-report*`,
`ops/poc/prepare/artifact-store*`, `ops/poc/prepare/capacity*`
**Work Packages:** WP-002 through WP-010, WP-030
**Workers:** 1
**Budget:** 18300 tokens

### Territory: Source Adapters

**Crew Lead Domain:** GitHub search and immutable lineage, Stack access and
selected blobs, cross-source revalidation, and deterministic round generation
**Files:** `ops/poc/prepare/github-*`, `ops/poc/prepare/provenance-rounds*`,
`ops/poc/prepare/stack-*`, `ops/poc/prepare/language-rounds*`,
`ops/poc/stack/**`
**Work Packages:** WP-012 through WP-021, WP-031, WP-035
**Workers:** 2 after WP-005 and WP-011
**Budget:** 28800 tokens

### Territory: Artifact and Game Integration

**Crew Lead Domain:** Five-round composition, server-only fixture authority,
root route, reveal validation, browser play, and containment
**Files:** `ops/poc/prepare/compose*`, `apps/game/src/demo/**`,
`apps/game/src/app/page.tsx`, `apps/game/src/app/actions.ts`,
`apps/game/test/**`, `tests/e2e/arcade-shell.spec.ts`,
`tests/containment/acquisition-boundary.test.mjs`
**Work Packages:** WP-022, WP-024, WP-025, WP-027, WP-033
**Workers:** 1
**Budget:** 10200 tokens

### Territory: Evidence and Acceptance

**Crew Lead Domain:** Captured replay, live combined smoke, committed generated
artifact, documentation, and complete verification
**Files:** `ops/poc/prepare/testdata/**`,
`apps/game/src/demo/generated/local-real-rounds.json`, `README.md`,
`docs/gangsta/codeguessr-poc-readiness/evidence/**`,
`docs/gangsta/codeguessr-poc-readiness/reports/**`
**Work Packages:** WP-026, WP-028, WP-029, WP-032, WP-034
**Workers:** 1
**Budget:** 9100 tokens plus live provider access

## Work Packages

**Prevention Guidance (all Work Packages):** Do not reproduce Gangsta-internal
requirement or work-package identifiers in source code, tests, comments, package
metadata, command output, generated artifacts, or product documentation. These
identifiers belong only in `docs/gangsta/`. Every behavior change follows the
Red-Green-Refactor drill.

### WP-001: Lock the Stack Worker Runtime

**Territory:** Tooling and Operator Boundary
**Contract Clause:** FR-028, FR-029, NFR-002, NFR-012, NFR-013
**Files:** Create `ops/poc/stack/pyproject.toml`,
`ops/poc/stack/.python-version`, `ops/poc/stack/uv.lock`; modify `.gitignore`
**Acceptance Criteria:**

1. `uv` provisions Python 3.12 with exact `datasets==5.0.0` and
   `boto3==1.43.61` locks.
2. The virtual environment, caches, credentials, and temporary data are ignored.
3. Locked offline environment inspection contains no game dependency.

**Verification:** `uv sync --project ops/poc/stack --locked && uv run --project ops/poc/stack python -m unittest discover -s ops/poc/stack`
**Budget:** 1200 tokens
**Dependencies:** None

### WP-002: Freeze the Exact Crawl Profile

**Territory:** Preparation Core
**Contract Clause:** FR-002, FR-020, FR-021, FR-024, FR-025, FR-028, NFR-014
**Files:** Create `ops/poc/profiles/local-real-rounds.v1.json`,
`ops/poc/prepare/profile.ts`, `ops/poc/prepare/profile.test.ts`
**Acceptance Criteria:**

1. The profile fixes GitHub queries, ordering, markers, licence allowlist,
   Python and TypeScript Stack configurations, templates, and every ceiling.
2. The profile path, version, three literal GitHub query identifiers and texts,
   sort, and order match signed Contract revision 10 exactly.
3. Stack release and immutable revision match the signed Contract exactly.
4. Unknown, missing, widened, mutable, URL-valued, or credential-like fields
   reject.

**Verification:** `pnpm exec vitest run ops/poc/prepare/profile.test.ts`
**Budget:** 1800 tokens
**Dependencies:** None

### WP-003: Define Exact Experiment Records

**Territory:** Preparation Core
**Contract Clause:** FR-003, FR-005, FR-007, FR-008, NFR-003, NFR-004
**Files:** Create `ops/poc/prepare/model.ts`,
`ops/poc/prepare/model.test.ts`
**Acceptance Criteria:**

1. Crawl snapshots, provenance fixtures, language fixtures, public rounds,
   private reveals, artifacts, and run reports have exact fail-closed shapes.
2. Controlled approval, review, promotion, beta, catalogue, and provenance
   classifications are rejected.
3. Every nested record is recursively immutable after parsing.

**Verification:** `pnpm exec vitest run ops/poc/prepare/model.test.ts`
**Budget:** 2200 tokens
**Dependencies:** None

### WP-004: Canonicalize and Hash Deterministic Inputs

**Territory:** Preparation Core
**Contract Clause:** FR-026, NFR-003
**Files:** Create `ops/poc/prepare/canonical.ts`,
`ops/poc/prepare/canonical.test.ts`
**Acceptance Criteria:**

1. Profile, provider-response, snapshot, fixture, and artifact identities use
   one canonical serialization and SHA-256 rule.
2. Key order cannot change bytes; semantically different inputs change identity.
3. Run time, execution ID, counters, diagnostics, and retry state never enter
   artifact bytes.

**Verification:** `pnpm exec vitest run ops/poc/prepare/canonical.test.ts`
**Budget:** 1600 tokens
**Dependencies:** WP-003

### WP-005: Enforce Host and Credential Policy

**Territory:** Preparation Core
**Contract Clause:** NFR-011, NFR-012
**Files:** Create `ops/poc/prepare/request-policy.ts`,
`ops/poc/prepare/request-policy.test.ts`
**Acceptance Criteria:**

1. Only exact GitHub API, Hugging Face dataset, and Software Heritage S3 GET or
   HEAD endpoint families pass.
2. GitHub, Hugging Face, and AWS credentials are scoped to their own hosts.
3. Redirect re-requests strip origin authorization, cookies, signing state, and
   signed query parameters before applying target-host policy.

**Verification:** `pnpm exec vitest run ops/poc/prepare/request-policy.test.ts`
**Budget:** 1800 tokens
**Dependencies:** WP-002

### WP-006: Build Bounded Read-Only Transport

**Territory:** Preparation Core
**Contract Clause:** FR-020 through FR-031, NFR-011
**Files:** Create `ops/poc/prepare/transport.ts`,
`ops/poc/prepare/transport.test.ts`
**Acceptance Criteria:**

1. Automatic redirects are disabled and response streams are byte-metered.
2. Timeout, concurrency, request, response, pagination, malformed-body, and
   unsupported-status limits fail closed.
3. Injected fetch tests prove no credential, full URL, source body, or signed
   query reaches errors or diagnostics.

**Verification:** `pnpm exec vitest run ops/poc/prepare/transport.test.ts`
**Budget:** 2500 tokens
**Dependencies:** WP-005

### WP-007: Bound Retry and Wait State

**Territory:** Preparation Core
**Contract Clause:** NFR-011
**Files:** Create `ops/poc/prepare/retry.ts`,
`ops/poc/prepare/retry.test.ts`
**Acceptance Criteria:**

1. One logical request retries at most once and one run retries at most three
   times.
2. One wait is at most fifteen seconds and total wait is at most thirty seconds.
3. Missing, malformed, longer, or exhausted retry signals fail without busy
   looping or mutating the active artifact.

**Verification:** `pnpm exec vitest run ops/poc/prepare/retry.test.ts`
**Budget:** 1200 tokens
**Dependencies:** WP-006

### WP-008: Produce a Separate Redacted Run Report

**Territory:** Preparation Core
**Contract Clause:** FR-027, NFR-005
**Files:** Create `ops/poc/prepare/run-report.ts`,
`ops/poc/prepare/run-report.test.ts`
**Acceptance Criteria:**

1. The report records execution time, bounded counts, waits, outcomes, every
   GitHub query completeness classification, `artifactHash`,
   `crawlSnapshotId`, and five pinned source identities only.
2. Credentials, contact data, email, rows, source excerpts, response bodies,
   URLs with queries, and private reveal values reject or redact.
3. The report cannot be parsed or imported as a gameplay artifact.

**Verification:** `pnpm exec vitest run ops/poc/prepare/run-report.test.ts`
**Budget:** 1600 tokens
**Dependencies:** WP-003, WP-006, WP-007

### WP-009: Replace Artifacts Atomically

**Territory:** Preparation Core
**Contract Clause:** FR-019, FR-026, NFR-003
**Files:** Create `ops/poc/prepare/artifact-store.ts`,
`ops/poc/prepare/artifact-store.test.ts`
**Acceptance Criteria:**

1. Only a fully parsed, hash-verified five-fixture artifact replaces the active
   artifact.
2. Temporary output is same-directory, exclusively created, flushed, renamed,
   and cleaned on every failure path.
3. Failed or insufficient runs leave the previous artifact byte-for-byte
   unchanged.

**Verification:** `pnpm exec vitest run ops/poc/prepare/artifact-store.test.ts`
**Budget:** 1600 tokens
**Dependencies:** WP-003, WP-004

### WP-010: Meter Every Capacity Ceiling

**Territory:** Preparation Core
**Contract Clause:** FR-020, FR-029, NFR-014
**Files:** Create `ops/poc/prepare/capacity.ts`,
`ops/poc/prepare/capacity.test.ts`
**Acceptance Criteria:**

1. Counters cover GitHub pages/results, Stack rows/metadata bytes, blob attempts,
   successful blobs, per-blob bytes, total blob bytes, concurrency, waits, and
   temporary disk.
2. Profile values may lower but never raise signed ceilings.
3. Every exact ceiling and first over-ceiling value is tested.

**Verification:** `pnpm exec vitest run ops/poc/prepare/capacity.test.ts`
**Budget:** 1800 tokens
**Dependencies:** WP-002, WP-006

### WP-011: Expose Only Reusable Low-Level Content Utilities

**Territory:** Tooling and Operator Boundary
**Contract Clause:** Architectural Decision 3, NFR-009, NFR-013
**Files:** Create `packages/content/src/acquisition/local-poc-support.ts`,
`packages/content/src/acquisition/local-poc-support.test.ts`; modify
`packages/content/package.json`
**Acceptance Criteria:**

1. A new Node-only, browser-null export exposes unchanged hashing, tree, blob,
   diff, and licence-screening utilities required by the experiment.
2. It exports no policy register, operator authorization, encrypted storage,
   review, promotion, catalogue, or approval capability.
3. Existing controlled acquisition behavior and tests remain unchanged.

**Verification:** `pnpm exec vitest run packages/content/src/acquisition/local-poc-support.test.ts packages/content/src/acquisition/github/*.test.ts`
**Budget:** 1800 tokens
**Dependencies:** None

### WP-012: Crawl GitHub Commit Search

**Territory:** Source Adapters
**Contract Clause:** FR-020
**Files:** Create `ops/poc/prepare/github-search.ts`,
`ops/poc/prepare/github-search.test.ts`
**Acceptance Criteria:**

1. Exact profile queries, API version, sort, order, pages, and result ceilings
   bind every response.
2. Every page requires a Boolean completeness flag and consistent integer
   total; any `true` page classifies the query as provider-reported incomplete,
   including a mixed page sequence, while all-false pages classify it complete.
3. Only the three Contract-bound literal tuples may contribute an incomplete
   returned set. Malformed, duplicate, changed-tuple, over-ceiling, or off-host
   results still reject.
4. Every accepted raw page, including completeness and total, enters canonical
   response hashing. Output is a stable candidate pool and search ranking is never
   characterized as validation.

**Hit clarification (2026-07-31):** GitHub commit-search responses do not
contain changed-file path or blob identity. This package therefore orders its
discovery pool by configured query index, committer date descending,
repository, and full commit identifier. WP-013 resolves path and blob identity,
then applies the complete profile `ordering.github` sequence before downstream
selection. This preserves FR-020 discovery and FR-022 immutable-ingestion
boundaries; it does not move tree or blob retrieval into search.

**Verification:** `pnpm exec vitest run ops/poc/prepare/github-search.test.ts`
**Budget:** 2600 tokens
**Dependencies:** WP-002, WP-004 through WP-007

### WP-013: Bind Immutable Parent and Child Lineage

**Territory:** Source Adapters
**Contract Clause:** FR-005, FR-022, FR-024
**Files:** Create `ops/poc/prepare/github-lineage.ts`,
`ops/poc/prepare/github-lineage.test.ts`
**Acceptance Criteria:**

1. Exact child and single parent commits bind their recorded trees.
2. Both trees bind the same path to regular parent and child blobs and verified
   raw hashes before diff reconstruction.
3. Root, merge, rename, copy, add, delete, symlink, submodule, truncated tree,
   binary, unchanged, or identity-mismatched cases reject.

**Verification:** `pnpm exec vitest run ops/poc/prepare/github-lineage.test.ts`
**Budget:** 3000 tokens
**Dependencies:** WP-011, WP-012

### WP-014: Admit Public Repository, Licence, and Author Records

**Territory:** Source Adapters
**Contract Clause:** FR-005, FR-006, FR-021
**Files:** Create `ops/poc/prepare/github-admission.ts`,
`ops/poc/prepare/github-admission.test.ts`
**Acceptance Criteria:**

1. Only public, enabled, non-archived, non-fork repositories pass.
2. One allowlisted SPDX identifier and exact pinned licence file, blob, and text
   identity are required.
3. Public commit-author display name and optional login are retained; email is
   discarded; the output makes no rights-review or exclusive-authorship claim.

**Verification:** `pnpm exec vitest run ops/poc/prepare/github-admission.test.ts`
**Budget:** 2200 tokens
**Dependencies:** WP-011, WP-013

### WP-015: Generate Honest Provenance Rounds

**Territory:** Source Adapters
**Contract Clause:** FR-012, FR-024
**Files:** Create `ops/poc/prepare/provenance-rounds.ts`,
`ops/poc/prepare/provenance-rounds.test.ts`
**Acceptance Criteria:**

1. Exactly three stable selections include at least one literal configured
   marker match and at least one non-match.
2. Every excerpt contains deterministically reconstructed changed code.
3. Candidates and copy say only whether the exact commit record contains a
   configured marker and never infer code authorship or generation process.

**Verification:** `pnpm exec vitest run ops/poc/prepare/provenance-rounds.test.ts apps/game/test/claims-audit.test.ts`
**Budget:** 2200 tokens
**Dependencies:** WP-002, WP-013, WP-014

### WP-016: Preflight Stack Access and Freshness

**Territory:** Source Adapters
**Contract Clause:** FR-028, FR-031
**Files:** Create `ops/poc/prepare/stack-access.ts`,
`ops/poc/prepare/stack-access.test.ts`
**Acceptance Criteria:**

1. Gated token access succeeds without persisting account or contact data.
2. Profile revision equals the authenticated revision-addressed metadata
   response SHA and the account-holder acknowledged SHA; profile release
   separately equals the current card's latest release. A moving repository
   head is not immutable source authority.
3. Gate values and every exact required terms marker/field from Contract
   revision 10 match. Any access, terms, acknowledgement, release, or revision
   mismatch rejects before metadata or blob access.

**Verification:** `pnpm exec vitest run ops/poc/prepare/stack-access.test.ts`
**Budget:** 1800 tokens
**Dependencies:** WP-002, WP-005 through WP-007

### WP-017: Stream Revision-Pinned Stack Metadata

**Territory:** Source Adapters
**Contract Clause:** FR-028, NFR-014
**Files:** Create `ops/poc/stack/stream_metadata.py`,
`ops/poc/stack/test_stream_metadata.py`
**Acceptance Criteria:**

1. The worker opens only the two configured language subsets with
   `streaming=True` and the exact immutable revision.
2. It emits only contract-required fields as bounded NDJSON and stops at the
   supplied row limit without materializing a shard.
3. Schema, type, generated/vendor, path, encoding, length, token, and early-stop
   failures return non-sensitive reason codes and clean caches.

**Verification:** `uv run --project ops/poc/stack python -m unittest discover -s ops/poc/stack -p 'test_stream_metadata.py'`
**Budget:** 2400 tokens
**Dependencies:** WP-001, WP-016

### WP-018: Validate and Meter the Stack Worker Bridge

**Territory:** Source Adapters
**Contract Clause:** FR-027 through FR-029, NFR-014
**Files:** Create `ops/poc/prepare/stack-metadata.ts`,
`ops/poc/prepare/stack-metadata.test.ts`
**Acceptance Criteria:**

1. Node spawns only the locked worker, passes non-secret configuration through
   stdin, and supplies credentials only through its scrubbed environment.
2. NDJSON shape, row order, process exit, metadata-byte total, row ceiling,
   stderr redaction, and cleanup are exact.
3. Missing `uv`, wrong lock, wrong Python, malformed output, or worker overrun
   fails before blob retrieval.

**Verification:** `pnpm exec vitest run ops/poc/prepare/stack-metadata.test.ts`
**Budget:** 2200 tokens
**Dependencies:** WP-010, WP-017

### WP-019: Retrieve Only Selected Software Heritage Blobs

**Territory:** Source Adapters
**Contract Clause:** FR-029, NFR-005, NFR-011, NFR-012, NFR-014
**Files:** Create `ops/poc/stack/fetch_blob.py`,
`ops/poc/stack/test_fetch_blob.py`
**Acceptance Criteria:**

1. Boto3 reads only `softwareheritage/content/<blob-id>` from the configured
   bucket endpoint with external AWS credentials.
2. Streaming gzip decompression enforces attempted, successful, per-blob, total
   byte, encoding, identifier, and temporary-disk ceilings.
3. No redirect, signed URL, credential, rejected blob, raw cache, or temporary
   file survives success or failure.

**Verification:** `uv run --project ops/poc/stack python -m unittest discover -s ops/poc/stack -p 'test_fetch_blob.py'`
**Budget:** 2600 tokens
**Dependencies:** WP-001, WP-005, WP-010, WP-018

### WP-020: Revalidate Stack Candidates Against GitHub

**Territory:** Source Adapters
**Contract Clause:** FR-005, FR-021, FR-030
**Files:** Create `ops/poc/prepare/stack-revalidation.ts`,
`ops/poc/prepare/stack-revalidation.test.ts`
**Acceptance Criteria:**

1. Stack repository, revision, path, selected raw bytes, and identities resolve
   to the exact public GitHub record.
2. GitHub raw bytes, licence, commit author, path, revision, and repository must
   all agree; private, missing, redirected, renamed, or mismatched records reject.
3. Only screened excerpts survive; raw selected blobs are discarded.

**Verification:** `pnpm exec vitest run ops/poc/prepare/stack-revalidation.test.ts`
**Budget:** 2600 tokens
**Dependencies:** WP-011, WP-014, WP-019

### WP-021: Generate Two Distinct Language Rounds

**Territory:** Source Adapters
**Contract Clause:** FR-012, FR-025
**Files:** Create `ops/poc/prepare/language-rounds.ts`,
`ops/poc/prepare/language-rounds.test.ts`
**Acceptance Criteria:**

1. Exactly one Python and one TypeScript round are selected from Stack-only
   candidates after GitHub revalidation.
2. Stack language, exact extension mapping, and GitHub record agree.
3. Ambiguous, polyglot, generated, vendor, conflicting, unmapped, untemplated,
   duplicate, source-leaking, or answer-leaking material rejects.

**Verification:** `pnpm exec vitest run ops/poc/prepare/language-rounds.test.ts`
**Budget:** 1800 tokens
**Dependencies:** WP-002, WP-020

### WP-022: Compose the Exact Five-Round Artifact

**Territory:** Artifact and Game Integration
**Contract Clause:** FR-002, FR-007 through FR-009, FR-013, FR-026
**Files:** Create `ops/poc/prepare/compose.ts`,
`ops/poc/prepare/compose.test.ts`
**Acceptance Criteria:**

1. Stable ordering and cross-source deduplication select three provenance then
   two language fixtures with one crawl-snapshot identity.
2. Public and private round identity sets match exactly, and correct answers,
   sources, authors, licences, evidence, and attribution remain private.
3. Canonical artifact bytes and content hash replay identically from the same
   profile and captured provider responses.

**Verification:** `pnpm exec vitest run ops/poc/prepare/compose.test.ts`
**Budget:** 2400 tokens
**Dependencies:** WP-003, WP-004, WP-015, WP-021

### WP-023: Expose One Preparation Command

**Territory:** Tooling and Operator Boundary
**Contract Clause:** FR-019, FR-027, NFR-002, NFR-013
**Files:** Create `ops/poc/prepare/index.ts`,
`ops/poc/prepare/command.test.ts`; modify `package.json`, `pnpm-lock.yaml`,
`ops/tsconfig.json` only if required
**Acceptance Criteria:**

1. One no-argument project-controlled command performs preflight, both crawls,
   screening, selection, report creation, and atomic replacement without
   starting the game.
2. Tokens are accepted only from documented environment or provider-standard
   stores; command arguments and profiles cannot contain secrets or URLs.
3. Any accepted provider-incomplete query emits the visible non-sensitive
   `GITHUB_SEARCH_INCOMPLETE` completion warning and records its exact
   classification in the correlated run report.
4. The command is absent from the game/browser dependency graph and fails
   closed when any stage cannot produce the exact source split.

**Verification:** `pnpm exec vitest run ops/poc/prepare/command.test.ts && pnpm typecheck`
**Budget:** 2400 tokens
**Dependencies:** WP-008 through WP-010, WP-012 through WP-022

### WP-024: Build the Server-Only Fixture Authority

**Territory:** Artifact and Game Integration
**Contract Clause:** FR-003, FR-007 through FR-014, FR-018, NFR-004
**Files:** Create `apps/game/src/demo/local-real-experiment.server.ts`,
`apps/game/test/local-real-experiment.test.ts`
**Acceptance Criteria:**

1. The authority parses one generated artifact, verifies its hash and exact
   source split, and derives public contract and private round-ID reveal map.
2. Mixed, stale, edited, wrong-source, controlled-status, missing, duplicate,
   or extra records prevent play without synthetic fallback.
3. Reveal validation preserves exact order, version, candidate, clue, score,
   attribution timing, and result behavior.

**Verification:** `pnpm exec vitest run apps/game/test/local-real-experiment.test.ts apps/game/test/demo-game.test.ts apps/game/test/rehearsal-catalogue.test.ts`
**Budget:** 2800 tokens
**Dependencies:** WP-022

### WP-025: Mount the Experiment on the Root Route

**Territory:** Artifact and Game Integration
**Contract Clause:** FR-001, FR-004, FR-011, FR-014, FR-015, NFR-001, NFR-006
**Files:** Modify `apps/game/src/app/page.tsx`,
`apps/game/src/app/actions.ts`; create or modify focused game tests as required
**Acceptance Criteria:**

1. `/` renders the generated five-round experiment directly through the
   existing arcade and uses only its server-authorized reveal.
2. The permanent notice says GitHub Search and Stack v2, automatically crawled
   and ingested, unreviewed, localhost PoC, and not approved beta content.
3. Existing keyboard, reduced-motion, minimum viewport, error, and no-JavaScript
   behavior remains intact.

**Verification:** `pnpm exec vitest run apps/game/test/local-real-experiment.test.ts apps/game/test/arcade-shell.test.tsx apps/game/test/claims-audit.test.ts`
**Budget:** 1600 tokens
**Dependencies:** WP-024, WP-028

### WP-026: Prove Captured Two-Source Replay

**Territory:** Evidence and Acceptance
**Contract Clause:** NFR-010, NFR-013; Acceptance Criteria 2 through 12
**Files:** Create `ops/poc/prepare/testdata/**`,
`ops/poc/prepare/integration.test.ts`
**Acceptance Criteria:**

1. Small captured GitHub, Stack metadata, S3 blob, and GitHub revalidation
   responses exercise the complete command without live network access.
2. Two runs at different times emit byte-identical artifacts and different
   redacted run reports.
3. Captured complete, incomplete, and mixed-page responses prove exact
   query-level classification, warning propagation, response hashing, and
   rejection of any unbound query tuple.
4. Every malformed, capacity, freshness, credential, redirect, retry, cleanup,
   and insufficient-pool path leaves the last artifact unchanged.

**Verification:** `pnpm exec vitest run ops/poc/prepare/integration.test.ts`
**Budget:** 2500 tokens
**Dependencies:** WP-023

### WP-027: Prove Browser and Build Containment

**Territory:** Artifact and Game Integration
**Contract Clause:** FR-009 through FR-011, FR-014, FR-015, FR-017, FR-018,
NFR-001, NFR-013; Acceptance Criteria 14 through 24
**Files:** Modify `tests/containment/acquisition-boundary.test.mjs`,
`tests/e2e/arcade-shell.spec.ts`; modify focused accessibility tests only if the
notice changes observable copy
**Acceptance Criteria:**

1. Browser static files and pre-answer data contain no correct answer, evidence,
   repository, author, licence, attribution, commit, pinned URL, transport, or
   credential capability.
2. All five real rounds complete; attribution appears only after each valid
   answer; completion and replay remain exact.
3. Synthetic and approved-rehearsal tests remain valid while `/` intentionally
   changes to the experiment.

**Verification:** `pnpm exec node --test tests/containment/acquisition-boundary.test.mjs && pnpm test:e2e && pnpm --filter @codeguessr/game build`
**Budget:** 2200 tokens
**Dependencies:** WP-025, WP-026

### WP-028: Run the Combined Live Smoke

**Territory:** Evidence and Acceptance
**Contract Clause:** NFR-010; Acceptance Criterion 13
**Files:** Generate `apps/game/src/demo/generated/local-real-rounds.json` and
create `docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-14-combined-live-smoke.md`
**Acceptance Criteria:**

1. Real GitHub search, gated Stack streaming, selected S3 blobs, and GitHub
   revalidation generate the exact three/two artifact with no manual fixture
   substitution or human approval.
2. Observed rows, metadata bytes, blob attempts, blob bytes, temporary disk,
   retries, waits, rejection counts, and cleanup stay within every ceiling.
3. Evidence records only non-sensitive command outcomes, artifact/source
   identities, exact Stack pin, and acknowledged limitations. Immutable dated
   evidence binds all query completeness classifications and any
   `GITHUB_SEARCH_INCOMPLETE` warning to the successful `artifactHash` and
   `crawlSnapshotId`; it makes no complete-population claim.

**Verification:** `pnpm prepare:poc` followed by the offline artifact verifier and `git diff --check`
**Budget:** 1800 tokens plus user-provided gated credentials
**Dependencies:** WP-026; Hugging Face access, acknowledged revision, Software
Heritage AWS credentials, and optional GitHub token

### WP-029: Document and Sweep the Runnable PoC

**Territory:** Evidence and Acceptance
**Contract Clause:** FR-016, NFR-001, NFR-007 through NFR-010; Acceptance
Criteria 23 through 26
**Files:** Modify `README.md`; create
`docs/gangsta/codeguessr-poc-readiness/reports/2026-07-31-local-real-poc.md` and
final verification evidence
**Acceptance Criteria:**

1. README gives exact preparation and localhost play commands, access preflight,
   selected-blob ceilings, optional GitHub token, limitations, and truthful
   unreviewed/non-beta status, including the meaning of the bounded
   `GITHUB_SEARCH_INCOMPLETE` warning.
2. The report records fresh unit, type, accessibility, performance, browser,
   containment, build, dependency, artifact, and credential-inspection evidence.
3. Controlled acquisition WP-024 through WP-027 remain visibly incomplete and
   receive no credit from this experiment.

**Verification:** `pnpm test && pnpm typecheck && pnpm test:a11y && pnpm test:performance && pnpm test:e2e && pnpm exec node --test tests/containment/acquisition-boundary.test.mjs && pnpm --filter @codeguessr/game build`
**Budget:** 2000 tokens
**Dependencies:** WP-027, WP-028

### WP-030: Migrate Preparation Authority to the Signed Stack Pin

**Territory:** Preparation Core
**Contract Clause:** FR-026, FR-028, FR-031, NFR-009
**Files:** Modify `ops/poc/profiles/local-real-rounds.v1.json`,
`ops/poc/prepare/profile*`, `ops/poc/prepare/model*`,
`ops/poc/prepare/model-run*`, `ops/poc/prepare/artifact-store*`,
`ops/poc/prepare/compose*`, and `ops/poc/prepare/run-report*`
**Acceptance Criteria:**

1. A focused failing test proves every preparation authority still expects the
   removed Stack SHA before production values change.
2. The exact signed revision-10 SHA replaces the removed SHA in the profile,
   shared records, validators, deterministic inputs, and focused expectations.
3. Release `v2.2.0`, all ceilings, the exact three/two composition, GitHub
   completeness behavior, and artifact determinism remain unchanged.

**Verification:** `pnpm exec vitest run ops/poc/prepare/profile.test.ts ops/poc/prepare/model.test.ts ops/poc/prepare/model-run.test.ts ops/poc/prepare/artifact-store.test.ts ops/poc/prepare/compose.test.ts ops/poc/prepare/run-report.test.ts`
**Budget:** 2200 tokens
**Dependencies:** None

### WP-031: Migrate Stack Adapters and the Selected-Blob Worker

**Territory:** Source Adapters
**Contract Clause:** FR-028 through FR-031, NFR-009, NFR-014
**Files:** Modify `ops/poc/prepare/stack-access*`,
`ops/poc/prepare/stack-metadata*`, `ops/poc/prepare/stack-revalidation*`,
`ops/poc/stack/stream_metadata.py`, and `ops/poc/stack/test_stream_metadata.py`
**Acceptance Criteria:**

1. Focused tests fail first on the removed revision and pass only with the
   signed revision-10 SHA.
2. Authenticated preflight, exact-revision streaming, acknowledgement matching,
   and GitHub revalidation all bind the same new SHA.
3. No moving-ref fallback, full-corpus download, terms bypass, credential
   persistence, capacity change, or round-content review is introduced.

**Verification:** `pnpm exec vitest run ops/poc/prepare/stack-access.test.ts ops/poc/prepare/stack-metadata.test.ts ops/poc/prepare/stack-revalidation.test.ts && uv run --project ops/poc/stack python -m unittest discover -s ops/poc/stack -p 'test_stream_metadata.py'`
**Budget:** 2400 tokens
**Dependencies:** WP-030

### WP-032: Rebind Captured Two-Source Replay

**Territory:** Evidence and Acceptance
**Contract Clause:** NFR-010, NFR-013; Acceptance Criteria 2 through 13
**Files:** Modify `ops/poc/prepare/testdata/**`,
`ops/poc/prepare/language-rounds.test.ts`, focused command fixtures, and
`ops/poc/prepare/integration.test.ts`
**Acceptance Criteria:**

1. Captured dependencies, provider responses, and expected artifacts bind only
   the signed revision-10 SHA.
2. Complete, provider-incomplete, and mixed-page GitHub replays remain exact;
   two executions still produce byte-identical artifacts and distinct reports.
3. The full captured preparation suite has no network access and contains no
   credential, private contact value, or stale operative pin.

**Verification:** `pnpm exec vitest run ops/poc/prepare`
**Budget:** 1600 tokens
**Dependencies:** WP-030, WP-031

### WP-033: Rebind the Server-Only Fixture Authority

**Territory:** Artifact and Game Integration
**Contract Clause:** FR-007 through FR-011, FR-018, NFR-004, NFR-009
**Files:** Modify `apps/game/src/demo/local-real-experiment-domain.server.ts`
and `apps/game/test/local-real-experiment.test.ts`
**Acceptance Criteria:**

1. A focused failing test proves the server authority rejects the new pin before
   its signed expectation changes.
2. The authority accepts only the revision-10 pin and continues to reject stale,
   edited, mixed-source, controlled-status, or answer-leaking artifacts.
3. Public/private identity continuity, reveal timing, score validation, and
   network-free gameplay remain unchanged.

**Verification:** `pnpm exec vitest run apps/game/test/local-real-experiment.test.ts`
**Budget:** 1200 tokens
**Dependencies:** WP-030

### WP-034: Produce the Revision-11 Live Artifact and Evidence

**Territory:** Evidence and Acceptance
**Contract Clause:** FR-016, FR-019, FR-031, NFR-010; Acceptance Criterion 13
**Files:** Generate `apps/game/src/demo/generated/local-real-rounds.json` and
the redacted run report; create dated live evidence
**Acceptance Criteria:**

1. The account-holder acknowledgement and every live Stack authority equal the
   signed Stack SHA carried by revision 11 while the release remains `v2.2.0`.
2. One combined GitHub Search, Stack metadata, selected-blob, and GitHub
   revalidation run atomically publishes exactly three provenance and two
   language rounds without human review or manual substitution.
3. Dated evidence binds the artifact hash, crawl snapshot, query completeness
   classifications, warning if any, bounded counts, and cleanup without
   retaining sensitive material or claiming complete-population coverage.

**Verification:** `STACK_V2_ACKNOWLEDGED_USABLE_REVISION=e565caa3a78c2423bd374333a472b049eb090e47 pnpm prepare:poc` followed by offline verification and `git diff --check`
**Budget:** 1200 tokens plus live provider access
**Dependencies:** WP-032, WP-033, WP-035

### WP-035: Normalize Exact GitHub Committer Timestamps

**Territory:** Source Adapters
**Contract Clause:** FR-020, NFR-009; Acceptance Criterion 2
**Files:** Modify `ops/poc/prepare/github-search.ts`,
`ops/poc/prepare/github-search.test.ts`, and
`ops/poc/prepare/github-search-completeness.test.ts`; modify captured GitHub
response fixtures only if a focused test requires an exact provider lexeme
**Acceptance Criteria:**

1. Tests fail first while the adapter still rejects a valid signed numeric-
   offset timestamp and prove all four exact lexical forms plus every calendar,
   clock, precision, offset, negative-zero, leap-second, finite-instant, and
   normalized-year boundary from revision 11.
2. Accepted numeric-offset values normalize to the exact UTC millisecond `Z`
   form for candidate records and primary ordering; equivalent instants
   converge and existing stable tie-breakers remain unchanged.
3. Raw provider lexemes remain in canonical provider-response hashing: two
   accepted lexemes for the same instant normalize to equal candidate times but
   produce distinct raw-response hashes and crawl-snapshot identities.
4. Queries, page/result ceilings, incomplete-response classification, warning
   behavior, admission rules, source identity, Stack behavior, round
   composition, and atomic publication remain unchanged; malformed or
   unenumerated timestamp shapes still fail closed.

**Verification:** `pnpm exec vitest run ops/poc/prepare/github-search.test.ts ops/poc/prepare/github-search-completeness.test.ts ops/poc/prepare/integration.test.ts && pnpm exec vitest run ops/poc/prepare && pnpm exec tsc --noEmit -p ops/tsconfig.json`
**Budget:** 3000 tokens
**Dependencies:** WP-032, WP-033

## Execution Order

1. **Foundation:** WP-001 through WP-005 can begin; WP-003 precedes WP-004 and
   WP-002 precedes WP-005.
2. **Core safety:** WP-006 → WP-007; WP-008, WP-009, and WP-010 then proceed.
3. **Parallel source lanes:** after WP-011, GitHub runs WP-012 → WP-013 → WP-014
   → WP-015 while Stack runs WP-016 → WP-017 → WP-018 → WP-019. WP-020 joins
   GitHub admission with the Stack blob, then WP-021 completes language rounds.
4. **Artifact authority:** WP-022 → WP-023 → WP-024.
5. **Revision-10 pin migration:** WP-030 → WP-031; WP-033 follows WP-030;
   WP-032 follows WP-030 and WP-031.
6. **Offline acceptance:** WP-026 remains accepted and WP-032 rebinds its
   captured evidence to revision 10.
7. **Live artifact:** WP-028 is resumed by WP-034 and requires the user's
   existing gated access and
   credentials but no human content review. It must produce and independently
   hash the artifact before gameplay imports it.
8. **Revision-11 GitHub date boundary:** WP-035 uses mandatory TDD to implement
   the signed lexical grammar, normalized ordering authority, and raw-response
   hash distinction. WP-034 cannot resume before WP-035 is independently
   accepted.
9. **Mounted acceptance:** WP-025 consumes the WP-034 artifact through WP-024's
   server-only authority, then WP-027 proves browser, build, and containment.
10. **Final sweep:** WP-029.

## Baseline Verification

- **Branch:** PASS — `codex/heist/codeguessr-poc-readiness` at
  `fd6f34cd0d8b4a344fb537e87256bc8f8e69837a`.
- **Workspace/unit:** PASS — workspace TAP 1/1 and Vitest 1,935/1,935.
- **TypeScript:** PASS — all five workspace projects and operator configuration.
- **Accessibility:** PASS — 37/37.
- **Performance:** PASS — 6/6.
- **Containment:** PASS — 3/3 with a production build.
- **Playwright:** PASS — 13/13 against the local Next server.
- **Production build:** PASS — root and not-found routes emitted successfully.
- **Node/pnpm:** PASS — Node 20.18.0 and pnpm 9.15.9 match project pins.
- **Stack bootstrap:** READY — `uv` 0.9.25 is installed. System Python 3.9.10
  is intentionally not used; WP-001 provisions the locked managed Python 3.12
  environment.
- **Observed prerequisite corrections:** The new README initially tripped the
  conservative claims audit through a negated detector phrase; the existing
  failing test was used as the red case, safe literal-evidence copy made it
  green at 20/20, and the full 1,935-test sweep passed. A parallel typecheck
  started before `.next/types` existed; sequential ordering after the build-
  producing containment step passed without source changes. The sandboxed
  Playwright attempt could not bind localhost; the authorized local-server run
  passed all thirteen scenarios.
- **Revision-10 amendment baseline:** PASS — preparation plus server-authority
  tests pass 335/335 before the pin migration, and recursive workspace plus ops
  TypeScript checks pass. The prior live failure published no artifact or run
  report, so no generated output must be deleted before the retry.
- **Revision-11 amendment baseline:** PASS — the exact signed bytes hash to
  `3acc586d8fb479e6edfd2dd43e9f38ed5d8d6268ee5b025b449d3a564b32fe41`;
  the last full preparation sweep passed 323/323 with a clean ops typecheck,
  and the blocked live attempt left no artifact, report, or temporary output.

## Approval Gate

The Don's 2026-08-15 signature of Contract revision 11 and standing instruction
to continue The Hit approve this bounded plan amendment. Approval authorizes
implementation only within the signed Contract, these file
territories, and the work-package dependencies above. It does not authorize
public deployment, bulk Stack downloads, controlled-content promotion, or
staging/committing/pushing changes.
