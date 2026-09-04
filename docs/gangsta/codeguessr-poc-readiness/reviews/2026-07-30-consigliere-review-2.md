---
heist: codeguessr-poc-readiness
phase: the-sit-down
review: consigliere
revision-reviewed: 2
timestamp: 2026-07-30T22:59:12+01:00
verdict: APPROVE
---

# Consigliere Review 2: CodeGuessr Local Real-Round PoC Contract

## Assessment

Revision 2 is approved. All five findings from Review 1 are resolved.

## Findings

None.

## Resolution Evidence

1. Source, author, licence, SHA, and cross-URL semantics are concrete and
   fixture-specifically testable. — Contract revision 2:
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:30-41`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:84-98`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:364-367`
2. Experimental-shape rejection and approved-gate non-activation are normative
   and accepted. — Contract revision 2:
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:69-78`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:215-221`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:371-373`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:391-395`
3. Only root activation changes; synthetic fallback, approval lineage,
   catalogue selection, and approved reveal semantics remain protected. —
   Contract revision 2:
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:168-181`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:386-390`
4. Pre-answer attribution prohibition is unconditional. The authorized browser
   reveal has one exact allowlist with attribution confined to a single string.
   — Contract revision 2:
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:42-50`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:116-146`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:376-381`
5. Material decisions cite durable file-and-line sources, including provenance
   semantics and Constitution rules. — Contract revision 2:
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:147-156`;
   `docs/gangsta/codeguessr-poc-readiness/specs/2026-07-30-contract.md:331-358`

## Required Revisions

None.

## Advisory Notes

Manual metadata accuracy and rights interpretation remain consciously accepted
PoC risks, with no authenticated-source or publication-readiness claim. The
Contract remains minimal, contains no code or pseudocode, preserves WP-024
through WP-027 as incomplete with no evidentiary credit, and does not
reintroduce the rejected production architecture.
