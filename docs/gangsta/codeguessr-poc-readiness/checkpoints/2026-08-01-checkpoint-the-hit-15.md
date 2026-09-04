---
heist: codeguessr-poc-readiness
phase: the-hit
status: in-progress
timestamp: 2026-08-01T13:48:39Z
next-action: Execute WP-028 combined live smoke at the signed Stack v2.2.0 pin
completed-wps: [WP-001, WP-002, WP-003, WP-004, WP-005, WP-006, WP-007, WP-008, WP-009, WP-010, WP-011, WP-012, WP-013, WP-014, WP-015, WP-016, WP-017, WP-018, WP-019, WP-020, WP-021, WP-022, WP-023, WP-024, WP-026]
in-progress-wps: [WP-028]
pending-wps: [WP-025, WP-027, WP-029]
failed-wps: []
artifacts:
  - ops/poc/profiles/local-real-rounds.v1.json
  - ops/poc/prepare/stack-access.ts
  - ops/poc/stack/stream_metadata.py
  - apps/game/src/demo/local-real-experiment.server.ts
  - apps/game/src/demo/local-real-experiment-artifact.server.ts
  - apps/game/src/demo/local-real-experiment-domain.server.ts
  - apps/game/src/demo/local-real-experiment-source.server.ts
  - apps/game/src/demo/local-real-experiment-validation.server.ts
---

# Stack v2.2.0 Amendment Accepted

Underboss verification passed 301/301 preparation tests, 27/27 focused and
related game-authority tests, 16/16 Stack Python tests, and the full workspace
plus operator typecheck. No old operative Stack pin remains outside historical
documentation, and `git diff --check` is clean.

WP-024's inherited 632-line authority was split through a structural
Red-Green-Refactor cycle. The resulting five server-only production modules are
244, 89, 139, 87, and 232 lines. A second Red-Green cycle caught and fixed a
canonical-serialization containment regression; the public factory API and
fail-closed reveal behavior remain covered.

WP-028 may now make the authorized real provider calls. WP-025 remains blocked
until the live artifact exists and its hash is independently established.
