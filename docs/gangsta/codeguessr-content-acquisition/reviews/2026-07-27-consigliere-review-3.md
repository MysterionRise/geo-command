---
heist: codeguessr-content-acquisition
phase: the-sit-down
review: 3
date: 2026-07-27
subject-sha256: f81800136947620627c868de3fb9ce925ad01d78c0dd87e2e2262ba39c9c6638
verdict: REJECT
status: superseded-by-amendment-revision-4
---

# Consigliere Assessment

**Subject:** Programme Revision 7 amendment revision 3, SHA-256 `f81800136947620627c868de3fb9ce925ad01d78c0dd87e2e2262ba39c9c6638`

**Verdict:** REJECT

## Findings

1. **HIGH — The final Out-of-Scope list reintroduced an ambiguous network prohibition.** “Public network acquisition” could be read as prohibiting the authenticated offline operator’s required HTTPS calls to the public GitHub API.
2. **MEDIUM — AC-ACQ-012’s “appear nowhere else” was broader than the evidence lifecycle permits.** Approved source identity and attribution must exist in restricted H-001 evidence and the approved catalogue before authorized reveal.
3. **LOW — All prior substantive corrections passed.** The AC-005 replacement, exact measurement events, reveal boundary, source hashes, six-child lineage, policies, provenance, diff, rights, storage, transport, isolation, Constitution, and GeoGuessr-for-code frame were coherent.

## Required Corrections

1. Prohibit a publicly exposed acquisition endpoint without prohibiting the offline operator’s `api.github.com` calls.
2. Permit approved identity and attribution in restricted H-001 evidence and the approved catalogue, while limiting participant delivery to authorized reveal.
3. Run a focused contradiction check; no other redesign is required.

## Citations

- Rejected draft SHA-256: `f81800136947620627c868de3fb9ce925ad01d78c0dd87e2e2262ba39c9c6638`
- Programme Revision 6: `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md`
- Consigliere Review 2: `docs/gangsta/codeguessr-content-acquisition/reviews/2026-07-27-consigliere-review-2.md`
