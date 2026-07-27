---
heist: codeguessr-content-acquisition
phase: the-sit-down
review: 1
date: 2026-07-27
subject-sha256: a20cf4b4643263493800196724962f827b554c8f2e1365eeace23454c9401a92
verdict: REJECT
status: superseded-by-amendment-revision-2
---

# Consigliere Assessment

**Subject:** Programme Revision 7 draft amendment, SHA-256 `a20cf4b4643263493800196724962f827b554c8f2e1365eeace23454c9401a92`

**Verdict:** REJECT

## Findings

1. **CRITICAL — The amendment still inherits the prohibition it intends to remove.** Revision 7 authorizes offline GitHub acquisition, but its precedence rule leaves every unnamed Revision 6 acceptance criterion and negative constraint binding. Revision 6 AC-014, `OOS-ingestion`, and the Out-of-Scope section explicitly prohibit live GitHub ingestion/scraping. H-001 Revision 1 also excludes live scraping. These clauses were not listed as superseded.
2. **HIGH — Child-contract lineage is internally inconsistent.** Revision 7 required only H-001, H-003, and H-004 Revision 2 while declaring H-002, H-005, and H-006 unchanged. Inherited FR-035 and AC-015 require every child to cite the exact programme revision/hash, and H-006 inherits all parent acceptance and negative-scope constraints.
3. **HIGH — The active provenance source regime is ambiguous.** The revised prompt concerns an exact code change, but standalone model-output eligibility was not explicitly made inactive or transformed.
4. **HIGH — Deleted and renamed-path semantics are undefined.** The common record required one child path/blob while acceptance included deleted and renamed fixtures without an explicit accepted/rejected outcome.
5. **HIGH — Transport failure semantics are not sufficiently fail-closed.** Any 403 was resumable even though 403 can mean a non-rate-limit authorization failure, and the truncation rule did not reject every truncated tree response.
6. **MEDIUM — The policy trust root uses undefined policy classes.** License and screening policy hashes were required without separate definitions or an explicit statement that they belong to the Repository Admission Policy. Drafts did not bind the exact register version/entry, and policy validity time was undefined.
7. **MEDIUM — Acquisition time and operator authority are not trustworthy enough.** A caller-controlled time affected retention without an authoritative receipt time, and named-operator authorization, least privilege, and append-only acquisition audit evidence were not explicit.
8. **LOW — Verified strengths.** All registered hashes matched. The draft preserved the GeoGuessr-for-code frame, separated named-model from generic-agent evidence, reconstructed provenance from immutable blobs, kept rights decisions human-controlled, defined encrypted external quarantine, isolated operator dependencies, preserved measurement candidate count, and required two real non-public rehearsals.

## Required Corrections

1. Replace the Revision 6 ingestion prohibition explicitly and require H-001 Revision 2 to replace its equivalent.
2. Resolve all six child lineages through revisions or signed compatibility/revalidation evidence.
3. Freeze one active provenance source regime and define standalone model-output status.
4. Reject deleted and renamed paths in V1 or define complete dual-path semantics.
5. Pause only validated rate-limit responses and reject every truncated tree response.
6. Define one coherent policy taxonomy, exact register binding, and authoritative UTC validity.
7. Separate reproducible caller time from authoritative receipt/retention time and require named least-privilege operators with append-only audit evidence.
8. Re-run the complete integrity review after normative correction.

## Citations

- Rejected draft SHA-256: `a20cf4b4643263493800196724962f827b554c8f2e1365eeace23454c9401a92`
- Programme Revision 6: `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md`
- H-001 Revision 1: `docs/gangsta/code-guessing-startup/specs/children/h-001-content-evidence.md`
- H-003 Revision 1: `docs/gangsta/code-guessing-startup/specs/children/h-003-provenance-mode.md`
- H-006 Revision 1: `docs/gangsta/code-guessing-startup/specs/children/h-006-beta-operations.md`
- Reconnaissance Dossier: `docs/gangsta/codeguessr-content-acquisition/recon/2026-07-20-recon-dossier.md`
- Final Grilling Checkpoint: `docs/gangsta/codeguessr-content-acquisition/checkpoints/2026-07-27-checkpoint-the-grilling.md`
