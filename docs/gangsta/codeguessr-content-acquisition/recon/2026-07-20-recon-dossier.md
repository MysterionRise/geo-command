---
heist: codeguessr-content-acquisition
date: 2026-07-20
status: approved
approved-at: 2026-07-21T12:53:52+01:00
approval: "Don selected option 1: approve dossier and run The Grilling"
---

# Reconnaissance Dossier: CodeGuessr Content Acquisition

## Objective

Create the smallest trustworthy real-content acquisition pipeline needed before the MVP: an operator-run tool that imports code from explicitly approved sources, pins every item to immutable source identity, creates deterministic review drafts, and feeds—not bypasses—the existing evidence, rights, safety, and publication gates.

The Don asked for a “real content scraper” because the fixed synthetic demo cannot test replayable, credible content. The recommended implementation is deliberately narrower than a general crawler: a GitHub API repository ingester for allowlisted public repositories at full commit SHAs. It is offline from gameplay, produces only quarantined drafts, and cannot publish content.

## Codebase Overview

- The active programme remains in The Hit and explicitly identifies an authentic corpus as an operational blocker (`docs/gangsta/code-guessing-startup/checkpoints/2026-07-13-checkpoint-the-hit.md:1-10`).
- The playable application still hard-codes five synthetic rounds and their hidden answers (`apps/game/src/demo/demo-game.ts:23-142`, `apps/game/src/demo/demo-game.ts:157-197`).
- `@codeguessr/content` already owns strict evidence records, publication eligibility, rights-regime control, language ambiguity review, and corpus readiness (`packages/content/src/index.ts:1-58`).
- Common evidence already records stable identity, exact content hash, excerpt, acquisition method/date, source or creator identity, rights basis, reviewers, attribution, correction state, and publication status (`packages/content/src/evidence/records.ts:11-27`).
- The current evidence union supports only Stack Overflow, recorded model output, and project-owned human samples (`packages/content/src/evidence/records.ts:1-4`). General licensed GitHub content is not currently a valid source class and must not be mislabeled as project-owned human content.
- Publication eligibility requires twelve affirmative checks and four distinct qualified item reviewers (`packages/content/src/review/publication-eligibility.ts:11-24`, `packages/content/src/review/publication-eligibility.ts:69-104`, `packages/content/src/review/publication-eligibility.ts:207-240`). An importer cannot truthfully manufacture these facts.
- Corpus validation already checks excerpt SHA-256 and evidence/version bindings (`packages/content/src/inventory/corpus-readiness.ts:103-142`), but its current authentic-content result is intentionally blocked (`packages/content/src/inventory/corpus-readiness.ts:179-201`).
- Accepted provenance and language server flows already provide downstream certification boundaries (`apps/game/src/modes/provenance/server/provenance-flow.ts:14-103`, `apps/game/src/modes/language/server/language-flow.ts:63-102`, `apps/game/src/modes/language/server/language-flow.ts:395-471`).
- No acquisition adapter, HTTP client, draft lifecycle, content catalogue, durable raw-snapshot store, or acquisition-to-game adapter exists. The current package has no runtime dependency (`packages/content/package.json:9-15`).

## Contract and Authorization State

- Programme Contract Revision 6 and child Contract H-001 are approved (`docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:1-20`, `docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md:1-20`).
- H-001 owns production, review, versioning, approval, quarantine, correction, and withdrawal of content, but explicitly excludes live scraping (`docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md:24-39`, `docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md:52-54`).
- The parent Contract also requires proof that live ingestion/scraping is absent and explicitly excludes live GitHub or Stack Overflow scraping (`docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:283`, `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:361`, `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:370-376`).
- Therefore an actual network acquisition tool is not authorized by the current signed scope. It needs a programme amendment and a small acquisition child Contract or equivalent signed child amendment before implementation.
- An operator-supplied local-file importer could fit the existing manual-acquisition model, but it would not satisfy the Don’s request for a real network content source.

## Existing Test Coverage

- The workspace uses Node 20.18.0, pnpm 9.15.9, Vitest 2.1.8, and Playwright 1.49.1 (`package.json:5-21`).
- Vitest discovers colocated package tests (`vitest.config.mts:3-10`), and `packages/content` typechecks all TypeScript below `src` (`packages/content/tsconfig.json:1-8`).
- Existing content tests cover evidence parsing, reviewer eligibility, source regimes, language ambiguity, and controlled-beta corpus readiness.
- There is no shared HTTP fixture or mock dependency. Native `fetch`, injected as a dependency, is the KISS test seam; unit tests must use deterministic in-memory responses and never call the live network.
- Reconnaissance verification on 2026-07-20 reported 392/392 focused content tests, content typecheck success, and 1622/1622 workspace Vitest tests plus TAP 1/1. These results describe the pre-feature baseline, not scraper acceptance evidence.

## Dependencies and External Constraints

- No new runtime library is required for the first slice: Node provides `fetch`, Web Streams, URL handling, and cryptographic hashing. A small injected transport avoids coupling the domain logic to GitHub.
- GitHub’s repository-content and Git-tree APIs can retrieve public repository files and immutable tree/blob identities. Recursive trees may be truncated, so the importer must reject a truncated response or traverse subtrees explicitly: https://docs.github.com/en/rest/git/trees and https://docs.github.com/en/rest/repos/contents
- GitHub documents 60 unauthenticated requests/hour and 5,000 authenticated requests/hour for typical REST access; it also requires respecting `retry-after` and rate-limit reset responses: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Public visibility is not, by itself, a redistribution license. GitHub documents that repositories need an actual license for use, modification, and distribution, and exposes repository license metadata through the REST API: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository and https://docs.github.com/en/rest/licenses
- GitHub API use remains subject to GitHub’s API terms, including abuse and rate-limit restrictions: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- Stack Overflow content has revision-date-dependent CC BY-SA versions and separate API/attribution obligations. It remains excluded from this Heist: https://stackoverflow.com/help/licensing and https://stackoverflow.com/legal/terms-of-service/public

## Relevant Ledger Entries

### Applicable Insights

- No separate project Insight ledger exists. The signed programme records that no project-specific Constitution, Insights, or Fails existed at reconnaissance (`docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:251-259`).

### Applicable Negative Constraints

- NEVER implement a feature that contradicts the signed Contract (`docs/gangsta/code-guessing-startup/evidence/omerta-1.11.2.md:74-83`).
- NEVER publish content without complete eligibility evidence (`docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:261-266`).
- NEVER expose restricted evidence or unreleased answers in public artifacts, telemetry, or logs (`docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:261-266`).
- NEVER classify arbitrary GitHub code as “human-written” or `project-owned-human`; repository history does not establish either fact (`packages/content/src/evidence/records.ts:1-4`, `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:73`).

## Risks and Unknowns

1. **Rights mismatch — HIGH.** A repository’s public visibility or GitHub-detected license is insufficient evidence that every selected file is covered, free of vendored material, and usable in the planned display. Human rights review remains mandatory.
2. **Provenance category error — HIGH.** Arbitrary open-source code cannot serve as the “project-owned human” side of the active provenance mode. Initially it should feed language rounds only; later it can feed project guessing after that mode is separately authorized.
3. **Secret, PII, unsafe-text, generated, vendor, and minified content — HIGH.** Automated filters reduce review volume but cannot approve safety. All output remains quarantined.
4. **Mutable source identity — HIGH.** Branches and tags can move. Acquisition must require a full commit SHA and record repository, commit, path, blob SHA, raw-content hash, acquisition time, and exact source URL.
5. **License/attribution leakage — HIGH.** The public round cannot omit required attribution merely to avoid revealing the answer. Only sources compatible with the interaction design may progress.
6. **API reliability and abuse — MEDIUM.** Timeouts, redirects, truncation, pagination, rate limits, and transient failures must fail closed and produce resumable operator diagnostics without logging tokens or raw restricted content.
7. **Content quality — MEDIUM.** File extension is only a candidate language signal; generated files, polyglot syntax, embedded DSLs, and ambiguous excerpts require technical review.
8. **Scope creep — MEDIUM.** Repository discovery, HTML crawling, Stack Overflow, AI clue generation, automatic publication, CMS UI, continuous background jobs, and gameplay-time fetching would make the first slice materially larger and riskier.

## Recommended Scope

### Build now after amendment

An offline, operator-run GitHub API importer with this bounded flow:

```text
approved repository + full commit SHA
  -> repository/license metadata
  -> immutable tree and raw blobs
  -> deterministic filtering and excerpt extraction
  -> SHA-256 identity and deduplication
  -> automated rejection reasons
  -> DRAFT_REVIEW_REQUIRED artifact
  -> existing human evidence/review gates
  -> separately approved catalogue
```

Required first-slice behavior:

1. Accept only explicit repository allowlist entries and forty-character hexadecimal commit SHAs.
2. Use only `https://api.github.com`; reject cross-host redirects and never log the optional token.
3. Fetch repository metadata, detected license metadata, the pinned commit tree, and selected raw blobs through an injected transport.
4. Fail closed on missing/unknown license metadata, truncated trees, timeouts, 403/429 rate limits, malformed API data, oversized files, binary bytes, path traversal, symlinks, submodules, unsupported extensions, generated/vendor/minified paths, duplicates, secret-like material, suspicious personal data, or deceptive Unicode controls.
5. Normalize line endings deterministically, retain exact raw-byte hash separately, and create bounded excerpts without executing code.
6. Record repository, commit, blob SHA, path, source URL, acquisition instant, license metadata, raw SHA-256, excerpt SHA-256, detected-language proposal, and every screening decision.
7. Emit immutable `DRAFT_REVIEW_REQUIRED` records only. Do not emit `EvidenceRecord`, `PublicationEligibility`, playable rounds, or claims of authorship/rights approval.
8. Make repeated acquisition of identical input byte-stable apart from a caller-supplied acquisition instant; deduplicate by source identity and hashes.

### Explicitly exclude from the first slice

- Stack Overflow and HTML scraping.
- Repository search or autonomous discovery.
- Private repositories or participant-submitted URLs.
- Branch/tag inputs or default-branch acquisition.
- Background schedules, webhooks, or gameplay-time network access.
- Automatic license conclusions, eligibility, review identities, answers, clues, difficulty, publication, or game wiring.
- Provenance-mode use of arbitrary public GitHub content.
- Algorithm/project modes until their separate mode Contracts are approved.

### Proposed TDD territory

- `packages/content/src/acquisition/github-repository.test.ts`
- `packages/content/src/acquisition/github-repository.ts`
- `packages/content/src/index.ts`
- A later operator CLI in `ops/content/acquire/` only after the pure acquisition contract is accepted.

The first RED should prove that a permitted repository pinned to a full commit SHA produces a deterministic quarantined draft, while mutable refs, unapproved repositories, unknown licenses, unsafe files, API failures, and any attempt to mark the result eligible are rejected.
