---
heist: codeguessr-poc-readiness
phase: the-sit-down
reviewed-at: 2026-07-31T12:56:18Z
contract-revision: 4
verdict: REJECT
reviewer: Consigliere
---

# Consigliere Review 3

## Verdict

REJECT

## Findings

1. **HIGH — Provenance lineage did not mechanically bind the parent source.**
   The record required a parent commit and parent/child blob identities, but not
   the parent tree identity, same-path parent and child tree membership, or the
   parent raw-content hash. Changed-line reconstruction alone could not prove
   those tree bindings.
2. **HIGH — Byte-identical replay conflicted with run-specific fields.** The
   artifact recorded an observation time and crawl-run identifier while
   promising byte-identical replay from only the profile and captured provider
   responses.
3. **HIGH — “Most recent usable revision” lacked a mechanical authority.** The
   Contract did not distinguish Stack release `v2.1.0` from a Hugging Face
   repository commit, did not pin the latter, and did not define how removal-
   driven supersession would be detected or handled.
4. **HIGH — Cross-host credential containment was incomplete.** Allowed provider
   redirects did not require origin credentials to be stripped, credentials to
   be scoped to one host, or signed URLs to be excluded from diagnostics.
5. **MEDIUM — Rate-limit handling was unbounded.** The Contract defined neither
   maximum retries nor maximum wait and did not connect exhaustion to atomic
   preservation of the existing artifact.

## Required revisions

1. Bind both parent and child commit, tree, same-path blob, and raw-content
   identities for provenance reconstruction.
2. Define deterministic replay inputs or separate deterministic artifact bytes
   from run-specific metadata.
3. Pin an exact Stack release and immutable Hugging Face revision, and define a
   testable freshness/removal authority and update procedure.
4. Require per-host credential scoping, cross-host authorization stripping, and
   signed-URL redaction.
5. Bound retry attempts and total wait while preserving atomic failure behavior.

## Advisory

The mandatory source split, selected-blob-only capacity limits, Stack-to-GitHub
revalidation, honest answer semantics, gameplay isolation, lack of WP-024–027
credit, and no-code Sit-Down boundary were otherwise accepted as proportionate
to the local PoC.
