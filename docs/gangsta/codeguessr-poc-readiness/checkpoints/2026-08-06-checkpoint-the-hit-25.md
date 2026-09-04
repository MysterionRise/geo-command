---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-08-06T19:17:01Z
next-action: Obtain Don authorization for Contract revision 10 with the current immutable Stack v2.2.0 pin
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-026]
in-progress-wps: [WP-028]
pending-wps: [WP-025, WP-027, WP-029]
failed-wps: []
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/evidence/2026-08-06-stack-pin-live-boundary.md
---

# Provider Pin Removal Blocks the Live Smoke

Contract revision 9 completeness handling is accepted through source-adapter,
run-report, command, and captured full-pipeline replay evidence. The amended
preparation suite passed 323/323 and operator TypeScript passed before the live
attempt.

The live attempt failed closed during Stack preflight because the provider no
longer serves the signed historical revision. Current release `v2.2.0`, gate
invariants, terms markers, token access, and exact access to immutable revision
`e565caa3a78c2423bd374333a472b049eb090e47` were independently verified. No
artifact or run report exists.

FR-031 requires a new signed Contract revision for this provider change. The
narrow proposal is to retain release `v2.2.0` and every existing capacity,
selected-blob, admission, GitHub, warning, exact three/two, localhost, and
atomic-publication boundary while replacing only the unavailable Stack SHA and
its exact derived profile, access, capture, acknowledgement, and evidence
bindings. The Hit is paused pending the Don's authorization.
