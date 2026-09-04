---
heist: codeguessr-poc-readiness
date: 2026-07-29
status: approved
approved-at: 2026-07-30T21:09:15+01:00
approval: "Don selected option 1: approve dossier and run The Grilling"
---

# Reconnaissance Dossier: CodeGuessr PoC Readiness

## Objective

Document a reproducible local demo, determine how close CodeGuessr is to a
proper runnable proof of concept, and identify the smallest evidence-backed
improvement sequence. The Don requested a root README plus continued planning
through the Gangsta process.

This dossier treats a “proper runnable PoC” as the already contracted
real-content non-public rehearsal: one approved language round and one approved
recorded-agent-participation round completing through the real catalogue,
answer, reveal, and attribution paths. That is the acceptance boundary of
WP-027, and it explicitly does not claim controlled-beta corpus readiness.
— Source:
`docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:444-456`

## Codebase Overview

- The repository is a private pnpm monorepo pinned to Node `20.18.0` and pnpm
  `9.15.9`. — Sources: `package.json:2-8`;
  `pnpm-workspace.yaml:1-3`
- `apps/game` is a Next.js `15.1.2`/React `19.0.0` application with `dev`,
  `build`, and `start` commands. — Source: `apps/game/package.json:5-21`
- The `/` route mounts a five-round rehearsal arcade and a server-authorized
  reveal action. — Sources: `apps/game/src/app/page.tsx:1-13`;
  `apps/game/src/app/actions.ts:1-10`
- The active catalogue is deliberately the synthetic default because the
  project rehearsal register is empty and catalogue selection receives no
  approved input. — Sources:
  `apps/game/src/demo/rehearsal-catalogue.ts:22-28`;
  `apps/game/src/demo/rehearsal-catalogue.ts:221-233`;
  `apps/game/src/demo/rehearsal-approval-register.ts:41-49`
- The synthetic demo has three recorded-provenance rounds and two language
  rounds. It supports two clues, fixed clue-penalty scoring, evidence-backed
  reveal, completion, and replay. — Sources:
  `apps/game/src/demo/demo-game.ts:23-142`;
  `apps/game/src/demo/demo-game.ts:157-197`;
  `apps/game/src/components/arcade/arcade-shell.tsx:223-278`
- Answers and protected reveal data are not part of the public mode contract;
  the server action authorizes reveal data after an answer. — Sources:
  `apps/game/src/app/actions.ts:1-10`;
  `apps/game/test/demo-game.test.ts:16-38`;
  `tests/containment/acquisition-boundary.test.mjs:81-99`
- Domain, content/evidence, measurement, and test-support responsibilities are
  separated into workspace packages. — Sources:
  `packages/domain/src/index.ts:1-6`;
  `packages/content/src/index.ts:1-71`;
  `packages/measurement/src/index.ts:1-2`;
  `packages/test-support/src/index.ts:1`
- Content acquisition is available only through a Node-only package subpath and
  root operator command; the browser and default export conditions explicitly
  resolve to `null`. — Sources: `packages/content/package.json:6-12`;
  `package.json:10-16`

## Existing Test Coverage

The repository defines stable commands for workspace/unit, type, accessibility,
performance, browser, containment, and production-build verification. —
Sources: `package.json:10-16`; `apps/game/package.json:5-9`;
`playwright.config.ts:5-49`

### Fresh 2026-07-29 verification

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS with the pinned Node/pnpm toolchain |
| `pnpm test` | First run: 1,934 pass/1 fail; final rerun: 1,935/1,935 pass, plus workspace TAP |
| Four focused `audit.test.ts` reruns | 4/4 files and 16/16 tests pass |
| `pnpm typecheck` | PASS across all workspace packages and `ops` |
| `pnpm test:a11y` | 37/37 PASS |
| `pnpm test:performance` | 6/6 PASS |
| `pnpm test:e2e` | 13/13 PASS against the real local Next server |
| Acquisition containment test | 3/3 PASS |
| Production game build | PASS; `/` generated successfully |

— Source:
`docs/gangsta/codeguessr-poc-readiness/evidence/2026-07-29-fresh-verification.md:11-83`

The first full unit run exposed a schedule-dependent audit-concurrency
expectation. The test launches two appends and requires exactly one success.
The sink loads the current chain before using exclusive creation for the next
sequence file. If the second append observes the chain after the first append
has completed, it can validly choose the following sequence and both calls
succeed; when both observe the same head, one conflicts. The current test does
not force one interleaving, which explains the observed fail/pass variability.
No fix was attempted during reconnaissance. — Sources:
`docs/gangsta/codeguessr-poc-readiness/evidence/2026-07-29-fresh-verification.md:23-46`;
`docs/gangsta/codeguessr-poc-readiness/evidence/2026-07-29-fresh-verification.md:85-98`;
`packages/content/src/acquisition/operator/audit.test.ts:94-126`;
`packages/content/src/acquisition/operator/audit.ts:191-228`;
`docs/gangsta/codeguessr-content-acquisition/reports/2026-07-27-secure-operator-operations.md:23-31`

Coverage is deep for rules and boundaries, but a passing local support gate is
not genuine controlled-beta accessibility evidence. The parent Heist still
records the absence of complete deployed flows and real current browser,
mobile, VoiceOver/NVDA, and qualified-reviewer evidence. — Source:
`docs/gangsta/code-guessing-startup/checkpoints/2026-07-13-checkpoint-the-hit.md:287-299`

## Dependencies

- Production UI: Next `15.1.2`, React `19.0.0`, React DOM `19.0.0`. — Source:
  `apps/game/package.json:11-21`
- Toolchain: TypeScript `5.7.2`, Vitest `2.1.8`, Playwright `1.49.1`, and
  `tsx` `4.23.1`. — Source: `package.json:18-24`
- Versions are exact-pinned. No inspected evidence identifies a dependency
  upgrade as a current PoC blocker. — Sources: `package.json:18-24`;
  `apps/game/package.json:11-21`
- Test PostgreSQL is defined in `compose.test.yaml`, but the current local demo
  quick start and verified game flow do not require it. — Sources:
  `compose.test.yaml:1-16`; `apps/game/src/app/page.tsx:1-13`

## Relevant Ledger Entries

No standalone `docs/gangsta/constitution.md`, `docs/gangsta/insights/`, or
`docs/gangsta/fails/` entries exist in the inspected workspace. Binding
commandments and negative constraints are therefore read from the approved
Revision 7 Contract.

### Applicable Insights

- A runnable synthetic five-round demo is already accepted for local product
  feedback. It intentionally adds no authentic corpus, deployment, staffing,
  or beta-readiness authority. — Source:
  `docs/gangsta/code-guessing-startup/checkpoints/2026-07-13-checkpoint-the-hit.md:297-297`
- The public GitHub target, immutable Git identities, content screening, and
  changed-line reconstruction have been smoke-verified without invoking or
  weakening production authorization. — Source:
  `docs/gangsta/codeguessr-content-acquisition/reports/2026-07-29-public-smoke-crawl.md:25-60`
- External encrypted operator storage is mechanically prepared; the remaining
  live-run blocker is real review and authorization. — Source:
  `docs/gangsta/codeguessr-content-acquisition/reports/2026-07-29-operator-storage-preflight.md:12-44`

### Applicable Negative Constraints

- NEVER market recorded provenance as AI detection or infer human-only
  authorship from a missing marker. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-345`
- NEVER publish without complete content-eligibility evidence or expose
  restricted evidence/unreleased answers in public artifacts, telemetry, or
  logs. — Source:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-345`
- NEVER let acquisition automation, licence metadata, placeholders, or agents
  impersonate required human approval. — Sources:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:287-295`;
  `docs/gangsta/codeguessr-content-acquisition/evidence/2026-07-29-control-approval-packet.md:23-53`
- NEVER place acquisition credentials, raw snapshots, or operator capabilities
  in the gameplay/browser boundary. — Sources:
  `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:328-345`;
  `tests/containment/acquisition-boundary.test.mjs:60-99`

## Current Heist State

The active `codeguessr-content-acquisition` Heist remains in The Hit with
WP-001 through WP-023 complete and WP-024 through WP-027 pending. No work
package is recorded as failed. — Source:
`docs/gangsta/codeguessr-content-acquisition/checkpoints/2026-07-27-checkpoint-the-hit.md:1-9`

The remaining contracted path is:

1. WP-024: one controlled real language draft, remaining
   `DRAFT_REVIEW_REQUIRED`. — Source:
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:405-416`
2. WP-025: one controlled real recorded-agent-participation draft, remaining
   `DRAFT_REVIEW_REQUIRED`. — Source:
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:418-429`
3. WP-026: four distinct qualified human reviewers and immutable promotion. —
   Source:
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:431-442`
4. WP-027: both real rounds through the playable flow plus the complete final
   sweep. — Source:
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:444-456`

## Risks and Unknowns

1. **Audit append concurrency — HIGH before live acquisition.** The fresh
   verification observed a schedule-dependent mismatch between the concurrent
   append test expectation and sink behavior. The chain remained valid, but
   the required conflict semantics are not deterministic. — Sources:
   `packages/content/src/acquisition/operator/audit.test.ts:94-126`;
   `packages/content/src/acquisition/operator/audit.ts:191-228`
2. **External approval availability — HIGH.** Each effective policy needs a Don
   approval and a different Rights/Safety Reviewer approval. Operator
   authorization needs a Release Operator approval and a different Security
   Reviewer approval. No placeholder or agent may satisfy either gate. — Source:
   `docs/gangsta/codeguessr-content-acquisition/evidence/2026-07-29-control-approval-packet.md:23-53`
3. **Four-person review availability — HIGH.** Each real item needs four
   distinct qualified reviewers before promotion. — Source:
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:431-442`
4. **Status confusion — MEDIUM.** The UI is fully playable, but it selects the
   synthetic default; a visitor could mistake implementation depth for
   authentic-content or beta readiness. — Sources:
   `apps/game/src/demo/rehearsal-catalogue.ts:22-28`;
   `apps/game/src/demo/rehearsal-catalogue.ts:221-233`
5. **Controlled-beta distance — HIGH if treated as the immediate target.** The
   full gate requires exactly 70 scheduled and 15 reserve authentic items,
   alongside unresolved staffing/provider/accessibility evidence. — Sources:
   `packages/content/src/inventory/corpus-readiness.ts:249-280`;
   `docs/gangsta/code-guessing-startup/checkpoints/2026-07-13-checkpoint-the-hit.md:293-299`
6. **Timeline — UNKNOWN.** Engineering prerequisites are close, but elapsed time
   cannot be estimated responsibly until real approvers and four qualified
   reviewers are identified. — Sources:
   `docs/gangsta/codeguessr-content-acquisition/evidence/2026-07-29-control-approval-packet.md:23-53`;
   `docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:431-442`

## Recommended Scope

The smallest credible improvement sequence is:

1. Accept the new root README as the current onboarding and status boundary.
2. Resolve the audit append-concurrency contract with TDD, independent review,
   and a fresh complete sweep before any live operator run.
3. Finish the already authorized content-acquisition Heist in its contracted
   order: real control approvals, WP-024/WP-025 drafts, WP-026 review/promotion,
   and WP-027 playable rehearsal.
4. Run Laundering and close the acquisition Heist.
5. Only then open a new reconnaissance phase for deployment, broader product
   features, content scale, or controlled-beta operations.

Do not spend the current critical path on dependency upgrades, new game modes,
accounts, leaderboards, public acquisition endpoints, or controlled-beta
corpus scale. Those changes are outside the remaining signed PoC scope. —
Sources:
`docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md:312-345`;
`docs/gangsta/codeguessr-content-acquisition/plans/2026-07-27-execution-plan.md:458-467`
