---
heist: codeguessr-poc-readiness
evidence: organization-scope-live-boundary
observed-at: 2026-08-03T14:57:41Z
outcome: failed-closed
artifact-published: false
credential-material-recorded: false
---

# Organization-Scoped Live Boundary

The exact organization-scoped profile passed focused 18/18, full preparation
309/309, and full typecheck before a live boundary check. Stack preflight
passed; GitHub search then returned `GITHUB_SEARCH_REJECTED` and no artifact was
published.

Paced invariant-only observation established that the first selected marker
query returned the same five-result population previously observed as complete,
but now marked it incomplete. One of those five records also used a date value
outside the currently accepted canonical shapes. The next query returned HTTP
403 secondary throttling while the public search quota header still reported
seven requests remaining.

This disproves the theory that organization/date scoping alone makes GitHub's
search completeness signal stable. Under the then-signed Contract revision 8,
incomplete results could not be accepted, and proactive delay or retry without
a valid provider instruction was not authorized, so no implementation change
followed. Revision 9 supersedes only the exact provider-incomplete behavior for
its three literal authorized query tuples.

No response body, date value, query URL, repository, commit, source content,
token, credential, account value, or protected field is preserved. The
generated artifact remains absent.
