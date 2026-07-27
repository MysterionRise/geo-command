import { describe, expect, it } from "vitest";
import { AUTHORITATIVE_EVENT_SCHEMA_VERSION, parseAuthoritativeEvent } from "../../../packages/measurement/src/index.js";
import { createProvenanceCalibration } from "../src/modes/provenance/server/provenance-calibration.js";
import { createProvenanceFlow } from "../src/modes/provenance/server/provenance-flow.js";
import { fixture, guards, request, transitionId } from "./support/provenance-flow-fixture.js";

type MutableRecord = Record<string, unknown>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

const calibrationInput = () => Object.freeze({
  versionId: "provenance-calibration-v1",
  sourceRegimeVersionId: "regime-flow-v1",
  presentedCandidateCount: 2,
  chanceBaseline: 0.5,
  clueSetVersionId: "clues-flow-v1",
  configuredClueCount: 2,
  scoringVersionId: "scoring-flow-v1",
});

const flowInput = (correctness = false) => {
  const data = fixture(correctness);
  const { authority: _authority, ...accepted } = data;
  return {
    data,
    input: {
      ...accepted,
      roundId: request.roundId,
      excerpt: data.evidence.excerpt,
      prompt: "Which recorded source produced this code?",
      modeVersionId: "mode-flow-v1",
      rulesVersionId: "rules-flow-v1",
      revealVersionId: "reveal-flow-v1",
      clues: [
        { clueId: "clue-one", text: "Consider naming style.", clueVersionId: "clue-one-v1", order: 1 as const },
        { clueId: "clue-two", text: "Consider formatting consistency.", clueVersionId: "clue-two-v1", order: 2 as const },
      ],
    },
  };
};

const omit = (value: Readonly<Record<string, unknown>>, field: string): Readonly<Record<string, unknown>> => {
  const copy = { ...value };
  delete copy[field];
  return Object.freeze(copy);
};

const answerEvent = (candidateId: "candidate-human" | "candidate-model", clueCount: 0 | 1 | 2) => {
  const { data, input } = flowInput(candidateId === "candidate-human");
  let flow = createProvenanceFlow(input);
  for (let index = 0; index < clueCount; index += 1) flow = flow.acceptClue(input.clues[index]!.clueId);
  const acceptedAt = "2026-08-02T10:00:00.000Z";
  const answered = flow.acceptAnswer({ transitionId, candidateId, acceptedAt });
  const outcome = answered.reveal({ authority: data.authority, request, guards });
  if (!("result" in outcome)) throw new Error("expected an authorized provenance outcome");
  const acceptedAnswer = outcome.answeredRoundPlay.acceptedAnswer;
  if (!acceptedAnswer) throw new Error("expected the authoritative accepted answer");
  const event = deepFreeze({
    eventId: acceptedAnswer.answerId,
    eventFamilyId: "ANSWER_ACCEPTED" as const,
    schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
    acceptedAt: acceptedAnswer.acceptedAt,
    participantLineageId: request.participantLineageId,
    betaDay: request.betaDay,
    manifestLineageId: request.manifestLineageId,
    manifestVersionId: request.manifestVersionId,
    sessionId: request.sessionId,
    roundId: request.roundId,
    candidateSetVersionId: data.regime.versionId,
    candidateId: acceptedAnswer.candidateId,
    candidateCount: data.regime.candidates.length,
    clueCount: outcome.result.cluesUsed,
    mode: "provenance" as const,
    scoringVersionId: data.calibration.scoringVersionId,
  });
  return { event, outcome, data };
};

const auditAnswerEvent = (expected: Readonly<MutableRecord>, input: unknown): void => {
  const parsed = parseAuthoritativeEvent(input) as unknown as Readonly<MutableRecord>;
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(parsed).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) throw new Error("ANSWER_ACCEPTED field set drifted");
  for (const field of expectedKeys) {
    if (parsed[field] !== expected[field]) throw new Error(`ANSWER_ACCEPTED ${field} drifted`);
  }
};

describe("provenance calibration", () => {
  it("parses, reparses, detaches, and recursively freezes the exact chance-aware record", () => {
    const input = calibrationInput();
    const parsed = createProvenanceCalibration(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(createProvenanceCalibration(parsed)).toEqual(parsed);
    expect(recursivelyFrozen(parsed)).toBe(true);
  });

  it.each(Object.keys(calibrationInput()))("rejects missing, null, and undefined %s", (field) => {
    const valid = calibrationInput() as Readonly<MutableRecord>;
    expect(() => createProvenanceCalibration(omit(valid, field))).toThrow();
    expect(() => createProvenanceCalibration(Object.freeze({ ...valid, [field]: null }))).toThrow();
    expect(() => createProvenanceCalibration(Object.freeze({ ...valid, [field]: undefined }))).toThrow();
  });

  it.each(["versionId", "sourceRegimeVersionId", "clueSetVersionId", "scoringVersionId"] as const)("rejects blank %s", (field) => {
    expect(() => createProvenanceCalibration(Object.freeze({ ...calibrationInput(), [field]: " " }))).toThrow(/blank|field|version/i);
  });

  it("rejects extra fields, mutable input, invalid counts, and approximate chance", () => {
    expect(() => createProvenanceCalibration(Object.freeze({ ...calibrationInput(), extra: true }))).toThrow(/field|exact|unknown/i);
    expect(() => createProvenanceCalibration({ ...calibrationInput() })).toThrow(/frozen|immutable|boundary/i);
    for (const presentedCandidateCount of [0, 1, 1.5, 3]) {
      expect(() => createProvenanceCalibration(Object.freeze({ ...calibrationInput(), presentedCandidateCount }))).toThrow(/candidate|count|two/i);
    }
    for (const configuredClueCount of [-1, 0, 1, 1.5, 3]) {
      expect(() => createProvenanceCalibration(Object.freeze({ ...calibrationInput(), configuredClueCount }))).toThrow(/clue|count|two/i);
    }
    expect(() => createProvenanceCalibration(Object.freeze({ ...calibrationInput(), chanceBaseline: 0.5 + Number.EPSILON }))).toThrow(/chance|baseline/i);
  });

  it("binds the calibration record to the actual regime, clue set, clue count, and scoring rule", () => {
    const { input } = flowInput();
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, sourceRegimeVersionId: "wrong" }) })).toThrow(/calibration|regime/i);
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, presentedCandidateCount: 3, chanceBaseline: 1 / 3 }) })).toThrow(/candidate|calibration|two/i);
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, clueSetVersionId: "wrong" }) })).toThrow(/calibration|clue/i);
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, configuredClueCount: 1 }) })).toThrow(/calibration|clue|two/i);
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, scoringVersionId: "wrong" }) })).toThrow(/calibration|scoring/i);
  });

  it("requires the flow calibration boundary and publishes only its version plus the evidence version", () => {
    const { input } = flowInput();
    expect(() => createProvenanceFlow(omit(input as unknown as Readonly<MutableRecord>, "calibration"))).toThrow(/calibration|missing/i);
    expect(() => createProvenanceFlow({ ...input, calibration: { ...input.calibration } })).toThrow(/frozen|calibration|boundary/i);
    expect(() => createProvenanceFlow({ ...input, calibration: Object.freeze({ ...input.calibration, extra: true }) })).toThrow(/field|calibration|unknown/i);
    const publicRound = createProvenanceFlow(input).publicRound();
    expect(publicRound.versions).toEqual({
      round: "round-flow-v1", excerpt: "excerpt-flow-v1", candidates: "regime-flow-v1", clues: "clues-flow-v1",
      scoring: "scoring-flow-v1", rules: "rules-flow-v1", mode: "mode-flow-v1", sourceRegime: "regime-flow-v1",
      calibration: "provenance-calibration-v1", evidence: "evidence-flow-v1",
    });
    expect(JSON.stringify(publicRound)).not.toMatch(/chanceBaseline|presentedCandidateCount|correctSource|correctness|sourceClass/i);
  });

  it.each([
    [0, "candidate-human"], [0, "candidate-model"],
    [1, "candidate-human"], [1, "candidate-model"],
    [2, "candidate-human"], [2, "candidate-model"],
  ] as const)("maps the actual %i-clue %s outcome to the exact authoritative event", (clueCount, candidateId) => {
    const { event, outcome } = answerEvent(candidateId, clueCount);
    auditAnswerEvent(event, event);
    const parsed = parseAuthoritativeEvent(event);
    expect(parsed).toEqual(event);
    expect(parsed).not.toBe(event);
    const reparsed = parseAuthoritativeEvent(parsed);
    expect(reparsed).toEqual(parsed);
    expect(reparsed).not.toBe(parsed);
    expect(parsed.eventId).toBe(outcome.answeredRoundPlay.acceptedAnswer?.answerId);
    expect(parsed).toMatchObject({ candidateId, candidateCount: 2, clueCount, mode: "provenance", scoringVersionId: "scoring-flow-v1" });
    expect(recursivelyFrozen(parsed)).toBe(true);
    expect(recursivelyFrozen(reparsed)).toBe(true);
  });

  it.each([
    ["eventId", "different-transition"], ["eventFamilyId", "ROUND_DISPLAYED"], ["schemaVersionId", "authoritative-events-v2"],
    ["acceptedAt", "2026-08-02T10:00:01.000Z"],
    ["participantLineageId", "different-participant"], ["betaDay", "2026-08-03"],
    ["manifestLineageId", "different-lineage"], ["manifestVersionId", "different-manifest"],
    ["sessionId", "different-session"], ["roundId", "different-round"],
    ["candidateSetVersionId", "different-regime"], ["candidateId", "candidate-model"],
    ["candidateCount", 3], ["clueCount", 1], ["mode", "language"], ["scoringVersionId", "different-scoring"],
  ] as const)("rejects authoritative event binding drift in %s", (field, value) => {
    const { event } = answerEvent("candidate-human", 0);
    expect(() => auditAnswerEvent(event, deepFreeze({ ...event, [field]: value }))).toThrow(/drift|field|schema|version/i);
  });

  it.each(["correctness", "chanceBaseline", "calibrationVersionId", "sourceClass", "correctCandidateId", "candidateLabel", "evidence", "reveal", "code", "prompt"])("rejects private or inapplicable ANSWER_ACCEPTED field %s", (field) => {
    const { event } = answerEvent("candidate-human", 0);
    expect(() => auditAnswerEvent(event, deepFreeze({ ...event, [field]: "forbidden" }))).toThrow();
    expect(() => auditAnswerEvent(event, deepFreeze({ ...event, [field]: null }))).toThrow();
  });
});
