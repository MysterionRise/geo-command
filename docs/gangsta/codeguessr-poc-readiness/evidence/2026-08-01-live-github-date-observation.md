---
heist: codeguessr-poc-readiness
evidence: live-github-date-shape
observed-at: 2026-08-01T20:24:15Z
credential-material-recorded: false
---

# Live GitHub Commit-Date Shape

After encoded-response transport verification, the corrected live search
advanced to `GITHUB_SEARCH_REJECTED`. An invariant-only diagnostic found no
missing identity fields, malformed SHAs, repository-name failures, URL
mismatches, or duplicate identities across the four observed pages. Every
commit date failed the captured parser.

A shape-only observation established that GitHub currently returns canonical
UTC timestamps in `YYYY-MM-DDTHH:mm:ss.sssZ` form. The adapter accepted only
`YYYY-MM-DDTHH:mm:ssZ` and validated it by inserting `.000`; applying that rule
to an already millisecond-precise value necessarily rejected it.

The corrective boundary is exact: accept a parseable canonical UTC ISO value
with either second precision or exactly three fractional digits; preserve all
other identity, URL, completeness, ceiling, and duplicate checks. One observed
query also temporarily reported incomplete and must continue to fail closed.

No timestamp value, commit, repository, response body, query URL, source
content, token, credential, or account data is preserved.
