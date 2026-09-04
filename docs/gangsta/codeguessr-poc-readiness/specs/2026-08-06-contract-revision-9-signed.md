---
heist: codeguessr-poc-readiness
date: 2026-07-30
status: signed
revision: 9
approach: "Direct Root Demo with GitHub Search and Mandatory Selected-Blob Stack v2 Ingestion"
signatories: [Don, Consigliere, Underboss]
review-status: approved
consigliere-verdict: APPROVE
reviewed-at: 2026-08-06T14:08:11Z
revision-9-approved-at: 2026-08-06T14:08:11Z
revision-8-approved-at: 2026-08-01T12:25:28Z
amendment-authorized-at: 2026-08-06T10:31:06Z
revised-at: 2026-08-06T10:31:06Z
---

# Contract: CodeGuessr Local Real-Round PoC

## Objective

Build a fun, locally runnable CodeGuessr proof of concept with one local crawler
and ingestion command that must combine two real source paths: GitHub commit
search for exactly three provenance rounds and streamed The Stack v2 metadata
plus selected Software Heritage blob retrieval for exactly two programming-
language rounds. Every Stack selection is revalidated against its pinned public
GitHub repository and revision. The command freezes all five excerpts and feeds
them through the existing arcade, clue, scoring, reveal, completion, and replay
experience. Crawling and ingestion occur before play; rounds use only the
frozen local artifact. The result is explicitly a project-controlled,
automatically prepared, unreviewed local experiment: it is not approved
content, not a controlled-beta corpus, not publication-ready, and not evidence
that the existing controlled content-acquisition work packages are complete. —
Sources:
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:13-28`;
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:11-24`;
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:11-28`;
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:11-29`;
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-08-01-checkpoint-the-sit-down-stack-v2-2-change.md:11-21`

## Definitions

- **Local unreviewed experiment:** the content class used only by this PoC. It
  carries no approval, promotion, publication, beta, or authenticated-source
  meaning.
- **Crawl profile:** a project-controlled, versioned preparation input that
  fixes the GitHub commit-search queries, including the exact public open-source
  organization and historical date scopes authorized by revision 9; The Stack
  v2 release `v2.2.0` at
  immutable Hugging Face repository revision
  `73b0f1021c37437752281cf0736003f0c987ccc1`; the two Stack language
  configurations; GitHub result ordering and page ceilings; Stack metadata-row
  and selected-blob ceilings; allowed SPDX identifiers; supported languages and
  file extensions; configured provenance markers; screening limits; and
  selection rules for one run.
- **Crawl run:** one manually invoked preparation execution against public
  GitHub and Stack v2 data. Its separate redacted run report records a random
  execution identifier, observation time, crawl-profile version, GitHub API
  version, Stack release and immutable revision, exact queries and dataset
  configurations, response completeness, metadata rows inspected, blobs
  retrieved, bytes received, retry and wait totals, and bounded outcome counts
  without storing a credential. The run report is neither embedded in nor
  hashed into the ingestion artifact and is never consumed by gameplay.
- **Ingestion artifact:** the recursively immutable, server-only local output
  of one successful crawl run. Its canonical bytes contain a deterministic
  crawl-snapshot identifier derived from the exact crawl-profile bytes and the
  canonical hashes of every accepted provider response, exactly three GitHub-
  search provenance fixtures, and exactly two Stack-discovered language
  fixtures. It excludes execution identifiers, local observation times,
  diagnostics, counters, retry state, and every other run-specific field, and
  is the only crawler output accepted by gameplay.
- **Stack v2 metadata record:** one gated dataset row containing the Software
  Heritage blob, content, directory, snapshot, and revision identities, path,
  repository name, detected licences, language, generated/vendor flags, byte
  length, and crawl dates required to decide whether its blob may be retrieved.
- **Selected Stack blob:** the content of one Stack v2 metadata record fetched
  from the authorized Software Heritage content store only after metadata-only
  screening and within the run's blob and byte ceilings.
- **Real fixture:** an automatically selected excerpt ingested from a public
  GitHub repository and bound to one internally consistent source record.
- **Recorded author:** the public commit-author display name and, when present,
  public GitHub login recorded on the exact selected commit. Email addresses
  are discarded. This record does not claim exclusive authorship.
- **Licence record:** the crawler-recorded SPDX identifier and licence name
  bound to the repository's licence file at the same pinned commit. It is an
  automated admission signal and attribution record, not a rights-review
  decision.
- **Public round:** the pre-answer data needed to render one playable round:
  excerpt, prompt, all playable candidates without a correct-answer
  designation, clues, and immutable version identifiers.
- **Private fixture record:** the server-only correct-answer designation,
  evidence, explanation, source record, formatted attribution, and reveal
  versions.
- **Authorized browser reveal:** the existing exact reveal projection released
  only after a valid submission. Repository, author, licence, and pinned-source
  text enter this projection only inside its single attribution string.
- **Controlled acquisition system:** the existing acquisition, review,
  promotion, approved-catalogue, and controlled-beta contracts and
  implementation. This Contract does not amend that system.

## Requirements

### Functional Requirements

1. **FR-001 — Direct local experience.** The root application route shall run
   the local unreviewed experiment directly through the existing arcade shell.
   — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-sit-down-approach-selection.md:12-20`;
   `apps/game/src/app/page.tsx:1-13`
2. **FR-002 — Exact session composition.** The experiment shall contain exactly
   five crawler-generated real fixtures in fixed order: three provenance rounds
   discovered through GitHub commit search followed by two language rounds
   discovered through The Stack v2. No synthetic, wrong-source, or manually
   substituted round may enter this session. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:19-28`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:20-28`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:16-24`
3. **FR-003 — Experimental status.** The active content class shall be named
   `LOCAL_UNREVIEWED_EXPERIMENT`. Its accepted shape shall reject every
   approval identifier, approval decision, promotion identifier, review
   decision, approved status, beta status, controlled-catalogue identifier, and
   controlled provenance classification. It shall not be accepted by an
   approved rehearsal, controlled catalogue, review, promotion, or beta gate.
   — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:32-37`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`;
   `apps/game/src/demo/rehearsal-catalogue.ts:147-189`
4. **FR-004 — Permanent notice.** The page shall always state that its examples
   are real open-source code discovered through GitHub Search and The Stack v2,
   automatically crawled and ingested, unreviewed, local PoC content, and not
   approved beta content. The notice shall remain visible throughout the
   session. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:59-60`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:11-29`
5. **FR-005 — Required source record.** Every fixture shall record a non-blank
   discovery-source class, `owner/repository` identity, repository URL, author name, author basis,
   author-source URL, repository-relative file path, blob identifier, raw and
   excerpt content hashes, licence name, SPDX licence identifier, pinned
   licence-file URL, full Git commit identifier, pinned commit URL, pinned
   file/blob URL, crawl-profile version, and deterministic crawl-snapshot
   identifier. A provenance fixture shall additionally record its GitHub
   commit-search query identity, exact child commit and tree identities, single
   exact parent commit and tree identities, unchanged parent and child
   repository-relative paths, regular-file modes, parent and child blob
   identities, parent and child raw-content hashes, changed-line identity, and
   marker-match outcome. A language fixture shall additionally record its Stack
   v2 release, immutable Hugging Face repository revision and configuration,
   stable row identity,
   Software Heritage blob, content, directory, snapshot, and revision
   identities, Stack repository name and path, detected licences, detected
   language, generated/vendor flags, byte length, and crawl dates. The Git
   commit identifier shall be exactly forty lowercase
   hexadecimal characters. All GitHub URLs shall use HTTPS and the same exact
   owner/repository identity; commit, blob, author-source, and licence-file URLs
   shall bind the same full commit. The blob URL shall bind the recorded file
   path and blob identifier. For provenance, the pinned parent and child commit
   objects shall name the recorded parent and child trees; both trees shall bind
   the same recorded path to the corresponding regular-file blob and raw-
   content hash; and all parent/child identities shall be verified before
   changed-line reconstruction. The author basis shall be the exact selected
   commit, and the author-source URL shall be its pinned commit URL. The licence
   name and SPDX identifier shall match GitHub's detected pair and the licence
   file fetched from the same pinned tree. For a Stack language fixture, the
   revalidated GitHub repository, commit, path, licence, and raw file bytes shall
   agree with the Stack metadata and selected Software Heritage blob; any
   mismatch or unreachable source shall reject the record. An internally
   inconsistent record shall fail closed. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:49-52`;
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:93-100`;
   `docs/gangsta/codeguessr-poc-readiness/reviews/2026-07-30-consigliere-review-1.md:21-25`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:20-28`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:17-29`;
   `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#data-fields`
6. **FR-006 — Automated evidence boundary.** Source and provenance metadata shall
   be described as automatically crawled project records. This Contract shall
   not claim that search ranking is validation, that GitHub authenticated the
   records, that automated licence metadata is a rights decision, that marker
   absence proves human authorship, that Stack licence detection proves file
   rights, that dataset inclusion overrides an opt-out or original licence, or
   that a human review gate passed. —
   Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:23-28`;
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:287-295`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`;
   `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#terms-of-use-for-the-stack-v2`
7. **FR-007 — Single fixture authority.** One server-only fixture authority
   shall parse one successful ingestion artifact, require exactly five
   immutable fixture records with the exact three-GitHub-provenance/two-Stack-
   language lineage, and derive both the public five-round contract and the
   private reveal records from them. It shall reject missing, stale, malformed,
   manually edited, wrong-source, or mixed-snapshot artifacts. Every fixture
   shall carry the artifact's one deterministic crawl-snapshot identifier; a
   separate crawl-run report cannot alter or authorize the artifact. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:47-58`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:20-28`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:17-25`
8. **FR-008 — Exact reveal continuity.** Private reveals shall be keyed by
   unique round identity. The set of five public round identities shall exactly
   equal the set of five private reveal identities. Positional lookup,
   synthetic fallback, missing reveals, and extra reveals are prohibited. —
   Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:47-58`;
   `apps/game/src/demo/rehearsal-catalogue.ts:198-217`
9. **FR-009 — Pre-answer containment.** Correct-answer designations, evidence,
   explanations, source identity, author, licence, attribution, commit
   identifier, and pinned source URLs shall never appear in the public contract,
   guessing prompt, or pre-answer browser artifacts. The public candidate set
   may contain the correct candidate as an indistinguishable playable choice,
   but may not identify it as correct. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:53-58`;
   `tests/containment/acquisition-boundary.test.mjs:81-99`
10. **FR-010 — Reveal validation.** Before returning a private reveal, the
    server action shall reject an inexact request shape, unexpected round order
    or identity, wrong round version, candidate outside the current candidate
    set, invalid clue count, unreachable prior score, and missing or duplicate
    private reveal. Rejection shall return no protected reveal field. —
    Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:53-58`;
    existing local validation at
    `apps/game/src/demo/demo-game.ts:157-197`
11. **FR-011 — Post-answer attribution.** After a valid submission, the current
    round shall return exactly the existing authorized browser reveal fields:
    round identity and version, correctness, score, evidence, explanation, one
    attribution string, helpful and misleading signals, version bindings, and
    result projection. The attribution string shall readably contain repository,
    recorded author, licence name and SPDX identifier, and pinned file/blob
    reference. Source, author, licence, and pinned URL shall not be returned as
    separate browser fields. No attribution shall appear before a valid answer,
    whether or not it would spoil the answer. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:26-28`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:53-58`;
    `apps/game/src/components/arcade/arcade-shell.tsx:15-27`;
    `apps/game/src/components/arcade/arcade-shell.tsx:60-82`;
    `apps/game/src/components/arcade/arcade-shell.tsx:261-275`
12. **FR-012 — Honest provenance semantics.** Provenance rounds shall describe
    only what the linked project record establishes. They shall not infer
    authorship from code style, treat a missing marker as human-only evidence,
    or claim scientific AI detection. Any “not established” answer shall be
    explicitly local-experimental and shall not widen controlled provenance
    types. Any local “not established” candidate shall carry an
    experiment-specific identifier and shall not reuse or extend a controlled
    provenance classification. — Sources:
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:119-132`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`
13. **FR-013 — Candidate and clue integrity.** Every correct candidate shall
    belong to its round's candidate set; candidates and round identities shall
    be unique within their scope; every clue shall be ordered and non-blank;
    every public and private version identifier shall be non-blank. — Sources:
    existing public contract validation at
    `apps/game/src/components/arcade/mode-contract.ts:32-60`
14. **FR-014 — Existing play mechanics.** The experiment shall reuse existing
    zero-, one-, and two-clue scoring, cumulative result validation, completion,
    replay, reduced-viewport behavior, and no-JavaScript explanation. — Sources:
    `apps/game/src/demo/demo-game.ts:143-197`;
    `docs/gangsta/code-guessing-startup/reports/2026-07-16-playable-demo.md:12-18`
15. **FR-015 — Only root activation changes.** Approach A intentionally changes
    the root page and its server action from active rehearsal-catalogue binding
    to the local experiment. The synthetic mode, synthetic fallback, approved
    rehearsal selector, approval-register lineage checks, approved reveal
    authorization, controlled catalogue entries, acquisition, review,
    promotion, and controlled provenance semantics shall remain unchanged and
    independently testable. The existing route-source assertion may be replaced
    only with an assertion for the new direct experiment binding; no other
    approval, fallback, or reveal expectation may be weakened. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-sit-down-approach-selection.md:12-20`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`;
    `apps/game/src/demo/rehearsal-catalogue.ts:147-189`;
    `apps/game/test/rehearsal-catalogue.test.ts:245-268`;
    `apps/game/test/rehearsal-catalogue.test.ts:438-458`
16. **FR-016 — No controlled-Heist credit.** This experiment shall not change
    the status of WP-024, WP-025, WP-026, or WP-027 and shall not supply
    acceptance evidence for them. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`;
    `docs/gangsta/codeguessr-content-acquisition/checkpoints/2026-07-27-checkpoint-the-hit.md:1-9`
17. **FR-017 — No runtime acquisition.** Loading, playing, answering, and
    revealing the experiment shall perform no GitHub request, repository
    discovery, clone, crawl, model call, or other content acquisition. —
    Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:65-67`;
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:312-323`
18. **FR-018 — Inert excerpts.** Source excerpts shall render only as inert text
    and shall never be executed, compiled, imported, evaluated, or used as
    application configuration. — Source:
    `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md:180-183`
19. **FR-019 — Local crawler command.** The project shall provide one documented,
    manually invoked local preparation command that performs discovery,
    GitHub crawling, Stack metadata streaming, selected Software Heritage blob
    retrieval, GitHub revalidation, screening, selection, and atomic replacement
    of the ingestion artifact. It shall be runnable independently of the game
    server and shall exit unsuccessfully without replacing the last valid
    artifact when any required stage fails. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`
20. **FR-020 — Search-driven discovery.** The crawler shall use versioned,
    project-controlled GitHub commit-search profiles, not operator-supplied
    repository URLs, to discover the three provenance candidates. Each run
    shall bind the exact query, sort, order, page, result ceiling, and GitHub API
    version into the deterministic crawl snapshot. The separate run report shall
    bind the local observation time. Revision 9 authorizes only profile
    `local-real-rounds.v1` at
    `ops/poc/profiles/local-real-rounds.v1.json` with these three literal query
    tuples:

    - identifier `microsoft-generated-trailer`, query
      `"Generated-by: Copilot" org:microsoft committer-date:2026-07-31 merge:false is:public`,
      sort `committer-date`, order `desc`;
    - identifier `github-generated-trailer`, query
      `"Generated-by: Copilot" org:github committer-date:2026-01-01..2026-07-31 merge:false is:public`,
      sort `committer-date`, order `desc`; and
    - identifier `facebook-ordinary-change`, query
      `refactor org:facebook committer-date:2026-07-01..2026-07-31 merge:false is:public`,
      sort `committer-date`, order `desc`.

    Any change to the profile version, path, identifier, query, sort, or order
    requires a new Contract revision. Repository identities remain dynamically
    discovered; no repository URL or name is an operator input.

    One query shall inspect no more than three pages or 300 returned results.
    Every accepted page shall contain a boolean `incomplete_results` value. A
    query shall be classified `COMPLETE` only when every accepted page reports
    `false`; it shall be classified `PROVIDER_REPORTED_INCOMPLETE` when one or
    more accepted pages reports `true`, including a mixed `true`/`false` page
    sequence. Every page for one query shall report the same exact integer
    `total_count`; existing page-cardinality, identity, and ceiling rules remain
    binding. For only the three literal tuples above, the exact returned items
    from a query classified `PROVIDER_REPORTED_INCOMPLETE` may enter the bounded
    candidate pool. This is an observed returned set, not a claim that GitHub
    exposed the complete matching population. Every accepted raw page,
    including its completeness flag and total, shall remain covered by the
    deterministic response hash.

    If any accepted query is provider-reported incomplete, the command shall
    emit the visible non-sensitive completion warning
    `GITHUB_SEARCH_INCOMPLETE`, and the separate run report shall record that
    exact completeness classification for every query. The report shall bind
    the warning to its successful output through both `artifactHash` and
    `crawlSnapshotId`. The current run report may be atomically replaced by a
    later run, but the dated WP-028 evidence for every completion claim shall
    preserve these two identifiers, all query classifications, and the warning
    outcome without later modification. The warning shall not log a response
    body, query URL, repository or commit identity. Missing or non-boolean
    completeness state, a non-authorized query tuple, malformed items,
    inconsistent totals or page cardinality,
    duplicated identities, or any page/result ceiling excess shall still fail
    closed. No warning may bypass repository admission, licence, author,
    immutable-lineage, screening, deduplication, exact source composition, or
    atomic publication. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:11-28`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-08-03-checkpoint-the-hit-23.md:18-37`;
    `docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-03-org-scope-live-boundary.md:11-30`;
    `https://docs.github.com/en/rest/search/search`
21. **FR-021 — Public repository admission.** A discovered repository shall be
    eligible only when GitHub records it as public, enabled, non-archived, and
    non-fork; its detected SPDX identifier belongs to the crawl profile's
    explicit allowlist; and its licence file can be fetched and bound at the
    selected commit. Missing, unknown, absent, conflicting, or disallowed
    licence data shall reject the repository. A Stack-discovered repository
    shall pass the same checks after GitHub revalidation. This automated
    decision is only PoC admission, not legal approval. — Sources:
    `docs/gangsta/codeguessr-content-acquisition/recon/2026-07-20-recon-dossier.md:48-50`;
    `https://docs.github.com/en/rest/licenses/licenses`
22. **FR-022 — Immutable ingestion.** Discovery may begin from GitHub's current
    commit-search index or a versioned Stack metadata row, but ingestion shall
    resolve every selected object to a full public GitHub commit identifier
    before accepting content. For every fixture it shall fetch repository
    metadata, the exact child commit and tree, the licence file, and the child
    blob through read-only GitHub API requests. For provenance it shall also
    fetch the exact single parent commit and tree and the parent blob; verify
    that each commit names its recorded tree; verify that both trees bind the
    same unchanged repository-relative path to the recorded regular-file blob
    and raw-content hash; and only then reconstruct changed lines. Truncated
    recursive trees shall be traversed explicitly or rejected; mutable branch or
    tag names shall never appear in the generated fixture identity. — Sources:
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:93-100`;
    `https://docs.github.com/en/rest/git/trees`
23. **FR-023 — Bounded file and excerpt screening.** The crawler shall reject
    symlinks, submodules, binary or invalid-text blobs, unsupported extensions,
    generated, vendored, minified, secret-like, deceptive-control, duplicate,
    empty, and over-limit content. It shall normalize text deterministically,
    retain the raw-content hash, choose a bounded non-empty excerpt using the
    versioned profile, and reject an excerpt that contains source attribution,
    repository identity, licence text, or the answer label before reveal. Source
    bytes shall never be executed or passed to a model. — Sources:
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:280-285`;
    `packages/content/src/acquisition/github/blob-screen.ts:1-67`
24. **FR-024 — Experimental provenance generation.** The three provenance
    rounds shall ask only whether the exact crawled commit record contains one
    of the crawl profile's configured, literal agent-participation markers. The
    two experiment-only candidates shall mean “configured marker recorded” and
    “configured marker not recorded in this commit.” At least one of the three
    rounds shall represent each outcome. Every provenance fixture shall use an
    exact single-parent commit and the parent/child commit, tree, same-path blob,
    regular-file mode, and raw-content bindings required by FR-005 and FR-022.
    The child blob shall differ from its parent blob, and its excerpt shall
    contain at least one deterministically reconstructed changed line.
    Classification shall be
    derived from literal marker presence in that pinned child commit record,
    never code style. Neither outcome shall claim who authored the code,
    whether AI actually generated it, or whether a human-only process occurred.
    These candidates shall not reuse controlled provenance identifiers. —
    Sources:
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:119-132`;
    `packages/content/src/acquisition/github/agent-marker.ts:1-143`;
    `packages/content/src/acquisition/github/changed-lines.ts:1-137`;
    `https://docs.github.com/en/rest/search/search`
25. **FR-025 — Experimental language generation.** The two language rounds shall
    come only from Stack v2 and use two distinct supported languages. Their
    answers shall derive from an exact versioned extension-to-language mapping
    and shall agree with both Stack's detected language and the revalidated
    GitHub repository/file record. Candidate sets, clues, evidence, and
    explanations shall be generated from project-controlled deterministic
    templates. Ambiguous extensions, polyglot files, conflicting language
    signals, an unavailable template, or a source mismatch shall reject the
    candidate. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:19-28`;
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:134-141`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:17-25`
26. **FR-026 — Deterministic selection and generation.** From the bounded
    eligible pools, the preparer shall deduplicate across both sources by
    repository, commit, path, blob, raw-content, and excerpt hashes; apply one
    documented stable ordering per source; select exactly three GitHub-search
    provenance fixtures and two Stack language fixtures; and produce one
    canonically serialized ingestion artifact with a content hash. The artifact
    shall exclude the separate run report and every execution-specific value.
    Its crawl-snapshot identifier shall be derived only from the exact canonical
    crawl-profile bytes and canonical hashes of every provider response accepted
    as an input. Replaying those captured GitHub, Stack metadata, selected-blob,
    and revalidation responses with the same exact crawl-profile bytes shall
    therefore produce byte-identical artifact output even when executed at a
    different time. A live run that cannot
    produce the full source and mode composition shall fail without synthetic,
    wrong-source, or manual fallback. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:20-28`;
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:280-285`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:17-25`
27. **FR-027 — Preparation diagnostics.** The command shall report bounded
    counts and non-sensitive rejection reason codes for discovery, admission,
    Stack metadata inspection, selected-blob retrieval, GitHub revalidation,
    screening, deduplication, and selection. It shall not log search-response or
    dataset-row bodies, source excerpts, commit email addresses, credentials, or
    protected reveal fields. A successful run shall write its separate redacted
    run report, report the deterministic artifact and crawl-snapshot identities,
    and report the five pinned source identities. The run report shall never be
    imported by the game, shall never change artifact bytes, and shall not be
    used to establish fixture consistency. — Sources:
    `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:280-285`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`
28. **FR-028 — Mandatory Stack metadata streaming.** Every successful run shall
    access gated The Stack v2 release `v2.2.0` only at immutable Hugging Face
    repository revision `73b0f1021c37437752281cf0736003f0c987ccc1`, never
    through `main`, and stream only the two configured language subsets. It
    shall inspect no more than the crawl profile's row ceiling per language,
    retain only the minimal fields defined by the Stack metadata-record
    contract, and never materialize the full dataset locally. Missing, changed,
    malformed, unsupported, or over-ceiling schema and metadata shall fail
    closed. A successful run may not bypass Stack v2 or replace its language
    candidates with GitHub search candidates. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#how-to-use-it`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#data-fields`
29. **FR-029 — Selected Stack blob retrieval.** A Stack blob may be downloaded
    from the authorized Software Heritage content store only after its metadata
    passes repository, licence, language, generated/vendor, path, encoding, and
    byte-length screening. The run shall impose exact attempted-blob,
    successfully retrieved-blob, per-blob byte, and total Stack byte ceilings;
    stop as soon as two fully revalidated language fixtures are selected; and
    retain no rejected blob or full-corpus cache. Decompression, decoding,
    identifier, or size mismatch shall reject that candidate. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#downloading-the-file-contents`
30. **FR-030 — Stack-to-GitHub revalidation.** Before selection, each retrieved
    Stack blob shall resolve through its recorded repository name, revision, and
    path to a currently public GitHub repository and exact full commit. The
    preparer shall fetch the pinned GitHub file and require byte equality with
    the selected Software Heritage blob, fetch and bind the licence at that
    commit, and obtain the public commit-author display name and, when present,
    GitHub login. Private,
    deleted, unreachable, redirected, renamed-without-exact-identity,
    revision-mismatched, path-mismatched, byte-mismatched, licence-mismatched,
    or authorless records shall be rejected. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:23-25`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#data-fields`;
    `https://docs.github.com/en/rest/licenses/licenses`
31. **FR-031 — Stack access and removal boundary.** The preparation command
    shall preflight gated access and use three explicit freshness authorities:
    the authenticated Hugging Face revision-addressed dataset-metadata
    endpoint's resolved full repository SHA and gate record; the latest release
    row in the current gated dataset card; and any newer usable-revision notice
    sent by the maintainers to the account holder. For this Contract revision,
    the first two shall respectively equal
    `73b0f1021c37437752281cf0736003f0c987ccc1` and `v2.2.0`, and the account
    holder shall supply the same full revision through the non-secret
    `STACK_V2_ACKNOWLEDGED_USABLE_REVISION` environment value to affirm that no
    superseding maintainer notice has been received. The command shall perform
    two independent comparisons: the profile's immutable revision shall equal
    both the authenticated response SHA at that exact revision-addressed
    endpoint and the account-holder acknowledged revision; and the profile's
    release shall equal the current card's latest release row. A moving
    repository head is not itself the immutable source authority. It may change
    independently for card maintenance, but a new latest release row, changed
    terms, inaccessible pin, or revision-addressed response mismatch invalidates
    the profile.

    For this Contract revision, the deterministic terms boundary is the
    following exact required marker and field set. The authenticated metadata
    response shall report `private` as `false`, `disabled` as `false`, `gated`
    as `auto`, an `extra_gated_prompt` containing both exact strings `The Stack
    v2 is regularly updated to enact validated data removal requests.` and
    `most recent usable version`, and `extra_gated_fields` containing `Email`
    equal to `text` and `I have read the License and agree with its terms` equal
    to `checkbox`. The current card shall contain those same two prompt markers
    and the exact marker `I have read the License and agree with its terms:
    checkbox`. Whitespace outside these markers and unrelated additional
    metadata fields are not terms changes. Absence or mismatch of a required
    value is `TERMS_CHANGED`; malformed required containers remain a malformed
    access response. The command shall fail before metadata streaming, blob
    retrieval, or artifact replacement on either freshness comparison's
    absence or mismatch, access inaccessibility, or this deterministic terms
    check failing. Access credentials and account-contact data remain external
    to the project; the run report records only the pinned release and revision
    and pass/fail reason.

    A provider change invalidates the profile and existing artifact for further
    play. Updating requires a new Contract revision that pins the maintainer-
    designated release and immutable repository SHA, preserves a dated copy of
    the governing terms and changelog evidence, refreshes captured-response
    tests, deletes or atomically supersedes the old artifact, and completes a new
    combined live smoke before play. The preparer does not claim to discover or
    interpret private email notices; that narrow acknowledgement remains the
    account holder's responsibility and is not human review of round content. —
    Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-08-01-checkpoint-the-sit-down-stack-v2-2-change.md:11-21`;
    `docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-stack-v2-2-revision-observation.md:1-53`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#terms-of-use-for-the-stack-v2`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#opting-out-of-the-stack-v2`;
    `https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api`

### Non-Functional Requirements

1. **NFR-001 — Localhost scope.** Acceptance requires localhost play only.
   There shall be no LAN launcher, second-device acceptance test, public
   deployment, public-player claim, or production-hosting requirement. —
   Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:15-18`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:65-67`
2. **NFR-002 — Minimal operational footprint.** The solution shall add no
   more than one local preparation command, isolated GitHub and Stack v2 source
   adapters, versioned project-controlled crawl profiles, and one generated
   local ingestion artifact. Exact-pinned preparation-only dependencies needed
   for gated Stack metadata streaming and selected Software Heritage blob access
   are permitted but shall not enter a game/runtime package. The solution shall
   add no database, persistent corpus cache, external project storage service,
   background worker, scheduler, webhook, public endpoint, game-runtime network
   dependency, entitlement system, or infrastructure service. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`;
   `docs/gangsta/codeguessr-content-acquisition/recon/2026-07-20-recon-dossier.md:43-50`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`
3. **NFR-003 — Immutability.** Crawl profiles, generated fixture records, public
   rounds, private reveals, candidates, clues, source records, content hashes,
   and version bindings shall be recursively immutable at their consumption
   boundaries. — Sources: existing immutable demo boundary at
   `apps/game/src/demo/demo-game.ts:132-142`;
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:280-285`
4. **NFR-004 — Fail closed.** Invalid fixture structure, wrong session
   composition, duplicate identities, source-record omissions, candidate/reveal
   mismatch, public/private key mismatch, or any controlled approval, review,
   promotion, beta, catalogue, or provenance marker shall prevent the
   experiment from becoming playable. It shall not silently substitute
   synthetic data. — Source:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:32-76`
5. **NFR-005 — No sensitive material.** Crawl profiles, fixtures, diagnostics,
   logs, browser artifacts, and documentation shall contain no credential,
   gated-access contact information, private-repository reference, commit email
   address, personal data beyond the already-public author display name and
   GitHub login, secret, or raw restricted acquisition evidence. Every selected
   blob shall pass secret and personal-data screening despite having originated
   in a public dataset. — Sources:
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-345`;
   `tests/containment/acquisition-boundary.test.mjs:57-99`;
   `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#personal-and-sensitive-information`
6. **NFR-006 — Accessibility preservation.** The existing keyboard flow,
   reduced-motion behavior, minimum 320-by-568 viewport behavior, visible
   notices, semantic alerts, and no-JavaScript explanation shall not regress. —
   Source:
   `docs/gangsta/code-guessing-startup/reports/2026-07-16-playable-demo.md:15-18`
7. **NFR-007 — Build and type integrity.** The game production build, recursive
   TypeScript checks, and existing package boundaries shall remain valid with
   the pinned Node and pnpm toolchain. — Sources: `package.json:5-16`;
   `docs/gangsta/codeguessr-poc-readiness/evidence/2026-07-29-fresh-verification.md:11-83`
8. **NFR-008 — Truthful status language.** User interface, README, tests,
   checkpoints, and reports shall consistently use local, automatically
   crawled from GitHub Search and selected Stack v2 blobs, unreviewed, and
   non-beta language. They shall not use approved, authenticated provenance,
   publication-ready, production-ready, controlled-beta-ready, or “Stack
   licensed” language for this experiment. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`;
   `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#licensing-information`
9. **NFR-009 — No hidden scope expansion.** Implementation shall not modify
   controlled acquisition, policy, operator authorization, human review,
   promotion, controlled catalogue, measurement, participant identity,
   privacy, release, incident, or provider semantics beyond revision 9's
   explicit FR-020 handling of GitHub's completeness flag. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:65-76`;
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:312-345`
10. **NFR-010 — Evidence before completion.** PoC completion claims require a
    successful combined live run that searches GitHub, streams Stack metadata,
    retrieves only selected Software Heritage blobs, revalidates them against
    GitHub, and produces the exact source split; focused deterministic crawler
    and gameplay tests; and a fresh full verification sweep with recorded
    command outcomes. An intermittent or failed result, and every accepted
    provider-reported incomplete warning, remains visible in the dated WP-028
    evidence and cannot be erased there by a later pass. The replaceable latest
    run report is not required to retain prior runs. Dated evidence shall bind
    each warning and query classification to the successful `artifactHash` and
    `crawlSnapshotId`. An accepted warning is not evidence of a complete GitHub
    population. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/evidence/2026-07-29-fresh-verification.md:23-46`;
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:17-25`
11. **NFR-011 — Bounded read-only transport.** Preparation network access shall
    be HTTPS, read-only, and limited to exact GitHub API, gated Hugging Face
    dataset, and authorized Software Heritage content-store hosts and endpoint
    families required by FR-020 through FR-031. Automatic redirect following
    shall be disabled. A redirect may be followed only by constructing a new
    GET or HEAD request after exact target-host and endpoint-family validation;
    the new request shall discard the origin Authorization and Cookie headers,
    origin query credentials, and origin signing state before applying only the
    target host's credential policy. An unexpected host, write method,
    unbounded pagination or iteration, malformed response, response-size
    excess, timeout, or unsupported status shall fail closed.

    The command may retry one logical request at most once, may perform at most
    three retries across the entire run, may wait at most fifteen seconds for
    one provider instruction, and may wait at most thirty seconds cumulatively.
    A missing, malformed, or longer retry instruction and exhaustion of any
    retry or wait limit shall fail the run without replacing the prior valid
    artifact. No retry may bypass a request, response, byte, row, blob,
    concurrency, or temporary-disk ceiling. — Sources:
    `packages/content/src/acquisition/github/transport.ts:55-179`;
    `https://docs.github.com/en/rest/search/search`;
    `https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api`
12. **NFR-012 — Credential handling.** Public unauthenticated GitHub access
    shall be supported where GitHub permits it; one optional least-privilege
    GitHub token may be supplied for higher limits. The gated dataset-access
    token and Software Heritage content-store credentials required by the user's
    accepted access shall be supplied only through documented process
    environment variables or provider-standard external credential stores. No
    credential shall be accepted as a command argument, URL, crawl-profile
    field, tracked file, artifact field, diagnostic, or log value. The GitHub
    token may be attached only to `api.github.com`; the Hugging Face token only
    to the exact Hugging Face dataset API and file endpoints; and AWS signing
    material only to the configured Software Heritage bucket endpoint. No
    credential, Authorization or Cookie header, AWS signature, security token,
    presigned query parameter, or signed redirect URL may cross hosts. Request
    diagnostics shall retain only the provider class, allowlisted host class,
    method, redacted path template, status class, and non-sensitive reason code;
    full URLs and query strings are prohibited from diagnostics and errors. —
    Sources:
    `packages/content/src/acquisition/github/transport.ts:26-34`;
    `packages/content/src/acquisition/github/transport.ts:127-140`;
    `https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#terms-of-use-for-the-stack-v2`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#downloading-the-file-contents`
13. **NFR-013 — Test and runtime isolation.** Automated tests shall use captured
    or in-memory GitHub, Stack metadata, and selected-blob responses and shall
    not depend on live network state. A separately recorded combined live smoke
    run supplies real-crawl evidence. The game package and browser dependency
    graph shall contain no crawler transport, dataset library, content-store
    client, credential access, search client, or gameplay-time fetch capability.
    — Sources:
    `docs/gangsta/codeguessr-content-acquisition/recon/2026-07-20-recon-dossier.md:43-50`;
    `tests/containment/acquisition-boundary.test.mjs:57-99`
14. **NFR-014 — Capacity ceiling.** The Stack adapter shall stream metadata and
    retrieve selected blobs only. A run shall inspect at most 10,000 metadata
    rows per configured language, receive at most 64 MiB of Stack metadata,
    attempt at most 50 Stack blobs total, accept blobs no larger than 256 KiB,
    receive at most 16 MiB of Stack blob content, retain no raw Stack blob after
    excerpt generation, retain exactly two screened Stack excerpts in the
    artifact, and use at most 32 MiB of temporary disk. A profile may lower but
    never raise these ceilings. The full Stack v2
    metadata distribution, full source corpus, language shard, or repository
    archive shall never be downloaded. Temporary rejected content shall be
    deleted before successful completion or failure returns. — Sources:
    `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`;
    `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#the-stack-v2`

## Architectural Decisions

1. **Direct fixture authority:** Approach A places the local experiment directly
   on the root demo route because it is the smallest path to playable feedback.
   — Source:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-sit-down-approach-selection.md:10-20`
2. **Mandatory two-source preparation:** Approach B uses GitHub commit search
   for provenance discovery and mandatory Stack v2 streaming for language
   discovery, then resolves every selection to immutable GitHub source records
   before play. Search and dataset records are discovery inputs, not evidence
   of correctness, rights, or approval. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:11-28`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:11-29`
3. **Experimental isolation:** The GitHub and Stack adapters and ingestion
   artifact belong to the local experiment. They may reuse unchanged low-level
   bounded transport, hashing, tree, blob, and licence-screening utilities, but
   shall not invoke or satisfy controlled policy registers, operator
   authorization, encrypted raw storage, human review, promotion, approved
   catalogue, or beta gates. — Sources:
   `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:287-295`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:13-24`
4. **One generated authority:** Public rounds and private reveals derive from
   the same hash-bound two-source ingestion artifact to prevent positional
   drift, manual substitution, wrong-source composition, and mixed crawl
   lineage. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:47-58`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-approach-selection.md:20-28`
5. **Selected blobs over corpus download:** Stack v2 is mandatory, but the
   preparation path streams bounded metadata and retrieves only candidate blobs
   needed to produce two revalidated language fixtures. The full metadata and
   source corpora are explicitly unnecessary and prohibited. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`;
   `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#the-stack-v2`
6. **Existing local reveal security level:** The PoC retains strict request and
   score validation but does not add participant identity, durable entitlements,
   replay prevention, or production authorization. Its security claim is
   limited to pre-answer browser containment in ordinary local play. — Sources:
   `apps/game/src/demo/demo-game.ts:157-197`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:41-67`
7. **Disjoint governance:** The experiment supersedes the earlier manual-only,
   no-crawler decision and the dossier's assumption that four-person review is
   required before five fixtures may be played locally. It does not amend the
   signed controlled acquisition Contract or its work-package gates. — Sources:
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-crawler-change.md:11-24`;
   `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`

## Grilling Conclusions

### Key Decisions

- Exactly five real fixtures with a three-provenance/two-language split provide
  the desired fun PoC without controlled-beta scale.
- Search-driven crawling and ingestion are required preparation capabilities;
  a manually assembled five-fixture file is not sufficient.
- The Stack v2 is a mandatory language-discovery source, while only selected
  blobs are downloaded and every selection is revalidated against GitHub.
- Search, licence, author, language, and marker metadata are automated records,
  not authenticated provenance, rights review, or human approval.
- A server-only fixture authority and private reveal map preserve ordinary
  pre-answer gameplay without production entitlement machinery.
- The active notice and project record preserve the distinction between
  unreviewed experiment, approved rehearsal, and controlled beta.
- Gameplay remains network-free and consumes one frozen generated artifact.
- The existing controlled acquisition Heist remains unchanged and incomplete.

### Rejected Alternatives

- **Existing synthetic demo only:** rejected because the Don requires real
  examples.
- **Two real rounds:** rejected in favour of one complete five-round session.
- **Four-person review before PoC play:** rejected as disproportionate for a fun
  localhost experiment.
- **Manual-only fixtures:** rejected after the Don clarified that ingestion and
  a crawler are required parts of the PoC.
- **Seeded repository crawler:** rejected in favour of GitHub search-driven
  discovery.
- **GitHub-only language discovery:** rejected because the Don requires Stack v2
  to be part of the PoC.
- **Full Stack v2 download:** rejected because the Don lacks capacity and the
  PoC needs only two selected language blobs.
- **Stack-only ingestion:** rejected because Stack metadata does not supply the
  commit-marker evidence required by the three provenance rounds and every
  selected language item still requires current GitHub revalidation.
- **Controlled acquisition-engine adapter:** rejected because its policy,
  authorization, encrypted-storage, review, and promotion coupling is
  disproportionate for this local unreviewed experiment.
- **Gameplay-time or continuously scheduled crawling:** rejected because rounds
  must remain repeatable and network-independent.
- **Production-grade answer entitlements:** rejected because public players and
  adversarial production operation are out of scope.
- **LAN-specific tooling and acceptance:** rejected because localhost proof is
  sufficient.
- **Separate PoC route:** rejected in favour of the smaller direct-root
  Approach A.
- **Selectable catalogues:** rejected because configuration flexibility is not
  yet needed.

### Unresolved Objections

- GitHub search ranking and results can change between runs or be incomplete. —
  Risk: MEDIUM — Mitigation: bind the three authorized literal query tuples,
  accept only their exact bounded returned sets when provider-reported
  incomplete, warn without claiming population completeness, freeze the
  selected artifact, and test determinism from captured responses.
- Automated author, licence, language, and marker records can be mistaken or
  incomplete. — Risk: MEDIUM — Mitigation: exact pinned records, conservative
  rejection, and permanent automated/unreviewed status language.
- A missing configured marker does not establish human authorship or absence of
  AI participation. — Risk: HIGH if mislabeled, LOW under the contracted copy —
  Mitigation: the answer states only whether the selected commit record contains
  a configured literal marker.
- A local owner can inspect project source or invoke local actions to discover
  answers. — Risk: LOW — Mitigation: accept this under the fun localhost threat
  model while retaining normal browser containment.
- Licence metadata is not a human rights determination. — Risk: MEDIUM —
  Mitigation: make no publication-eligibility claim and keep public deployment
  out of scope.
- GitHub API limits or availability can block regeneration. — Risk: MEDIUM —
  Mitigation: bounded failure with retry timing, optional read-only token, and
  preservation of the last valid artifact until a complete replacement exists.
- Stack access, Software Heritage credentials, dataset schema, or dataset
  availability can block regeneration. — Risk: MEDIUM — Mitigation: explicit
  preflight, exact revision binding, captured-response tests, and failure before
  artifact replacement.
- Stack blobs may contain secrets or personal information and licence detection
  can be wrong. — Risk: HIGH before screening, MEDIUM after — Mitigation:
  metadata filters, selected-blob-only retrieval, existing content screening,
  GitHub byte/licence revalidation, and no human-review or rights claim.
- The live acquisition audit append-concurrency defect remains unresolved. —
  Risk: HIGH for controlled acquisition, LOW for this PoC — Mitigation: the PoC
  does not use that path; the defect remains a blocker for WP-024 and WP-025.

## Applicable Constitution Rules

### Commandments

- Every material claim shall cite a durable source and every phase state shall
  remain resumable. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-335`
- The signed Contract is the implementation boundary; no production change may
  precede signature and Resource Development. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-335`

### Negative Constraints

- NEVER market recorded provenance as AI detection or infer human authorship
  from a missing marker. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:335-344`
- NEVER let automation, licence metadata, placeholders, or agents impersonate
  human approval. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:287-295`
- NEVER expose correct answers or restricted evidence in pre-answer public
  artifacts, telemetry, or logs. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-345`
- NEVER introduce gameplay-time crawling, mutable source references, automatic
  publication, or public acquisition endpoints. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:312-323`
- NEVER claim this local experiment satisfies controlled acquisition,
  promotion, approved catalogue, beta, or launch requirements. — Source:
  `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-30-checkpoint-the-grilling.md:68-76`
- NEVER download or retain the complete Stack v2 metadata distribution, source
  corpus, language shard, or repository archive, and NEVER store its gated
  credentials or access-contact data in project artifacts. — Sources:
  `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-07-31-checkpoint-the-sit-down-stack-v2-change.md:13-25`;
  `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#terms-of-use-for-the-stack-v2`

## Acceptance Criteria

1. One documented local command runs GitHub commit search, Stack v2 metadata
   streaming, selected Software Heritage blob retrieval, GitHub revalidation,
   screening, deterministic selection, and atomic artifact replacement without
   starting the game.
2. Deterministic tests prove exact crawl-profile parsing, GitHub commit-search
   queries, Stack release, immutable Hub revision and configurations, GitHub
   pagination, consistent multi-page totals, Stack row iteration, exact complete
   versus provider-reported-incomplete classification for the three authorized
   literal organization-scoped query tuples, mixed-page aggregation, visible
   warning and run-report propagation,
   per-source stable ordering, every capacity ceiling, and rejection of missing
   completeness state, malformed, duplicate, non-profile, unsupported, or
   excessive results.
3. Admission tests accept only public, enabled, non-archived, non-fork
   repositories with an allowlisted SPDX identifier and a matching licence file
   at the selected commit; every FR-021 rejection fails closed.
4. GitHub provenance-ingestion tests resolve commit-search results to exact
   single-parent changes; require both commit-to-tree and same-path tree-to-blob
   bindings; verify both regular-file modes and raw-content hashes before diff
   reconstruction; and bind every common and provenance-specific FR-005 field.
5. Stack language-ingestion tests stream metadata without materializing a
   language shard, select only eligible rows, retrieve only bounded candidate
   blobs, and bind every common and Stack-specific FR-005 field.
6. Stack revalidation tests require exact public GitHub repository, revision,
   path, byte, licence, and author agreement and cover every FR-030 rejection.
7. Screening tests cover every FR-023 exclusion and prove excerpts are bounded,
   inert, deterministic, and free of pre-answer attribution and answer labels.
8. Provenance-generation tests produce exactly three rounds using only the two
   experiment-specific marker-record outcomes, include at least one of each
   outcome, and reject any human-authorship, AI-generation, style-detection, or
   controlled-provenance claim.
9. Language-generation tests produce exactly two distinct supported-language
   rounds discovered through Stack v2, agree across Stack metadata, extension
   mapping, and revalidated GitHub records, and reject ambiguous, conflicting,
   unmapped, polyglot, untemplated, wrong-source, or mismatched inputs.
10. Captured GitHub, Stack metadata, Software Heritage blob, and revalidation
    responses replay to one byte-identical, canonically serialized, hash-bound
    artifact containing exactly three GitHub provenance and two Stack language
    fixtures in order. Changing only execution identifier, local observation
    time, diagnostics, counters, or retry state changes the separate run report
    but not artifact bytes. An insufficient pool or any failed stage leaves the
    prior valid artifact byte-for-byte unchanged.
11. Capacity tests prove the command never downloads the complete Stack
    metadata distribution, source corpus, language shard, or repository
    archive; stops after the required two language fixtures; and removes all
    rejected or temporary blobs on both success and failure.
12. Access tests prove a successful gated-access preflight; exact equality of
    the profile immutable revision, authenticated revision-addressed response
    SHA, and account-holder acknowledged revision; separate exact equality of
    the profile release and current-card latest release row; rejection before metadata
    streaming or blob retrieval on any access, terms, release, revision, or
    acknowledgement mismatch; and absence of contact or credential data from
    project artifacts.
13. A separately recorded combined live smoke run uses real GitHub search,
    gated Stack metadata streaming, selected Software Heritage blobs, and
    GitHub revalidation to generate the exact five-fixture artifact without a
    full dataset download, private repository, manual fixture substitution, or
    human approval decision. It records any provider-reported incomplete query
    as the required visible warning, binds every query classification to the
    successful `artifactHash` and `crawlSnapshotId` in immutable dated WP-028
    evidence, and makes no complete-population claim.
14. The root local application presents those five generated real excerpts, and
    the permanent notice communicates GitHub Search and Stack v2 discovery,
    automated crawling and ingestion, unreviewed status, local PoC scope, and
    non-beta status throughout play.
15. The exact experimental shape rejects injected approval, review, promotion,
    beta, controlled-catalogue, and controlled-provenance markers. Passing the
    experiment artifact to an approved selector cannot activate an approved
    gate.
16. Exactly five unique public round identities match exactly five private
    reveal identities and one two-source deterministic crawl-snapshot and
    artifact identity; source lineage is exactly three GitHub-search provenance
    and two Stack language, while the separate run report is not gameplay input.
17. Pre-answer public data, guessing prompts, browser static artifacts, logs,
    and diagnostics contain none of the protected FR-009 fields.
18. A valid answer returns only the submitted round's exact FR-011 authorized
    browser reveal. Source, author, licence, and pinned reference appear only
    inside its attribution string; every FR-010 invalid case fails without
    protected reveal data.
19. All five rounds complete through clues, scoring, result, completion, and
    replay on localhost. The minimum viewport, reduced-motion, keyboard, error,
    and no-JavaScript behaviors remain covered.
20. Transport tests prove exact GitHub, Hugging Face, and Software Heritage host
    and endpoint allowlisting; read-only requests; disabled automatic redirects;
    new-request validation and origin-credential stripping for allowed redirect
    targets; unexpected redirect rejection; timeouts; request, row, blob, byte,
    concurrency, and temporary-disk ceilings; bounded pagination/iteration; the
    one-per-request, three-per-run, fifteen-second single-wait, and thirty-second
    cumulative-wait retry limits; atomic failure on exhaustion; per-host
    credential scoping; and redaction of credentials, signatures, signed URLs,
    contact data, email, source, and dataset rows without live network calls.
21. Existing synthetic fallback, approved selection, approval lineage,
    approved reveal, controlled acquisition, and containment tests pass without
    relaxed semantics. Only the obsolete assertion that `/` mounts the active
    rehearsal catalogue is replaced with the direct experiment assertion.
22. Focused tests cover both source adapters, Stack access and capacity
    boundaries, GitHub revalidation, artifact generation and rejection,
    experimental gate isolation, public/private continuity, honest provenance
    language, reveal validation, source containment, attribution timing,
    complete five-round browser play, and replay.
23. The fresh full sweep records passing workspace/unit tests, recursive
    typecheck, accessibility support gate, performance gate, Playwright suite,
    acquisition containment checks, and production game build.
24. Dependency and artifact inspection confirms no database, persistent corpus
    cache, external project storage service, scheduler, webhook, public
    acquisition endpoint, LAN launcher, public
    deployment configuration, crawler code in the game/browser dependency
    graph; no complete Stack metadata, source corpus, language shard, or
    repository archive; and no credential or gated contact information in any
    tracked or generated artifact.
25. README and the final report document preparation and play commands, the
    required Stack/Hugging Face access preflight, selected-blob-only capacity
    boundary, optional GitHub token, exact crawler limitations, local unreviewed
    status, and separate controlled acquisition blockers.
26. The active controlled acquisition checkpoint still records WP-024 through
    WP-027 as incomplete.

## Out of Scope

- Public deployment, public players, production hosting, LAN-specific tooling,
  and second-device testing.
- Private repositories, participant-supplied URLs, seed-only repository lists,
  Git cloning, HTML scraping, Stack Overflow, source providers beyond GitHub,
  gated Hugging Face Stack metadata, and the authorized Software Heritage
  content store, and gameplay-time network access.
- Background or continuous crawling, schedules, webhooks, public ingestion
  endpoints, databases, project-owned persistent storage services, and manifest
  signing.
- Full Stack v2 metadata, source-corpus, language-shard, or repository-archive
  downloads; persistent Stack caches; and use of Stack v2 for provenance rounds.
- Model calls, generated-code execution, semantic AI detection, human-authorship
  inference, automatic legal conclusions, and automatic publication.
- Human content review, rights approval, promotion, publication eligibility,
  approved rehearsal activation, and controlled-beta corpus readiness.
- Participant identity, durable sessions, production entitlements,
  replay-prevention security, anti-forgery guarantees, and adversarial local
  owner protection.
- Changes to controlled provenance types, acquisition policy, operator
  authorization, review, promotion, measurement, privacy, release, incident, or
  provider systems.
- Use of the controlled acquisition policy registers, operator authorizations,
  encrypted raw store, review decisions, promotion receipts, or approved
  catalogue as shortcuts for this experiment.
- Manual editing or substitution of generated fixture records after ingestion.
- Resolution of the separate live-acquisition audit append-concurrency defect.
- Completion or evidentiary credit for WP-024 through WP-027.

## Open Risks

1. **Search instability — MEDIUM.** Ranking, indexed content, completeness
   flags, and available results may change, so later live runs may generate
   different valid rounds. Revision 9 can use a provider-reported incomplete
   returned set only with the explicit warning and without a complete-population
   claim.
2. **Automated metadata error — MEDIUM.** GitHub or local parsing may record an
   incomplete author, licence, language, or marker classification without
   independent review.
3. **Rights interpretation — MEDIUM.** A licence record does not prove that all
   presentation and attribution obligations have been legally evaluated.
4. **Marker interpretation — MEDIUM.** A configured marker is only a literal
   record signal; it may not describe the actual code-creation process.
5. **API availability — MEDIUM.** Search limits, rate limits, incomplete results,
   or GitHub outages can prevent regeneration.
6. **Local answer discovery — LOW.** A machine owner can inspect source or call
   local actions outside normal gameplay.
7. **Status confusion — MEDIUM.** Real content may be mistaken for reviewed
   content despite the notice and documentation.
8. **Future reuse pressure — MEDIUM.** Experimental fixtures may later be
   proposed for public use; such reuse requires a new signed Contract and the
   controlled review/promotion path.
9. **Audit concurrency — HIGH for controlled acquisition, LOW here.** The
   separate audit append behavior remains schedule-dependent and must be fixed
   before WP-024 or WP-025.
10. **Stack access and freshness — MEDIUM.** Gated metadata access, Software
    Heritage credentials, provider schema, or removal-driven revision updates
    may prevent a later run even when the frozen local game still works.
11. **Stack sensitive content — HIGH before screening, MEDIUM after.** Public
    source archives can contain secrets, personal data, malicious text, or
    misleading licence signals; automation reduces but does not eliminate this
    risk.
12. **Capacity and latency — MEDIUM.** Even streaming can inspect many metadata
    rows or attempt several blobs before finding two candidates that survive
    GitHub revalidation; strict ceilings may make some runs fail by design.
