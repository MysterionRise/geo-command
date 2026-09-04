---
heist: codeguessr-poc-readiness
phase: the-sit-down
status: completed
timestamp: 2026-08-01T12:13:07Z
completed-at: 2026-08-01T12:25:28Z
contract-sha256: 4d7da085c8abffce8b83beeef79fa74617b1494d9666e39a1d30e4a7dfbedbef
next-action: Amend the execution plan through Resource Development before resuming The Hit
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-01-stack-v2-2-revision-observation.md
  - docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md
---

# Stack v2.2.0 Change Authorization

The provider's current card superseded Stack release `v2.1.0` with `v2.2.0`,
making the revision-7 live preflight fail closed as designed. The Don approved
the conservative migration approach: keep the exact two-source PoC, capacity
limits, selected-blob boundary, GitHub revalidation, local-only scope, and every
non-Stack requirement unchanged; update only the Stack release and immutable
Hub revision plus the freshness semantics required for a revision-addressed
metadata check.

The rejected alternatives are bypassing the latest-release check, continuing
to crawl the superseded release, following mutable `main`, or substituting
GitHub-only language rounds. Each contradicts the existing terms, deterministic
pin, or mandatory Stack boundary.

Consigliere re-review returned `APPROVE` after the Contract separated amendment
authorization from approval, defined the exact deterministic gate and terms
boundary, and directly cited this authorization. Contract revision 8 is signed;
the stale revision-7 execution plan remains a hard gate until Resource
Development replaces its lineage and Stack bindings.
