---
heist: codeguessr-poc-readiness
phase: resource-development
status: completed
timestamp: 2026-07-31T13:24:46Z
next-action: Await Don approval to proceed to The Hit
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md
  - docs/gangsta/codeguessr-poc-readiness/plans/2026-07-31-execution-plan.md
---

# Resume Context

The signed revision 7 Contract was decomposed into 29 work packages across
five non-overlapping territories with an estimated 58,900-token execution
budget. The plan preserves the controlled-acquisition boundary: WP-024 through
WP-027 remain incomplete until implemented and verified, and no readiness
credit is assigned to them in advance.

The heist is isolated on branch `codex/heist/codeguessr-poc-readiness` from
baseline commit `fd6f34cd0d8b4a344fb537e87256bc8f8e69837a`. Fresh baseline
verification passed the full test suite (1,935 Vitest tests plus the workspace
TAP test), typecheck, 37 accessibility tests, six performance tests, three
containment tests, 13 browser tests, and the production build. The browser
suite required execution outside the filesystem sandbox so its local server
could bind to `127.0.0.1:3000`.

The Stack v2 path uses a locked, uv-managed Python 3.12 worker with
`datasets==5.0.0` and `boto3==1.43.61`. It streams revision-pinned metadata and
downloads only selected Software Heritage blobs. The game and browser runtime
do not receive crawler dependencies or provider credentials.

Live verification in WP-028 will require the Don's existing Hugging Face gated
dataset token, Stack revision acknowledgement, Software Heritage S3
credentials, and optionally a GitHub token. Those secrets are not required to
approve the execution plan and must not be persisted in generated artifacts or
run reports.

No production implementation has started. The next gate is explicit Don
approval of the execution plan, after which The Hit may begin.
