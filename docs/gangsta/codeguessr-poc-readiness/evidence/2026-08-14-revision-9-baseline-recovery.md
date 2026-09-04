---
heist: codeguessr-poc-readiness
evidence: revision-9-baseline-recovery
observed-at: 2026-08-14T15:20:12Z
expected-sha256: c1600425ab6f568b392d2e24234fe272666d659d3e3b7cc9b6de6320b18fd685
observed-sha256: c1600425ab6f568b392d2e24234fe272666d659d3e3b7cc9b6de6320b18fd685
---

# Signed Revision 9 Baseline Recovery

The signed revision-9 Contract had been amended in place before its exact bytes
were preserved as a separate file. The durable operation record retained both
the exact revision-9 signing patch and the exact revision-10 amendment patch.
Reversing only those recorded amendments, plus the citation-range and line-wrap
edits made after the first revision-10 review, produced a candidate whose
SHA-256 exactly equals the signed hash recorded at
`docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-08-06-checkpoint-the-sit-down-github-incomplete.md:38-40`.

Those verified bytes are now preserved at
`docs/gangsta/codeguessr-poc-readiness/specs/2026-08-06-contract-revision-9-signed.md`.
An immediate post-copy comparison was byte-identical and the preserved file
again hashed to
`c1600425ab6f568b392d2e24234fe272666d659d3e3b7cc9b6de6320b18fd685`.

The preserved file is historical evidence and remains unchanged, including its
original citation ranges. Citation-bound corrections belong only to the active
revision-10 draft.
