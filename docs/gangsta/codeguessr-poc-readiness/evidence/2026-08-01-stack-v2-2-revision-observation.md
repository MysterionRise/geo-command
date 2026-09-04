---
heist: codeguessr-poc-readiness
evidence: stack-v2-freshness
observed-at: 2026-08-01T12:13:07Z
release: v2.2.0
revision: 73b0f1021c37437752281cf0736003f0c987ccc1
gate-state: usable
credential-material-recorded: false
---

# Stack v2.2.0 Revision Observation

The first authorized combined live preparation attempt failed closed before
metadata streaming or artifact publication. Stage isolation first identified
that the unpinned dataset-information request was comparing a moving repository
head to the historical revision. Hugging Face's official dataset-information
API supports an explicit revision and returns the repository SHA for that
revision.

After changing only that request to the revision-addressed endpoint, the gated
metadata response for revision
`7408bfbcfd48e5833d62fd3dba48afd20d109473` was reachable and internally bound,
but the current dataset card no longer matched Contract revision 7. The card's
first changelog row is now `v2.2.0`, describing removal of repositories that
opted out before 2026-07-29 and removal of repositories whose users or
organizations are no longer on GitHub. The current public dataset repository
head is `73b0f1021c37437752281cf0736003f0c987ccc1`; authenticated metadata records
the gate as usable.

The account holder confirmed existing gated access and explicitly authorized
the PoC Contract/profile update to release `v2.2.0` at immutable revision
`73b0f1021c37437752281cf0736003f0c987ccc1` on 2026-08-01. No private notice of
a newer usable revision has been reported. This acknowledgement is freshness
input only and is not content review or approval.

Revision 8 therefore uses three fail-closed authorities: the profile and
account-holder acknowledgement must name the same immutable revision; the
authenticated revision-addressed metadata response must resolve to that exact
SHA with the exact required gate and terms marker/field set specified by
Contract revision 8; and the current card's first changelog row must equal the
profile release. A missing or mismatched required terms marker or field, or a
later release row, invalidates the profile and requires another Contract
revision and live smoke. Whitespace outside the required markers and unrelated
additional metadata fields are not terms changes.

Public sources:

- `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#changelog`
- `https://huggingface.co/datasets/bigcode/the-stack-v2/blob/73b0f1021c37437752281cf0736003f0c987ccc1/README.md#terms-of-use-for-the-stack-v2`
- `https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api`

No token, credential, contact value, response body, dataset row, or source blob
is preserved in this evidence.
