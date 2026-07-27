---
heist: codeguessr-content-acquisition
phase: the-sit-down
review: 4
date: 2026-07-27
subject-sha256: 530252436ef0649effba30ee1966651707eaa0b04fa6644e382515d1b9a330f0
verdict: APPROVE
status: final-pre-signature-review
---

# Consigliere Assessment

**Subject:** Programme Revision 7 amendment revision 4, SHA-256 `530252436ef0649effba30ee1966651707eaa0b04fa6644e382515d1b9a330f0`

**Verdict:** APPROVE

## Findings

1. **LOW — The ingestion boundary is unambiguous.** Revision 7 prohibits gameplay-time, browser-time, participant-triggered acquisition and publicly exposed acquisition endpoints while expressly permitting the authenticated offline operator’s HTTPS requests to `api.github.com`.
2. **LOW — Attribution storage and reveal containment are coherent.** Approved public identity and attribution may exist in restricted H-001 evidence and the approved catalogue, but may reach participant-facing gameplay only through authorized reveal. Acquisition infrastructure, raw snapshots, restricted evidence, diagnostics, pre-reveal payloads, manifests, static artifacts, and telemetry remain excluded.
3. **LOW — Source integrity passes.** All twelve Source Register SHA-256 hashes match their referenced artifacts. The reviewed Contract matches the subject hash.
4. **LOW — All prior findings remain resolved.** The AC-005 and AC-014/OOS replacements; exact measurement events; six-child lineage; active provenance regime; same-path diff semantics; rate-limit/truncation handling; policy/operator trust roots; authoritative retention time; rights gate; quarantine; runtime isolation; rehearsals; and GeoGuessr-for-code frame are coherent.

## Recommendations

1. Sign only the exact reviewed artifact hash `530252436ef0649effba30ee1966651707eaa0b04fa6644e382515d1b9a330f0`.
2. After signature, prepare the three required child Revision 2 Contracts and three Compatibility Certificates against the final approved Revision 7 hash. Implementation remains unauthorized until those artifacts are separately reviewed and signed.

## Citations

- Approved draft: `docs/gangsta/codeguessr-content-acquisition/specs/2026-07-27-contract.md`
- Consigliere Reviews 1–3: `docs/gangsta/codeguessr-content-acquisition/reviews/2026-07-27-consigliere-review-1.md`, `docs/gangsta/codeguessr-content-acquisition/reviews/2026-07-27-consigliere-review-2.md`, and `docs/gangsta/codeguessr-content-acquisition/reviews/2026-07-27-consigliere-review-3.md`
- Programme Revision 6: `docs/gangsta/code-guessing-startup/specs/2026-07-11-contract.md`
