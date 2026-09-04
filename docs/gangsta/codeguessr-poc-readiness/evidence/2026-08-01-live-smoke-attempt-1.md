---
heist: codeguessr-poc-readiness
evidence: combined-live-smoke-attempt-1
observed-at: 2026-08-01T20:01:57Z
outcome: failed-closed
artifact-published: false
credential-material-recorded: false
---

# Combined Live Smoke Attempt 1

The signed Stack `v2.2.0` preflight passed, then GitHub commit-search discovery
failed closed. The public command emitted only `PREPARATION_FAILED`, exited 1,
and did not publish `apps/game/src/demo/generated/local-real-rounds.json`.

A redacted boundary diagnostic reproduced `PREFLIGHT:PASS` followed by
`GITHUB_SEARCH_REJECTED`. Count- and key-name-only GitHub observations then
isolated two independent mismatches between captured assumptions and the live
provider:

1. Live search items and their nested commit and repository records contain the
   documented GitHub response fields in addition to the minimal identity fields
   used by the crawler. The adapter required exact key equality instead of
   validating and projecting the required subset.
2. The three unqualified query populations were respectively 7,593, 52,746,
   and 95,566 results. The first two were also reported incomplete. They cannot
   satisfy the Contract's complete-population ceiling of 300 results.

GitHub documents that commit searches may combine committed-date, non-merge,
public-visibility, and organization qualifiers. Count-only probes of the
proposed project-controlled profile produced complete bounded populations of
67, 62, and 148 results. These counts are dated observations, not guarantees;
the live command must still fail closed if they later become incomplete or
exceed the fixed ceiling.

Public source:

- `https://docs.github.com/en/search-github/searching-on-github/searching-commits`

No response body, commit, repository identity, email, source content, token,
credential, query URL, or account data is preserved in this evidence.
