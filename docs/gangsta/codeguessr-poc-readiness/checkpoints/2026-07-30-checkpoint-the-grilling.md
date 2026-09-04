---
heist: codeguessr-poc-readiness
phase: the-grilling
status: completed
timestamp: 2026-07-30T22:06:52+01:00
next-action: Proceed to The Sit-Down
artifacts: []
note: Final consensus approved by the Don; conclusions pass in-context to The Sit-Down.
---

## Resume Context

The Don refined the PoC objective during Phase A:

- The demo must run locally for testing and may be played over a local network,
  but public-player access is out of scope.
- A second-device LAN acceptance test is not required; verified localhost play
  is sufficient.
- The existing synthetic five-round session is not sufficient for PoC
  completion.
- The target is exactly five real rounds with the existing
  three-provenance/two-language split.
- The PoC does not require the existing four-person human review gate.
- Real inputs may come from open-source GitHub repositories with recorded
  repository, author, and licence metadata.
- Attribution metadata is required during crawling/preparation but is not part
  of the guessing prompt. The Don accepted deferral until after the answer when
  needed to preserve the puzzle.

## Idea Verdict

**CHALLENGE.** The objective is sound only with an explicit experimental
content class that remains local-only and visibly unreviewed. It must not
weaken, impersonate, or overwrite the existing approved-content and
controlled-beta classes. The Grilling proposal must reconcile this new PoC
boundary with the signed acquisition and publication constraints before the
Sit-Down revises any specification.

## Final Single-Pass Consensus

The Don rejected production-grade ingestion and authorization machinery as too
complex for a fun PoC. The Synthesizer incorporated the material parts of the
Devil's-Advocate attack without preserving that overreach.

The final proposal is:

- Add one server-only, project-controlled `LOCAL_UNREVIEWED_EXPERIMENT` fixture
  module.
- Manually curate exactly five real open-source GitHub excerpts: three
  provenance rounds followed by two language rounds.
- Record repository, author, full commit SHA, pinned commit/blob URL, file path,
  SPDX licence identifier, licence name, and licence URL for every fixture.
- Derive the public five-round contract and a private immutable
  round-ID-to-reveal map from the same frozen records.
- Keep correct answers, evidence, source, author, licence, attribution, commit
  SHA, and pinned URLs out of pre-answer public data and browser static chunks.
- Reveal the current round's source/author/licence attribution only after a
  valid answer submission.
- Display a permanent notice that these are real open-source examples,
  manually curated, unreviewed, local-only, and not approved beta content.
- Reuse the existing Next localhost commands, arcade shell, scoring, clue,
  completion, and replay mechanics.
- Add only focused fixture, reveal, end-to-end, and containment tests, followed
  by the existing full sweep.
- Add no crawler, operator command, network client, external manifest,
  database, environment variable, entitlement system, LAN launcher, or public
  deployment.
- Leave controlled acquisition, review, promotion, provenance types, and
  approved-catalogue semantics unchanged.
- Keep WP-024 through WP-027 incomplete; this local experiment earns no
  controlled-acquisition or beta-readiness credit.

The Sit-Down should draft a small standalone child Contract for this experiment.
It may supersede the PoC-readiness dossier's assumption that four-person review
is required for the five local experimental fixtures, but it must not amend or
weaken the existing controlled acquisition Contract.

## Final Consensus Status

- New valid objections incorporated: 6
- Resolved by the Don's Phase A and Phase D answers: 3
- Unresolved CRITICAL objections: 0
- Termination reason: single-pass complete

## Don Approval

The Don approved the final consensus on 2026-07-30 and authorized The Sit-Down.
