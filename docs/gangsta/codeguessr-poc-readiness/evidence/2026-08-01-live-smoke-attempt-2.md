---
heist: codeguessr-poc-readiness
evidence: combined-live-smoke-attempt-2
observed-at: 2026-08-01T20:13:06Z
outcome: failed-closed
artifact-published: false
credential-material-recorded: false
---

# Combined Live Smoke Attempt 2

The corrected Stack preflight and bounded GitHub profile reached the GitHub
transport, then failed closed with the redacted retry-boundary reason
`RETRY_SIGNAL_MISSING`. Repeating the same stage reproduced the failure; a raw
request with the same public profile succeeded, disproving a transient-status
hypothesis.

A headers-and-count-only boundary comparison established the difference. The
GitHub response was gzip encoded with a declared compressed length of 77,587
bytes, while Node exposed 602,599 decoded body bytes. The bounded transport
compared `Content-Length` with the decoded count and classified the valid
response as malformed. Its independent streaming meter already measures the
decoded bytes and would enforce the fixed 8 MiB response ceiling.

The corrective theory is narrow: declared-length equality applies only to an
identity/unencoded response; every response, encoded or not, remains subject to
the decoded streaming byte limit. Missing or malformed declared lengths and
unencoded declared/received mismatches remain fail-closed.

No response body, query URL, source identity, token, credential, account value,
or protected content is preserved. The command did not publish a generated
artifact.
