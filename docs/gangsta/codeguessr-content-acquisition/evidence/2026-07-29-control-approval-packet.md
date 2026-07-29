---
evidence-class: control-approval-packet
prepared-at: 2026-07-29T11:01:50Z
status: AWAITING_REAL_APPROVERS
---

# Real-content PoC control approval packet

The two acquisition policies are finalized for review but remain
non-effective until the project records real, distinct approvals in the
project-controlled registers.

## Frozen policy candidates

| Policy | Version | Canonical SHA-256 |
| --- | --- | --- |
| Repository Admission | `repository-admission-v1` | `e8cb7f52181a2de142e45ea542e52e1bef1210138acdffb10f7f2794390b09d0` |
| Attribution Marker | `attribution-markers-v1` | `642b99c1809a3a6fb37271b8204aa63dc825c2225aeab7a1c0819eae947ec9f4` |

Any edit to either policy invalidates the corresponding hash and requires a
new review.

## Policy approvals required

For each policy, record:

- a Don approver identifier and whole-second UTC approval time;
- a different Rights/Safety Reviewer identifier and whole-second UTC approval
  time;
- a `validFrom` time no earlier than both approvals;
- both permitted purposes:
  `LANGUAGE_CANDIDATE` and
  `RECORDED_AGENT_PARTICIPATION_CANDIDATE`.

The Rights/Safety Reviewer is approving acquisition admission only. Separate
item-level rights and presentation decisions remain mandatory before
promotion.

## Operator authorization required

Record one actual named operator with:

- the exact OS identity reported by the command, such as `uid:<number>`;
- repository `mysterionrise/encrypted-information-retrieval`;
- both acquisition purposes;
- token allowance
  `PUBLIC_REPOSITORY_METADATA_AND_CONTENTS_READ_ONLY`;
- a bounded UTC validity interval;
- a Release Operator approval;
- a different Security Reviewer approval.

The operator approvers must be distinct. No placeholder or agent identity may
be recorded as a real approval.

## Prepared run target

Both first-run descriptors should bind:

- commit `8f8183fb80fb90165e321d96df7a3a5f4ccd445e`;
- subtree `src`;
- one purpose per descriptor;
- an observation time created immediately before its run;
- the final policy and register hashes.

The live operator command may run only after the effective registers and
owner-only external encrypted state root exist.
