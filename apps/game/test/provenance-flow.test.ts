import { describe, expect, it } from "vitest";
import { AuthorizedFlowOutcome, ProvenanceFlow, createProvenanceFlow } from "../src/modes/provenance/server/provenance-flow.js";
import { fixture, guards, request, transitionId } from "./support/provenance-flow-fixture.js";
import { createProvenanceRegime, RoundPlay } from "../../../packages/domain/src/index.js";
import { SourceRegimeControl } from "../../../packages/content/src/rights/source-regime.js";

const flowInput = (correctness = false, excerpt?: string) => {
  const data = fixture(correctness, {}, excerpt);
  const { authority: _authority, ...accepted } = data;
  return { data, input: {
    ...accepted, roundId: "round-flow", excerpt: data.evidence.excerpt,
    prompt: "Which recorded source produced this code?", modeVersionId: "mode-flow-v1", rulesVersionId: "rules-flow-v1",
    revealVersionId: "reveal-flow-v1",
    clues: [{ clueId: "clue-one", text: "Consider naming style.", clueVersionId: "clue-one-v1", order: 1 as const },
      { clueId: "clue-two", text: "Consider formatting consistency.", clueVersionId: "clue-two-v1", order: 2 as const }],
  } };
};

const recursivelyFrozen = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

type RevealOutcome = ReturnType<ProvenanceFlow["reveal"]>;
type PreRevealOutcome = Exclude<RevealOutcome, AuthorizedFlowOutcome>;

const authorizedOutcome = (outcome: RevealOutcome): AuthorizedFlowOutcome => {
  if (!(outcome instanceof AuthorizedFlowOutcome)) throw new Error("expected an authorized flow outcome");
  return outcome;
};

const preRevealOutcome = (outcome: RevealOutcome): PreRevealOutcome => {
  if (outcome instanceof AuthorizedFlowOutcome) throw new Error("expected a pre-reveal outcome");
  return outcome;
};

describe("provenance mode flow", () => {
  it("keeps the answer private, locks clues, and reveals through actual authorization", () => {
    const { data, input } = flowInput();
    const flow = createProvenanceFlow(input);
    const publicRound = flow.publicRound();
    expect(publicRound).toEqual({
      roundId: "round-flow", excerpt: data.evidence.excerpt,
      prompt: "Which recorded source produced this code?",
      candidates: [{ id: "candidate-human", label: "Project-owned human sample" }, { id: "candidate-model", label: "Recorded model output" }],
      clues: [{ clueId: "clue-one", text: "Consider naming style.", order: 1 }, { clueId: "clue-two", text: "Consider formatting consistency.", order: 2 }],
      versions: { round: "round-flow-v1", excerpt: "excerpt-flow-v1", candidates: "regime-flow-v1", clues: "clues-flow-v1", scoring: "scoring-flow-v1", rules: "rules-flow-v1", mode: "mode-flow-v1", sourceRegime: "regime-flow-v1", calibration: "provenance-calibration-v1", evidence: "evidence-flow-v1" },
    });
    expect(recursivelyFrozen(publicRound)).toBe(true);
    expect(JSON.stringify(publicRound)).not.toMatch(/correctSource|correctness|restricted|authorization-flow/i);
    const answered = flow.acceptClue("clue-one").acceptAnswer({ transitionId, candidateId: "candidate-model", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(() => answered.acceptClue("clue-two")).toThrow(/answer/i);
    const outcome = authorizedOutcome(answered.reveal({ authority: data.authority, request, guards }));
    const revealed = outcome.publicProjection;
    expect(revealed).toEqual({
      state: "REVEALED", mode: "provenance", correctness: false,
      correctSource: { candidateId: "candidate-human", sourceClass: "project-owned-human", label: "Project-owned human sample" },
      approvedAttribution: "Created for this project.",
      evidenceReference: { artifactId: "evidence-flow", versionId: "evidence-flow-v1" },
      helpfulSignals: ["regular formatting"], misleadingSignals: ["generic names"],
      versions: { content: "content-flow-v1", candidateSet: "regime-flow-v1", scoring: "scoring-flow-v1", rules: "rules-flow-v1", evidence: "evidence-flow-v1", reveal: "reveal-flow-v1", sourceRegime: "regime-flow-v1" },
    });
    expect(JSON.stringify(revealed)).not.toMatch(/creator-flow|authorization-flow|commissioned|project authorization/i);
    expect(outcome.answeredRoundPlay).toBeInstanceOf(RoundPlay);
    expect(outcome.answeredRoundPlay.acceptedAnswer?.answerId).toBe(transitionId);
    expect(outcome.result).toMatchObject({ classification: "ENTERTAINMENT_ONLY", correct: false, roundVersionId: "round-flow-v1" });
    expect(Object.isFrozen(outcome.answeredRoundPlay)).toBe(true);
    expect(Object.isFrozen(outcome.result)).toBe(true);
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(revealed);
  });

  it("fails closed for out-of-order clues, duplicate answers, and cross-transition reveal", () => {
    const { data, input } = flowInput();
    const flow = createProvenanceFlow(input);
    expect(() => flow.acceptClue("clue-two")).toThrow();
    const answered = flow.acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(() => answered.acceptAnswer({ transitionId: "another", candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:01Z" })).toThrow();
    expect(preRevealOutcome(answered.reveal({ authority: data.authority, request: { ...request, acceptedAnswerId: "wrong-transition" }, guards })).state).toBe("PRE_REVEAL");
  });

  it("supports correct and incorrect selections while transition identity stays distinct", () => {
    for (const [candidateId, correct] of [["candidate-human", true], ["candidate-model", false]] as const) {
      const { data, input } = flowInput(correct);
      const flow = createProvenanceFlow(input).acceptAnswer({ transitionId, candidateId, acceptedAt: "2026-08-02T10:00:00Z" });
      expect(transitionId).not.toBe(candidateId);
      expect(authorizedOutcome(flow.reveal({ authority: data.authority, request, guards })).publicProjection).toMatchObject({ state: "REVEALED", correctness: correct, correctSource: { candidateId: "candidate-human" } });
    }
  });

  it("rejects authority correctness that disagrees with the stored selected candidate", () => {
    const { data, input } = flowInput(true);
    const answered = createProvenanceFlow(input).acceptAnswer({
      transitionId, candidateId: "candidate-model", acceptedAt: "2026-08-02T10:00:00Z",
    });
    expect(() => answered.reveal({ authority: data.authority, request, guards })).toThrow(/correctness|candidate/i);
  });

  it("rejects missing, third, duplicate, out-of-order, and post-answer clues", () => {
    const { input } = flowInput();
    expect(() => createProvenanceFlow({ ...input, clues: [] })).toThrow(/two clues/i);
    expect(() => createProvenanceFlow({ ...input, clues: [...input.clues, { clueId: "third", text: "Three", clueVersionId: "third-v1", order: 3 }] })).toThrow(/two clues/i);
    expect(() => createProvenanceFlow({ ...input, clues: [input.clues[0], input.clues[0]] })).toThrow(/clue/i);
    const flow = createProvenanceFlow(input);
    expect(() => flow.acceptClue("clue-two")).toThrow(/clue/i);
    const answered = flow.acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(() => answered.acceptClue("clue-one")).toThrow(/answer/i);
  });

  it.each([
    ["excerpt", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, excerpt: "different excerpt" })],
    ["clue version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, clues: [{ ...input.clues[0], clueVersionId: "wrong" }, input.clues[1]] })],
  ] as const)("fails closed for wrong %s binding", (_name, mutate) => {
    const { input } = flowInput();
    expect(() => createProvenanceFlow(mutate(input))).toThrow();
  });

  it("fails closed at reveal for wrong round and genuinely different regime", () => {
    const { data, input } = flowInput();
    const answered = createProvenanceFlow(input).acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(preRevealOutcome(answered.reveal({ authority: data.authority, request: { ...request, roundId: "wrong-round" }, guards })).state).toBe("PRE_REVEAL");
    const differentRegime = createProvenanceRegime({
      sourceRegime: SourceRegimeControl.select({ versionId: "regime-flow-v2", selectedAt: "2026-08-01T09:00:00Z", selection: "project-owned-fallback" }).active,
      candidates: [{ id: "candidate-human", sourceClass: "project-owned-human", label: "Project-owned human sample" }, { id: "candidate-model", sourceClass: "model-output", label: "Recorded model output" }],
    });
    const different = createProvenanceFlow({
      ...input,
      regime: differentRegime,
      calibration: Object.freeze({ ...input.calibration, sourceRegimeVersionId: differentRegime.versionId }),
    }).acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(() => different.reveal({ authority: data.authority, request, guards })).toThrow(/regime|candidate/i);
  });

  it.each(["content", "candidateSet", "scoring", "rules", "evidence", "reveal"] as const)("rejects authorized %s version drift", (field) => {
    const data = fixture(true, { [field]: `wrong-${field}` });
    const { input } = flowInput(true);
    const answered = createProvenanceFlow(input).acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    expect(() => answered.reveal({ authority: data.authority, request, guards })).toThrow(/version|content|candidate|evidence|rules|scoring/i);
  });

  it("rejects unknown candidates and malformed, extra, or mutable input", () => {
    const { input } = flowInput();
    const flow = createProvenanceFlow(input);
    expect(() => flow.acceptAnswer({ transitionId, candidateId: "candidate-third", acceptedAt: "2026-08-02T10:00:00Z" })).toThrow(/candidate/i);
    expect(() => createProvenanceFlow({ ...input, extra: true })).toThrow(/unknown|extra/i);
    expect(() => createProvenanceFlow({ ...input, authority: fixture().authority })).toThrow(/unknown|extra/i);
    expect(() => createProvenanceFlow({ ...input, regime: { ...input.regime } })).toThrow(/frozen|boundary/i);
    expect(() => createProvenanceFlow(null)).toThrow();
  });

  it("cannot be constructed outside the validated factory", () => {
    const { input } = flowInput();
    expect(() => {
      // @ts-expect-error constructor is private and factory-only
      new ProvenanceFlow(input, input.roundPlay, null);
    }).toThrow(/factory|private/i);
  });

  it.each([
    ["ineligible publication", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, eligible: false }) as never })],
    ["non-provenance publication", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, itemMode: "language" as const }) })],
    ["content mismatch", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, contentId: "other-content" }) })],
    ["evidence version mismatch", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, evidenceVersion: "other-evidence" }) })],
    ["source regime mismatch", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, evidence: Object.freeze({ ...input.evidence, sourceClass: "stack-overflow" as const }) })],
  ] as const)("rejects %s before a public round exists", (_name, mutate) => {
    expect(() => createProvenanceFlow(mutate(flowInput().input))).toThrow();
  });

  it.each(["evidence", "eligibility", "regime"] as const)("rejects recursively mutable %s boundaries", (field) => {
    const { input } = flowInput();
    const mutable = field === "evidence"
      ? Object.freeze({ ...input.evidence, evidenceReference: { ...input.evidence.evidenceReference } })
      : field === "eligibility"
        ? Object.freeze({ ...input.eligibility, reviews: [...input.eligibility.reviews] })
        : Object.freeze({ ...input.regime, candidates: [...input.regime.candidates] });
    expect(() => createProvenanceFlow({ ...input, [field]: mutable })).toThrow(/frozen|boundary/i);
  });

  it.each(["extra", "missing"])("rejects clue entries with %s fields", (kind) => {
    const { input } = flowInput();
    const clue = kind === "extra" ? { ...input.clues[0], extra: true } : { clueId: "clue-one", text: "One", order: 1 };
    expect(() => createProvenanceFlow({ ...input, clues: [clue, input.clues[1]] })).toThrow(/clue|field/i);
  });

  it.each(["extra", "missing", "malformed"])("rejects answer envelopes that are %s", (kind) => {
    const flow = createProvenanceFlow(flowInput().input);
    const answer = kind === "extra"
      ? { transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z", extra: true }
      : kind === "missing" ? { transitionId, candidateId: "candidate-human" }
        : { transitionId, candidateId: "candidate-human", acceptedAt: "invalid" };
    expect(() => flow.acceptAnswer(answer as never)).toThrow(/answer|field|acceptedAt/i);
  });

  it.each(["extra", "missing", "malformed"])("rejects reveal envelopes that are %s", (kind) => {
    const { data, input } = flowInput();
    const flow = createProvenanceFlow(input).acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" });
    const reveal = kind === "extra" ? { authority: data.authority, request, guards, extra: true }
      : kind === "missing" ? { authority: data.authority, request }
        : { authority: {}, request, guards };
    expect(() => flow.reveal(reveal as never)).toThrow(/reveal|field|authority/i);
  });

  it("preserves script-like excerpts as inert public text", () => {
    const scriptLike = "<script>globalThis.__provenanceExecuted = true</script>";
    const { input } = flowInput(false, scriptLike);
    expect(createProvenanceFlow(input).publicRound().excerpt).toBe(scriptLike);
    expect((globalThis as Record<string, unknown>).__provenanceExecuted).toBeUndefined();
  });

  it("fails closed for premature and denied reveal and exposes only projector explanation fields", () => {
    const { data, input } = flowInput();
    const flow = createProvenanceFlow(input);
    expect(preRevealOutcome(flow.reveal({ authority: data.authority, request, guards })).state).toBe("PRE_REVEAL");
    const denied = preRevealOutcome(flow.acceptAnswer({ transitionId, candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z" })
      .reveal({ authority: data.authority, request, guards: { ...guards, authorized: false } }));
    expect(denied.state).toBe("PRE_REVEAL");
    expect(JSON.stringify(denied)).not.toMatch(/approvedAttribution|evidenceReference|helpfulSignals|misleadingSignals/i);
  });

  it("fails closed when the stored transition differs from the authorized request", () => {
    const { data, input } = flowInput();
    const answered = createProvenanceFlow(input).acceptAnswer({
      transitionId: "different-transition", candidateId: "candidate-human", acceptedAt: "2026-08-02T10:00:00Z",
    });
    expect(preRevealOutcome(answered.reveal({ authority: data.authority, request, guards })).state).toBe("PRE_REVEAL");
  });
});
