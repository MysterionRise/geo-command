# Claude handoff: CodeGuessr local real-round PoC

## Mission

Continue the existing local-only proof of concept until one preparation run
produces exactly five real rounds: three GitHub provenance rounds and two Stack
language rounds. The goal is demo testing on one machine, not public play.

## Read first

Treat these as the durable source of truth, in this order:

1. `docs/gangsta/codeguessr-poc-readiness/checkpoints/2026-09-04-checkpoint-handoff.md`
2. `docs/gangsta/codeguessr-poc-readiness/reviews/2026-09-04-handoff-audit.md`
3. `docs/gangsta/codeguessr-poc-readiness/specs/2026-08-15-contract-revision-11-signed.md`
4. `docs/gangsta/codeguessr-poc-readiness/plans/2026-07-31-execution-plan.md`
5. `README.md`

Verify the signed Contract before relying on it:

```bash
shasum -a 256 docs/gangsta/codeguessr-poc-readiness/specs/2026-08-15-contract-revision-11-signed.md
```

Expected SHA-256:
`3acc586d8fb479e6edfd2dd43e9f38ed5d8d6268ee5b025b449d3a564b32fe41`.

## Current state

- Branch: `codex/heist/codeguessr-poc-readiness`.
- Baseline before this work: `fd6f34cd0d8b4a344fb537e87256bc8f8e69837a`.
- The crawler, Stack worker, five-round artifact schema, server-only game
  authority, tests, and operator command exist.
- The root route still uses the synthetic rehearsal catalogue.
- The generated real-round artifact and live run report are intentionally
  absent.
- Stack preflight passes, but the first GitHub Search request currently stops
  with `TransportError: UNSUPPORTED_STATUS`.
- The last diagnostic made one provider flow with zero retries and did not read
  or disclose the response body.
- The Python Stack workers do not yet enforce the signed endpoint, redirect,
  network-byte, request, credential-forwarding, and temporary-disk ceilings.
- The orchestration writes a success report before artifact publication, so a
  failed publication can leave a report that incorrectly says `SUCCESS`.

This is a resumable engineering handoff, not a completed or production-ready
real-data demo.

## Non-negotiable boundaries

- Localhost only; no deployment or public players.
- Exactly five automatically prepared rounds with a three/two source split.
- No human content-review workflow for this PoC.
- Public open-source repositories only, with licence and recorded-author data.
- The Stack v2 release remains `v2.2.0` at immutable revision
  `e565caa3a78c2423bd374333a472b049eb090e47`.
- Stream metadata and retrieve only selected blobs. Never download the complete
  dataset, a complete language shard, or repository archives.
- Crawling happens before play. Gameplay uses the frozen local artifact and
  performs no network access.
- Do not loosen capacity, completeness, validation, identity, credential,
  atomic-publication, or fail-closed rules without revising the signed Contract
  first.
- Never log or commit tokens, provider bodies, contact data, private email,
  source excerpts from failed diagnostics, or standard credential-store files.

## Immediate next steps

Before another full live run, use failing regression tests to:

1. Enforce and prove the signed Stack network, credential, and temporary-disk
   limits around both Python workers.
2. Make report and artifact publication transactional, or roll the report back
   when artifact publication fails.

These are implementation defects against the existing signed Contract; do not
weaken the Contract to accommodate them.

The next external action requires explicit operator authorization. Perform one
GitHub-only request with no retry and no response-body read, reporting only:

- Numeric HTTP status.
- Whether authentication was supplied.
- Whether the rate limit is exhausted.
- Whether a retry delay is present.

Use that evidence to establish root cause before proposing any code change. Do
not rerun the complete preparation command until the blocker is understood and
the signed Contract permits the response.

## Commands

Offline preparation verification:

```bash
pnpm exec vitest run ops/poc/prepare
pnpm exec tsc --noEmit -p ops/tsconfig.json
uv run --project ops/poc/stack python -m unittest discover -s ops/poc/stack
```

Complete workspace verification:

```bash
pnpm test
pnpm typecheck
pnpm test:a11y
pnpm test:performance
pnpm test:e2e
pnpm exec node --test tests/containment/acquisition-boundary.test.mjs
pnpm --filter @codeguessr/game build
```

Live preparation, only after authorization and root-cause resolution:

```bash
pnpm prepare:poc
```

The command reads credentials from the shell/provider-standard stores. Do not
place credential values in commands saved to documentation or version control.

## Completion boundary

Do not call the real-data PoC runnable until all of the following are true:

1. Preparation exits successfully and emits its completion marker.
2. Both Python workers enforce and test the signed network and disk boundaries.
3. Report/artifact publication cannot leave an orphan success report.
4. The generated artifact contains exactly three provenance and two language
   fixtures and passes server-side validation.
5. Artifact and run-report hashes, source split, warning/completeness state,
   and capacity counts are independently verified without leaking content.
6. The root route consumes the validated server-only authority.
7. Browser, build, accessibility, performance, containment, unit, and type
   checks pass freshly.
8. The durable checkpoint and README are updated with the actual evidence.

Preserve unrelated worktree changes, and do not stage, rewrite, or delete them
unless their ownership and purpose have been verified.
