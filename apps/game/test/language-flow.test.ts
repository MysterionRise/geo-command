import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RoundPlay } from "../../../packages/domain/src/index.js";
import {
  LanguageFlow,
  createLanguageFlow,
} from "../src/modes/language/server/language-flow.js";
import {
  deepFreeze,
  guards,
  languageFixture,
  request,
  transitionId,
} from "./support/language-flow-fixture.js";

const clueText = ["Look at the type annotation.", "Compare the runtime syntax."] as const;

const flowInput = (options: Parameters<typeof languageFixture>[0] = {}) => {
  const data = languageFixture(options);
  const clues = data.candidateSet.clues.map((clue, index) => Object.freeze({
    ...clue,
    text: clueText[index]!,
  }));
  const annotated = data.eligibility.deceptiveTextControlReview.disposition === "approved-visible-annotation";
  return {
    data,
    input: {
      evidence: data.evidence,
      eligibility: data.eligibility,
      candidateSet: data.candidateSet,
      presentation: data.presentation,
      roundPlay: data.roundPlay,
      sessionId: request.sessionId,
      roundId: request.roundId,
      roundVersionId: "language-round-v1",
      excerpt: data.evidence.excerpt,
      prompt: "Which programming language is this?",
      modeVersionId: "language-mode-v1",
      rulesVersionId: "language-rules-v1",
      revealVersionId: "language-reveal-v1",
      clues: Object.freeze(clues),
      controlAnnotation: annotated
        ? Object.freeze({
          versionId: "language-control-annotation-v1",
          text: "The excerpt contains approved visible annotations for bidirectional or zero-width controls.",
        })
        : null,
    },
  };
};

const answer = (candidateId = "lang-ts-01") => Object.freeze({
  transitionId,
  candidateId,
  acceptedAt: "2026-08-03T10:00:00Z",
});

const preReveal = Object.freeze({
  state: "PRE_REVEAL",
  mode: "language",
  candidateSetVersionId: "language-set-v1",
  presentedCandidateCount: 3,
});

const recursivelyFrozen = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

const acceptConfiguredClues = <T extends { acceptClue(clueId: string): T }>(flow: T, clueIds: readonly string[]): T =>
  clueIds.reduce((current, clueId) => current.acceptClue(clueId), flow);

describe("language mode flow", () => {
  it("publishes the certified session ordering and returns an authorized evidence-backed RoundPlay outcome", () => {
    const { data, input } = flowInput();
    const flow = createLanguageFlow(input);
    expect(flow.publicRound()).toEqual({
      roundId: "round-language",
      excerpt: data.evidence.excerpt,
      prompt: "Which programming language is this?",
      candidates: [
        { id: "lang-ts-01", label: "TypeScript" },
        { id: "lang-js-01", label: "JavaScript" },
        { id: "lang-flow-01", label: "Flow" },
      ],
      presentedCandidateCount: 3,
      clues: [
        { clueId: "language-clue-one", text: clueText[0], order: 1 },
        { clueId: "language-clue-two", text: clueText[1], order: 2 },
      ],
      controlAnnotation: null,
      versions: {
        round: "language-round-v1",
        excerpt: "content-language-v1",
        candidates: "language-set-v1",
        orderingRecord: "language-ordering-record-v1",
        orderingPolicy: "language-ordering-policy-v1",
        clues: "language-clue-set-v1",
        cluePolicy: "language-clue-policy-v1",
        scoring: "language-scoring-v1",
        calibration: "language-calibration-v1",
        rules: "language-rules-v1",
        mode: "language-mode-v1",
        evidence: "evidence-language-v1",
        eligibility: "language-ambiguity-v1",
        controlReview: "language-control-review-v1",
      },
    });
    expect(recursivelyFrozen(flow.publicRound())).toBe(true);
    expect(JSON.stringify(flow.publicRound())).not.toMatch(/correctCandidateId|distractorRationale|creator-language|authorization-language/i);

    const outcome = flow.acceptClue("language-clue-one").acceptAnswer(answer()).reveal({
      authority: data.authority,
      request,
      guards,
    });
    const revealed = outcome.publicProjection;
    expect(recursivelyFrozen(revealed)).toBe(true);
    expect(revealed).toEqual({
      state: "REVEALED",
      mode: "language",
      correctness: true,
      correctLanguage: { candidateId: "lang-ts-01", label: "TypeScript" },
      approvedAttribution: "Created for this project.",
      approvedEvidence: "evidence-language@evidence-language-v1",
      helpfulSignals: ["explicit type annotation"],
      misleadingSignals: ["JavaScript-compatible runtime syntax"],
      versions: {
        content: "content-language-v1",
        candidateSet: "language-set-v1",
        scoring: "language-scoring-v1",
        rules: "language-rules-v1",
        evidence: "evidence-language-v1",
        reveal: "language-reveal-v1",
      },
    });
    expect(outcome.answeredRoundPlay).toBeInstanceOf(RoundPlay);
    expect(outcome.answeredRoundPlay.acceptedAnswer).toMatchObject({
      answerId: transitionId,
      candidateId: "lang-ts-01",
      candidateCount: 3,
      correct: true,
    });
    expect(outcome.result).toEqual({
      classification: "ENTERTAINMENT_ONLY",
      correct: true,
      points: 800,
      maximumPoints: 1000,
      cluesUsed: 1,
      roundVersionId: "language-round-v1",
      scoringVersionId: "language-scoring-v1",
    });
    expect(recursivelyFrozen(outcome.result)).toBe(true);
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(revealed);
    expect(JSON.stringify(outcome)).not.toMatch(/acceptedAnswer|transition|distractorRationale|creator-language|authorization-language/i);
  });

  it.each([
    [0, 1000],
    [1, 800],
    [2, 500],
  ] as const)("supports exactly %i configured clues with frozen scoring", (clueCount, points) => {
    const { data, input } = flowInput({ clueCount });
    const flow = acceptConfiguredClues(createLanguageFlow(input), data.candidateSet.clues.map(({ clueId }) => clueId));
    const outcome = flow.acceptAnswer(answer()).reveal({ authority: data.authority, request, guards });
    expect(flow.publicRound().clues).toHaveLength(clueCount);
    expect(outcome.result).toMatchObject({ correct: true, cluesUsed: clueCount, points });
  });

  it.each([
    ["lang-ts-01", true],
    ["lang-js-01", false],
  ] as const)("keeps opaque transition identity separate for %s", (candidateId, correctness) => {
    const { data, input } = flowInput({ correctness });
    expect(transitionId).not.toBe(candidateId);
    const outcome = createLanguageFlow(input).acceptAnswer(answer(candidateId)).reveal({ authority: data.authority, request, guards });
    expect(outcome.publicProjection).toMatchObject({ correctness, correctLanguage: { candidateId: "lang-ts-01" } });
    expect(outcome.answeredRoundPlay.acceptedAnswer?.answerId).toBe(transitionId);
  });

  it("enforces clue order and locks clues and answers after answer acceptance", () => {
    const { input } = flowInput();
    const flow = createLanguageFlow(input);
    expect(() => flow.acceptClue("language-clue-two")).toThrow(/clue|order/i);
    const oneClue = flow.acceptClue("language-clue-one");
    expect(() => oneClue.acceptClue("language-clue-one")).toThrow(/clue|order/i);
    const answered = oneClue.acceptAnswer(answer());
    expect(() => answered.acceptClue("language-clue-two")).toThrow(/answer/i);
    expect(() => answered.acceptAnswer(answer("lang-js-01"))).toThrow(/answer/i);
    expect(() => flow.acceptAnswer(Object.freeze({ ...answer(), transitionId: "lang-ts-01" }))).toThrow(/transition|candidate|opaque/i);
  });

  it.each([
    ["content", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, contentId: "other-content" }) })],
    ["evidence version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, evidenceVersion: "other-evidence" }) })],
    ["candidate-set version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, candidateSetVersionId: "other-set" }) })],
    ["certified correct answer", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, correctCandidateId: "lang-js-01" }) })],
    ["publication mode", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, publicationEligibility: Object.freeze({ ...input.eligibility.publicationEligibility, itemMode: "provenance" as const }) }) })],
    ["evidence record", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, evidence: Object.freeze({ ...input.evidence, stableId: "other-content" }) })],
  ] as const)("revalidates the %s pre-publication binding", (_name, mutate) => {
    expect(() => createLanguageFlow(mutate(flowInput().input))).toThrow();
  });

  it.each(["missing", "blank"] as const)("rejects %s authoritative round-version bindings", (kind) => {
    const { input } = flowInput();
    const value = kind === "blank"
      ? { ...input, roundVersionId: " " }
      : Object.fromEntries(Object.entries(input).filter(([field]) => field !== "roundVersionId"));
    expect(() => createLanguageFlow(value)).toThrow(/round|version|field/i);
  });

  it.each([
    ["session ordering", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, sessionId: "other-session" })],
    ["round excerpt", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, excerpt: "other excerpt" })],
    ["actual RoundPlay", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: { ...input.roundPlay } as never })],
    ["round excerpt id", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, baseExcerpt: { ...input.roundPlay.definition.baseExcerpt, referenceId: "other-content" } }) })],
    ["round excerpt version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, baseExcerpt: { ...input.roundPlay.definition.baseExcerpt, versionId: "other-content-version" } }) })],
    ["round version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, roundVersionId: "other-round-version" }) })],
    ["round scoring version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, scoringVersionId: "other-scoring" }) })],
    ["round clue-set version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, clueSetVersionId: "other-clue-set" }) })],
    ["round clue identity", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, clues: [{ ...input.roundPlay.definition.clues[0]!, clueId: "other-clue" }, input.roundPlay.definition.clues[1]!] }) })],
    ["round clue version", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, clues: [{ ...input.roundPlay.definition.clues[0]!, clueVersionId: "other-clue-version" }, input.roundPlay.definition.clues[1]!] }) })],
    ["round clue count", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, roundPlay: RoundPlay.create({ ...input.roundPlay.definition, clues: [input.roundPlay.definition.clues[0]!] }) })],
    ["certified candidate set", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, candidateSet: Object.freeze({ ...input.candidateSet }) })],
    ["certified presentation", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, presentation: Object.freeze({ ...input.presentation, extra: true }) })],
    ["presentation order", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, presentation: deepFreeze({ ...input.presentation, candidateIds: [...input.presentation.candidateIds].reverse() }) })],
    ["presentation count", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, presentation: deepFreeze({ ...input.presentation, presentedCandidateCount: 2 }) })],
    ["presentation session", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, presentation: deepFreeze({ ...input.presentation, orderingRecord: { ...input.presentation.orderingRecord, sessionId: "other-session" } }) })],
    ["presentation policy", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, presentation: deepFreeze({ ...input.presentation, orderingRecord: { ...input.presentation.orderingRecord, policyVersionId: "other-policy" } }) })],
    ["mutable evidence", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, evidence: Object.freeze({ ...input.evidence, evidenceReference: { ...input.evidence.evidenceReference } }) })],
    ["mutable eligibility", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, technicalReviews: [...input.eligibility.technicalReviews] }) })],
    ["extra evidence", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, evidence: Object.freeze({ ...input.evidence, extra: true }) })],
    ["extra eligibility", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, eligibility: Object.freeze({ ...input.eligibility, extra: true }) })],
    ["extra root field", (input: ReturnType<typeof flowInput>["input"]) => ({ ...input, extra: true })],
  ] as const)("rejects a forged or invalid %s boundary", (_name, mutate) => {
    expect(() => createLanguageFlow(mutate(flowInput().input))).toThrow();
  });

  it.each(["missing", "extra", "wrong-version", "wrong-order"] as const)("rejects %s clue envelopes", (kind) => {
    const { input } = flowInput();
    const first = input.clues[0]!;
    const clue = kind === "missing" ? { clueId: first.clueId, text: first.text, order: first.order }
      : kind === "extra" ? { ...first, extra: true }
        : kind === "wrong-version" ? { ...first, clueVersionId: "other-clue-version" }
          : { ...first, order: 2 as const };
    expect(() => createLanguageFlow({ ...input, clues: Object.freeze([Object.freeze(clue), input.clues[1]!]) })).toThrow(/clue|field|version|order/i);
  });

  it.each(["too-few", "too-many", "mutable-list", "mutable-entry"] as const)("rejects %s clue collections", (kind) => {
    const { input } = flowInput();
    const clues = kind === "too-few" ? Object.freeze([input.clues[0]!])
      : kind === "too-many" ? Object.freeze([...input.clues, Object.freeze({ clueId: "third", text: "Third", clueVersionId: "third-v1", order: 3 })])
        : kind === "mutable-list" ? [...input.clues]
          : Object.freeze([{ ...input.clues[0]! }, input.clues[1]!]);
    expect(() => createLanguageFlow({ ...input, clues } as never)).toThrow(/clue|count|frozen|boundary/i);
  });

  it.each(["missing", "extra", "malformed", "unknown-candidate"] as const)("rejects %s answer envelopes", (kind) => {
    const flow = createLanguageFlow(flowInput().input);
    const value = kind === "missing" ? { transitionId, candidateId: "lang-ts-01" }
      : kind === "extra" ? { ...answer(), extra: true }
        : kind === "malformed" ? { ...answer(), acceptedAt: "invalid" }
          : answer("unknown-language");
    expect(() => flow.acceptAnswer(value as never)).toThrow(/answer|field|candidate|acceptedAt/i);
  });

  it.each(["missing", "extra", "invalid-authority"] as const)("rejects %s reveal envelopes", (kind) => {
    const { data, input } = flowInput();
    const flow = createLanguageFlow(input).acceptAnswer(answer());
    const value = kind === "missing" ? { authority: data.authority, request }
      : kind === "extra" ? { authority: data.authority, request, guards, extra: true }
        : { authority: {}, request, guards };
    expect(() => flow.reveal(value as never)).toThrow(/reveal|field|authority/i);
  });

  it.each(["request-extra", "request-missing", "request-mutable", "guards-extra", "guards-missing", "guards-mutable", "guards-malformed"] as const)("rejects non-exact %s authorization inputs", (kind) => {
    const { data, input } = flowInput();
    const flow = createLanguageFlow(input).acceptAnswer(answer());
    const requestValue: Record<string, unknown> = kind === "request-extra" ? Object.freeze({ ...request, extra: true })
      : kind === "request-missing" ? Object.freeze(Object.fromEntries(Object.entries(request).filter(([field]) => field !== "betaDay")))
        : kind === "request-mutable" ? { ...request }
          : request;
    const guardValue: Record<string, unknown> = kind === "guards-extra" ? Object.freeze({ ...guards, extra: true })
      : kind === "guards-missing" ? Object.freeze(Object.fromEntries(Object.entries(guards).filter(([field]) => field !== "authorized")))
        : kind === "guards-mutable" ? { ...guards }
          : kind === "guards-malformed" ? Object.freeze({ ...guards, authorized: "true" })
            : guards;
    expect(() => flow.reveal({ authority: data.authority, request: requestValue, guards: guardValue } as never)).toThrow(/request|guard|field|frozen|shape/i);
  });

  it.each([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "roundId",
    "acceptedAnswerId",
  ] as const)("fails closed for cross-scope %s reveal requests", (field) => {
    const { data, input } = flowInput();
    const flow = createLanguageFlow(input).acceptAnswer(answer());
    expect(flow.reveal({
      authority: data.authority,
      request: Object.freeze({ ...request, [field]: `wrong-${field}` }),
      guards,
    })).toEqual(preReveal);
  });

  it.each(["content", "candidateSet", "scoring", "rules", "evidence", "reveal"] as const)("rejects authorized %s version drift", (field) => {
    const { data, input } = flowInput({ versionOverrides: { [field]: `wrong-${field}` } });
    const flow = createLanguageFlow(input).acceptAnswer(answer());
    expect(() => flow.reveal({ authority: data.authority, request, guards })).toThrow(/version|binding/i);
  });

  it("rejects authority correctness that disagrees with the selected language", () => {
    const { data, input } = flowInput({ correctness: true });
    const flow = createLanguageFlow(input).acceptAnswer(answer("lang-js-01"));
    expect(() => flow.reveal({ authority: data.authority, request, guards })).toThrow(/correctness|candidate/i);
  });

  it("returns the exact minimal state for premature and denied reveals", () => {
    const { data, input } = flowInput();
    const flow = createLanguageFlow(input);
    expect(flow.reveal({ authority: data.authority, request, guards })).toEqual(preReveal);
    const deniedData = flowInput();
    const denied = createLanguageFlow(deniedData.input).acceptAnswer(answer()).reveal({
      authority: deniedData.data.authority,
      request,
      guards: Object.freeze({ ...guards, authorized: false }),
    });
    expect(denied).toEqual(preReveal);
    expect(JSON.stringify(denied)).not.toMatch(/correctLanguage|approvedEvidence|helpfulSignals|misleadingSignals/i);
  });

  it("requires no annotation when controls are absent and the exact approved annotation otherwise", () => {
    const absent = flowInput();
    expect(createLanguageFlow(absent.input).publicRound().controlAnnotation).toBeNull();
    expect(() => createLanguageFlow({ ...absent.input, controlAnnotation: Object.freeze({ versionId: "unexpected", text: "Unexpected" }) })).toThrow(/annotation|control/i);
    const undisclosed = flowInput({ excerpt: "const safe = 1; // \u202E undisclosed" });
    expect(() => createLanguageFlow(undisclosed.input)).toThrow(/control|annotation|bidi/i);
    const undisclosedZeroWidth = flowInput({ excerpt: "const safe = 1; // \u200B undisclosed" });
    expect(() => createLanguageFlow(undisclosedZeroWidth.input)).toThrow(/control|annotation|zero/i);

    const annotated = flowInput({ annotatedControls: true, excerpt: "const safe = 1; // \u202E visibly annotated" });
    expect(createLanguageFlow(annotated.input).publicRound().controlAnnotation).toEqual({
      versionId: "language-control-annotation-v1",
      text: "The excerpt contains approved visible annotations for bidirectional or zero-width controls.",
      detectedControlClasses: ["bidi"],
    });
    expect(() => createLanguageFlow({
      ...annotated.input,
      controlAnnotation: Object.freeze({ ...annotated.input.controlAnnotation!, versionId: "wrong-annotation" }),
    })).toThrow(/annotation|version/i);
    const wrongClass = flowInput({
      annotatedControls: true,
      detectedControlClasses: ["bidi"],
      excerpt: "const safe = 1; // \u200B zero width",
    });
    expect(() => createLanguageFlow(wrongClass.input)).toThrow(/control|class|annotation/i);
    const noActualControl = flowInput({ annotatedControls: true, detectedControlClasses: ["bidi"] });
    expect(() => createLanguageFlow(noActualControl.input)).toThrow(/control|class|annotation/i);
  });

  it.each(["\u2061", "\u2064"] as const)("rejects invisible operator %j when the control review says absent", (control) => {
    const { input } = flowInput({ excerpt: `const safe = 1; // ${control} undisclosed` });
    expect(() => createLanguageFlow(input)).toThrow(/control|annotation|zero/i);
  });

  it.each([
    [["bidi"], "const safe = 1; // \u202E bidi"],
    [["zero-width"], "const safe = 1; // \u200B zero width"],
    [["bidi", "zero-width"], "const safe = 1; // \u202E bidi \u200B zero width"],
  ] as const)("accepts the exact approved %j control classes", (detectedControlClasses, excerpt) => {
    const { input } = flowInput({ annotatedControls: true, detectedControlClasses, excerpt });
    const annotation = createLanguageFlow(input).publicRound().controlAnnotation;
    expect(annotation).toEqual({ ...input.controlAnnotation, detectedControlClasses: [...detectedControlClasses] });
    expect(recursivelyFrozen(annotation)).toBe(true);
  });

  it.each(["missing", "extra", "caller-classes", "blank", "altered-text", "mutable"] as const)("rejects %s approved annotation envelopes", (kind) => {
    const { input } = flowInput({ annotatedControls: true, excerpt: "const safe = 1; // \u202E bidi" });
    const annotation = kind === "missing" ? Object.freeze({ versionId: "language-control-annotation-v1" })
      : kind === "extra" ? Object.freeze({ ...input.controlAnnotation!, extra: true })
        : kind === "caller-classes" ? Object.freeze({ ...input.controlAnnotation!, detectedControlClasses: ["bidi"] })
        : kind === "blank" ? Object.freeze({ ...input.controlAnnotation!, text: " " })
          : kind === "altered-text" ? Object.freeze({ ...input.controlAnnotation!, text: "This text was not approved." })
            : { ...input.controlAnnotation! };
    expect(() => createLanguageFlow({ ...input, controlAnnotation: annotation } as never)).toThrow(/annotation|field|text|frozen/i);
  });

  it("preserves script-like excerpts as inert public text", () => {
    const excerpt = "<script>globalThis.__languageExecuted = true</script>";
    const { input } = flowInput({ excerpt });
    expect(createLanguageFlow(input).publicRound().excerpt).toBe(excerpt);
    expect((globalThis as Record<string, unknown>).__languageExecuted).toBeUndefined();
  });

  it("cannot be constructed outside the validated factory", () => {
    expect(() => {
      // @ts-expect-error construction is private and factory-only
      new LanguageFlow(flowInput().input);
    }).toThrow(/factory|private/i);
  });

  it("keeps the language flow behind a minimal server-only entry", () => {
    const entry = readFileSync("apps/game/src/modes/language/server/index.ts", "utf8");
    expect(entry).toMatch(/^import "server-only";/);
    expect(entry).toBe(
      "import \"server-only\";\n\n" +
      "export { createLanguageFlow } from \"./language-flow.js\";\n" +
      "export type { LanguageFlowInput } from \"./language-flow.js\";\n",
    );
  });
});
