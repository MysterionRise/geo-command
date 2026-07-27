import { expect, test } from "@playwright/test";
import { createProvenanceFlow } from "../../apps/game/src/modes/provenance/server/provenance-flow.js";
import { fixture, guards, request, transitionId } from "../../apps/game/test/support/provenance-flow-fixture.js";

test("runs the real provenance mode server flow", () => {
  const data = fixture();
  const { authority: _authority, ...accepted } = data;
  const flow = createProvenanceFlow({ ...accepted, roundId: "round-flow", excerpt: data.evidence.excerpt, prompt: "Which source?", modeVersionId: "mode-flow-v1", rulesVersionId: "rules-flow-v1", revealVersionId: "reveal-flow-v1",
    clues: [{ clueId: "clue-one", text: "One", clueVersionId: "clue-one-v1", order: 1 }, { clueId: "clue-two", text: "Two", clueVersionId: "clue-two-v1", order: 2 }] });
  const revealed = flow.acceptClue("clue-one").acceptAnswer({ transitionId, candidateId: "candidate-model", acceptedAt: "2026-08-02T10:00:00Z" }).reveal({ authority: data.authority, request, guards }).publicProjection;
  expect(revealed).toMatchObject({ state: "REVEALED", correctness: false, correctSource: { candidateId: "candidate-human" } });
});
