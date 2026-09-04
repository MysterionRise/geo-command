---
heist: codeguessr-poc-readiness
phase: the-sit-down
status: in-progress
timestamp: 2026-07-31T13:45:15+01:00
next-action: Draft Contract revision 4 with mandatory selected-blob Stack v2 ingestion
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md
---

## Don Change Request

The Don requires The Stack v2 to be a mandatory PoC source, not an optional
adapter. The Don has accepted the gated-access conditions but does not have
capacity to download the complete dataset.

The revised source split is exact:

- three provenance rounds discovered through GitHub commit search; and
- two language rounds discovered from streamed The Stack v2 metadata and
  retrieved as selected Software Heritage blobs only.

The preparer must not download the full Stack v2 metadata or source corpus. Each
selected Stack record must be revalidated against its pinned public GitHub
repository and revision before it can enter the generated local artifact.

The Stack v2 access, provenance, licence, removal-update, and sensitive-data
constraints are recorded by the official dataset card:
`https://huggingface.co/datasets/bigcode/the-stack-v2`.
