---
heist: code-guessing-startup
phase: the-hit
work-package: playable-demo-slice
status: accepted-local-demo
date: 2026-07-16
territory: H-002
---

# Report: Playable Synthetic Demo

- Scope: the existing `ArcadeShell` is now mounted as a five-round local demo with three provenance and two language rounds, up to two ordered clues, answer lock, evidence-backed reveal, fixed 1,000/800/500-point clue scoring, cumulative result, next-round navigation, spoiler-free completion and replay.
- Content truth: the public contract contains only synthetic excerpts, candidates, clues and versions. All three provenance fixtures were produced as recorded model output for this implementation; their reveal explicitly says fixture provenance controls the answer and code style is not provenance evidence. The page labels the experience `Synthetic local demo` and `not an approved beta corpus`.
- Boundary: the browser receives no `correctCandidateId` or private reveal explanation. A server action validates exact request shape, round order/version, candidate membership, clue bounds and reachable prior score. The shell independently binds the returned round score to its accepted clue count and the cumulative result to prior session state. This local action is not durable beta authority and creates no operational-readiness claim.
- Interaction hardening: failed reveal calls expose a generic `role="alert"` message and permit retry. A completed run can restart from a fresh session. The client-only mount preserves a server-rendered no-JavaScript explanation without leaking inert answer controls.
- Drill history: the first focused RED failed on the absent demo module, action, replay and error UI. Initial GREEN reached 17/17 before strict compilation exposed an untyped tuple boundary; Interrogation corrected only that source. Browser RED then isolated no-JavaScript partial controls and the client-only mount closed it. Inspector review found impossible client-carried score states and missing shell score continuity; the corrective RED failed exactly two cases with sixteen preserved passes before 18/18 GREEN.
- Browser evidence: the exact arcade Playwright project passes 3/3 against the real local Next server. It completes all five rounds, verifies clue penalty, score, evidence, completion and replay; proves the 320×568 reduced-motion boundary; and proves no-JavaScript explanation with zero radio/answer controls.
- Programme evidence: the final workspace passes TAP 1/1 plus 1,622/1,622 Vitest tests and all five typechecks. The final Next production build compiles, typechecks and generates 4/4 static pages; `/` is 1.22 kB with 107 kB first-load JavaScript. A built-static scan finds no private answer field or reveal explanation. Post-build cleanup restores the protected config SHA-256 `d0764b823179d444055a666be0fd4adc45e948cbb71c0f29efa6a3a0b2487a76`, leaves no `.next`, `test-results`, Playwright report or port-3000 listener, and passes game typecheck and whitespace checks.
- Audit: independent audit-review is CLOSED with no remaining Critical or Important finding. The explicitly local, non-persisted action is accepted for demo scope; a future client-import-proof `server-only` split remains optional hardening.
- Controlled-beta boundary: this demo does not add accounts, credentials, durable authoritative sessions, manifests, authentic corpus entries, staffing approvals, provider configuration, deployment or accessibility attestations. Those existing operational gates remain unchanged.
- Budget accounting: exact platform token usage is unavailable, so no fabricated programme reforecast is recorded.
