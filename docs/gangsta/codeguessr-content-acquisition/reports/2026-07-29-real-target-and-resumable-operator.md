---
heist: codeguessr-content-acquisition
phase: the-hit
territory: real-content-poc-prerequisite
status: accepted
timestamp: 2026-07-29T13:18:00+01:00
advanced-wps: [WP-024, WP-025]
completed-wps: []
---

# Real Target and Resumable Operator Report

## Accepted Outcomes

- The first real-content target is the MIT-licensed public repository
  `mysterionrise/encrypted-information-retrieval`, pinned to commit
  `8f8183fb80fb90165e321d96df7a3a5f4ccd445e` and subtree `src`.
- The provenance candidate is reconstructed from the pinned parent and child
  blobs for `src/encrypted_ir/fpe.py`. It records the exact
  `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` trailer and makes
  only the narrow `NAMED_MODEL_RECORDED` claim.
- Project-controlled qualification and vendor-document evidence are stored
  under `docs/gangsta/codeguessr-content-acquisition/evidence/`.
- Review-ready repository-admission and attribution-marker policies contain
  the exact target, subtree, purposes, evidence hashes and marker rule.
  Their canonical SHA-256 hashes are:
  - repository admission:
    `e8cb7f52181a2de142e45ea542e52e1bef1210138acdffb10f7f2794390b09d0`;
  - attribution markers:
    `642b99c1809a3a6fb37271b8204aa63dc825c2225aeab7a1c0819eae947ec9f4`.
- GitHub repository identity accepts GitHub's case-preserving `full_name` only
  when it is ASCII-valid and lowercase-equivalent to the project-canonical
  repository identity.
- Validated GitHub rate limits create an encrypted, metadata-safe paused
  checkpoint. Resume is explicit, honors the not-before instant, and
  revalidates the request, exact policy entries, registers, operator, tool,
  checkpoint and stored-object identities before network access.
- Every verified safe tree/blob is durably cached with its Git identity and
  encrypted snapshot identity. Resume deterministically replays authenticated
  cached objects and does not refetch completed object endpoints.
- `RUN_STARTED`, `RUN_PAUSED`, `RUN_RESUMED` and downstream events share one
  stable logical run ID. Resume does not emit a second `RUN_STARTED`.
- Secret or unsafe blobs are screened before cache persistence. Every
  non-rate-limit terminal outcome removes all raw objects created by that
  logical run, including objects created before a pause and the accepted
  licence snapshot. Pre-existing reused objects are preserved.

## TDD and Independent Audit

RED cases established the original gaps: safe restart without object reuse,
discontinuous lifecycle run IDs, missing exact policy-entry bindings, retained
pre-pause objects after resumed rejection, and command-boundary cleanup gaps.

Corrective tests cover mid-traversal pause/resume without refetch, early and
tampered resume rejection, stable lifecycle identity, policy-entry mismatch,
secret non-retention, late completion-audit rollback, pause-to-terminal
rollback, preservation of pre-existing objects, failed pause persistence,
failed `RUN_PAUSED` audit and resumed-source rejection.

The final independent audit reports no Critical or Important runtime findings.
Its only residual Minor observation is that additional direct failure-injection
tests could cover resume state/audit opening, duplicate owned snapshots and
deletion-store failures. The implemented cleanup paths were inspected and
judged correct.

Final root verification:

- acquisition/operator focus: 20/20 files and 188/188 tests pass;
- workspace TAP and Vitest: 61/61 files and 1,935/1,935 tests pass;
- recursive workspace and operator TypeScript typecheck: pass;
- production game build: pass;
- acquisition containment: 3/3 pass;
- diff hygiene: pass.

## Residual Boundary

This is an accepted implementation and real-target qualification prerequisite,
not a live WP-024/WP-025 acquisition or playable rehearsal.

The approved-policy and operator-authorization registers remain deliberately
non-effective. A live run still requires real named approvals, an authorized
operator identity, and a project-approved encrypted external state root.

Promotion and playable activation still require the Contract's independent
four-person review. No real draft, promotion, activation or real-content
playable round is claimed by this report.
