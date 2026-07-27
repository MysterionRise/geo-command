---
heist: code-guessing-startup
phase: the-hit
work-package: WP-003
status: accepted-correction
date: 2026-07-16
territory: H-001
---

# Correction Report: Nontechnical Qualification Policy

- Trigger: WP-005 audit identified an upstream policy gap. The accepted publication-eligibility boundary required only nonblank qualification strings for the Content Editor and Rights/Safety Reviewer, so it did not mechanically enforce the programme staffing table.
- Contract correction: Content Editor records now require both exact `content-preparation` and `evidence-record-training` claims. Rights/Safety Reviewer records require either `don-approved-rights-safety-qualification` or `counsel-status`. Technical Reviewer A and B continue to require the item's exact mode.
- Truth boundary: these tokens are validated recorded claims. They do not prove that named people, training, Don approval, counsel status or minimum staffing actually exist; those remain operational evidence required before AC-004/AC-015 approval.
- Drill evidence: the focused RED preserved 27 passes and failed exactly five missing/alias/nonrecognized qualification cases. Minimal policy GREEN reached 32/32. The affected content inventory, language and review suites reached 180/180 with strict content compilation.
- Refactor: role qualification, review-set and approval-check validation were separated without changing behavior. The largest production function is 43 lines and the policy file remains below the 300-line target.
- Programme regression: the first complete sweep correctly exposed 204 failures across five game consumer suites because three shared synthetic fixtures retained old labels. Only six nontechnical qualification arrays were updated across those fixture/test files; production, assertions and technical qualifications were unchanged. The five consumers then passed 252/252.
- Final verification: the programme passes TAP 1/1 plus 1,616/1,616 Vitest tests and all five workspace typechecks. Diff hygiene is clean, the protected game configuration remains at SHA-256 `d0764b823179d444055a666be0fd4adc45e948cbb71c0f29efa6a3a0b2487a76`, and no generated build/test directory remains.
- Audit: independent review is CLOSED with no Critical, Important or Minor policy finding and no remaining Critical or Important fixture-propagation finding.
- Budget accounting: exact platform token usage is unavailable, so no fabricated usage or programme reforecast is recorded.
