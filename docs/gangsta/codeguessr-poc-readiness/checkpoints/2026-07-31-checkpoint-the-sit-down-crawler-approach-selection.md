---
heist: codeguessr-poc-readiness
phase: the-sit-down
status: in-progress
timestamp: 2026-07-31T12:04:00+01:00
next-action: Draft Contract revision 3 for crawler Approach B
artifacts:
  - docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md
---

## Revised Approach Selection

The Underboss presented three preparation architectures after the Don clarified
that ingestion and a crawler are required:

- Approach A: a seeded local crawler over operator-supplied repository URLs;
- Approach B: a search-driven GitHub crawler that discovers repositories and
  commits from bounded query profiles, then freezes local fixtures; and
- Approach C: an experimental adapter over the existing controlled acquisition
  engine.

The Don selected Approach B.

The previously selected direct root demo remains unchanged. The revised
Contract must add search, crawling, ingestion, and fixture generation before
play while keeping GitHub access out of gameplay and keeping the output
explicitly local, unreviewed, and non-beta.
