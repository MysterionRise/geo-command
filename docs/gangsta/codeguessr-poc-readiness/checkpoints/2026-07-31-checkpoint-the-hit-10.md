---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-07-31T21:27:55Z
next-action: Continue Hit
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
pending-wps:
  - WP-024
  - WP-025
  - WP-026
  - WP-027
  - WP-028
  - WP-029
failed-wps: []
artifacts:
  - ops/poc/prepare/index.ts
  - ops/poc/prepare/command.test.ts
  - ops/poc/prepare/language-rounds.ts
  - ops/poc/prepare/language-rounds.test.ts
  - ops/poc/prepare/model-run.ts
  - ops/poc/prepare/run-report.test.ts
  - package.json
  - README.md
---

# Resume Context

WP-023 is accepted. `pnpm prepare:poc` is one no-argument, operator-only local
command that runs access preflight, GitHub discovery, Stack metadata streaming,
selected Software Heritage blob reads, immutable GitHub revalidation, exact
round generation, redacted report creation, and atomic artifact replacement.
It does not start or enter the game dependency graph.

The command uses one cumulative capacity meter, provider-scoped credentials,
bounded capture/replay, and final snapshot binding. Provenance selection scans
the ordered pool until three unique candidates containing both recorded marker
outcomes exist, then returns the earliest valid exact three-member subset.
Language selection independently preserves one Python and one TypeScript round,
with screening and revalidation before a selected blob lease is accepted.

The Capo's final re-audit accepted WP-023 after explicit regressions for
same-outcome overflow and duplicate-then-replacement selection. Fresh evidence
is 18/18 command tests, 290/290 preparation tests across 20 files, recursive
typechecking, a clean `git diff --check`, and the workspace TAP check plus
2,228/2,228 Vitest tests across 82 files. The README preparation section also
passes the 20/20 claims audit and documents the exact command, Stack revision
acknowledgement, and accepted Hugging Face, GitHub, and AWS environment/provider
stores ahead of the final WP-029 documentation sweep.

One immediately preceding full sweep exposed a pre-existing nondeterministic
interleaving assumption in the external audit-chain concurrency test. The
focused test and fresh complete rerun passed without code changes; no credit is
claimed for resolving that separate engineering debt.

WP-024 may now build the server-only generated-artifact authority. WP-026 may
independently prove captured two-source command replay.
