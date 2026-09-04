---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T22:06:28Z
next-action: Don decision on Stack v2.2.0 Contract pin
completed-wps:
  - WP-001
  - WP-002
  - WP-003
  - WP-004
  - WP-005
  - WP-006
  - WP-007
  - WP-008
  - WP-009
  - WP-010
  - WP-011
  - WP-012
  - WP-013
  - WP-014
  - WP-015
  - WP-016
  - WP-017
  - WP-018
  - WP-019
  - WP-020
  - WP-021
  - WP-022
  - WP-023
  - WP-024
  - WP-026
pending-wps:
  - WP-025
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/stack-access.ts
  - ops/poc/prepare/stack-access.test.ts
  - ops/poc/prepare/testdata/captured-dependencies.ts
  - ops/poc/prepare/testdata/captured-responses.ts
---

# Resume Context

The first authorized combined live command failed closed with
`PREPARATION_FAILED`; no generated artifact or replacement was published.
Systematic stage isolation confirmed that the cached Hugging Face token is
well-formed, the standard AWS provider resolves from the shared credential
file, and the signed acknowledgement reaches the preparer.

The first live defect was an unpinned dataset-info request that compared the
moving repository head SHA to the signed historical revision. Hugging Face's
official revision-addressed dataset-info endpoint is
`/api/datasets/bigcode/the-stack-v2/revision/{revision}`. A focused Red test
expected that endpoint and failed against the unpinned request; the minimal
change is Green at 7/7 and the captured replay was updated without moving the
signed pin.

The current public card also changed its Markdown changelog table shape. A
focused Red reproduced `CARD_RESPONSE_MALFORMED` for the exact pipe table. The
parser now accepts either of the two exact known table forms while preserving
fail-closed terms and release checks. The 301/301 preparation suite is Green.

The remaining live preflight result is now the truthful
`StackAccessError RELEASE_MISMATCH`: the current card declares `v2.2.0` the
most recent usable release, while Contract revision 7 and the crawl profile pin
`v2.1.0` at `7408bfbcfd48e5833d62fd3dba48afd20d109473`. The current public dataset
head is `73b0f1021c37437752281cf0736003f0c987ccc1`, the gate remains usable, and
the terms require updating to the most recent usable release. The Hit must not
bypass that mismatch or silently amend the signed Contract.

The Don must explicitly authorize a Contract/profile change to Stack v2.2.0
and an immutable revision before WP-028 can resume. WP-025 follows the live
artifact so it can pin the actual artifact hash independently; WP-027 and
WP-029 then close the playable and verification chain.
