---
heist: codeguessr-poc-readiness
evidence: stack-pin-live-boundary
observed-at: 2026-08-06T19:17:01Z
outcome: failed-closed
artifact-published: false
credential-material-recorded: false
---

# Stack Pin Live Boundary

The first combined live preparation attempt under signed Contract revision 9
emitted only `PREPARATION_FAILED`, exited unsuccessfully, wrote no run report,
and did not publish the generated five-round artifact.

A redacted boundary diagnostic isolated the failure before GitHub search. The
public dataset card request passed, while the exact revision-addressed dataset
metadata request returned a 4xx status class. Provider-client cross-examination
then established all of the following without retaining account data or
response bodies:

- the cached Hugging Face token is valid;
- current gated dataset access succeeds;
- the signed historical revision
  `73b0f1021c37437752281cf0736003f0c987ccc1` returns
  `RevisionNotFoundError`;
- current immutable revision
  `e565caa3a78c2423bd374333a472b049eb090e47` is accessible through its exact
  revision address;
- the dataset remains public metadata with automatic gating and unchanged
  required gate-field invariants;
- the authenticated current card retains all required terms markers; and
- the latest card release remains `v2.2.0`.

This is a provider pin-removal boundary, not a credential failure, GitHub
failure, crawler completeness failure, or content-admission result. Contract
revision 9 requires a new signed Contract revision before the profile, access
adapter, captured responses, acknowledgement, or evidence may use the current
immutable SHA. No retry or implementation change followed this observation.

No token, credential, account value, contact value, response body, source
identity, query URL, repository, commit, dataset row, or blob content is
preserved in this evidence.
