---
heist: codeguessr-poc-readiness
phase: reconnaissance
evidence-class: fresh-local-verification
date: 2026-07-29
status: pass-with-known-debt
---

# Fresh Local Verification

## Scope and Toolchain

The verification ran from the repository root with the project-pinned Node
`20.18.0` and pnpm `9.15.9`. The default shell initially resolved Node
`16.16.0`, which pnpm rejected as unsupported. All project commands below
therefore placed the pinned Node installation first on `PATH`.

The final `pnpm install --frozen-lockfile` completed successfully for all six
workspace projects with the lockfile unchanged. The initial offline attempt
stopped because the local store lacked the `@swc/helpers` tarball; the completed
install used the approved dependency-install command.

## Workspace and Unit Tests

The first `pnpm test` invocation passed the workspace TAP check but returned
exit code 1 from Vitest:

- test files: 60 passed, 1 failed;
- tests: 1,934 passed, 1 failed;
- failure:
  `packages/content/src/acquisition/operator/audit.test.ts:110`;
- observed assertion: expected one fulfilled append but received two.

Four independent focused invocations of
`pnpm exec vitest run packages/content/src/acquisition/operator/audit.test.ts`
then passed. Each invocation reported 1/1 file and 4/4 tests passing, for 16
focused test executions in total.

A fresh complete `pnpm test` rerun returned exit code 0:

- workspace TAP: 1/1 passed;
- Vitest files: 61/61 passed;
- Vitest tests: 1,935/1,935 passed.

This pass does not erase the first result. The concurrency behavior remains
known pre-live-run engineering debt.

## Type, Accessibility, Performance, and Containment

`pnpm typecheck` returned exit code 0. TypeScript passed for the game, domain,
content, measurement, and test-support packages plus the operator project.

`pnpm test:a11y` returned exit code 0 with 37/37 checks passing. These are
support/evidence-gate checks; they are not a claim of operational controlled-beta
accessibility evidence.

`pnpm test:performance` returned exit code 0 with 6/6 checks passing. These are
performance-gate tests; they are not a claim of deployed operational
measurements.

`pnpm exec node --test tests/containment/acquisition-boundary.test.mjs` returned
exit code 0 with 3/3 checks passing:

- browser and gameplay dependency surfaces excluded acquisition capabilities;
- public attribution entered the browser only through authorized reveal;
- production artifacts, manifests, telemetry, and routes contained no
  acquisition runtime.

## Production Build and Browser Flow

`pnpm --filter @codeguessr/game build` returned exit code 0. Next.js `15.1.2`
compiled successfully, checked types, generated 4/4 static pages, and reported
the `/` route at 1.22 kB with 107 kB first-load JavaScript.

The first sandboxed `pnpm test:e2e` attempt failed before tests because the
environment denied binding `127.0.0.1:3000` with `EPERM`. The command was rerun
with localhost-binding permission and returned exit code 0:

- Playwright: 13/13 scenarios passed using one worker;
- the five-round synthetic arcade completed and restarted;
- provenance, language, privacy, accessibility, reduced-viewport, and
  no-JavaScript scenarios passed;
- elapsed Playwright run time: 11.6 seconds.

## Audit-Concurrency Diagnosis

The concurrent test starts two different appends and expects exactly one to
succeed. Each append loads the current chain, derives the next sequence name,
and then uses exclusive creation for that sequence file. If both calls observe
the same chain head, one exclusive create conflicts. If one call observes the
chain after the other has completed, it can select the following sequence and
both calls succeed.

The code therefore permits a schedule-dependent outcome while the test asserts
one fixed outcome without forcing the relevant interleaving. No source or test
change was made during reconnaissance. The required append-concurrency contract
must be made deterministic and independently reviewed before a live acquisition
run.
