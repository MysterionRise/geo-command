import { describe, expect, it } from "vitest";

import {
  AUTHORITATIVE_EVENT_SCHEMA_VERSION,
  parseAuthoritativeEvent,
  type AuthoritativeEvent,
} from "../../../packages/measurement/src/index.js";
import { createLanguageFlow } from "../src/modes/language/server/language-flow.js";
import {
  deepFreeze,
  guards,
  languageFixture,
  request,
  transitionId,
} from "./support/language-flow-fixture.js";

const clueText = ["Look at the type annotation.", "Compare the runtime syntax."] as const;

const recursivelyFrozen = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

const flowInput = (clueCount: 0 | 1 | 2, candidateId = "lang-ts-01") => {
  const data = languageFixture({ clueCount, correctness: candidateId === "lang-ts-01" });
  const clues = Object.freeze(data.candidateSet.clues.map((clue, index) => Object.freeze({
    ...clue,
    text: clueText[index]!,
  })));
  return {
    data,
    input: deepFreeze({
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
      clues,
      controlAnnotation: null,
    }),
  };
};

const answer = (candidateId = "lang-ts-01") => Object.freeze({
  transitionId,
  candidateId,
  acceptedAt: "2026-08-03T10:00:00.000Z",
});

type AuditContext = Readonly<{
  answerId: string;
  acceptedAt: string;
  candidateSetVersionId: string;
  candidateId: string;
  candidateCount: number;
  clueCount: number;
  scoringVersionId: string;
}>;

const auditAnswerEvent = (value: unknown, context: AuditContext): AuthoritativeEvent => {
  const event = parseAuthoritativeEvent(value);
  if (event.eventFamilyId !== "ANSWER_ACCEPTED") throw new Error("answer event family drifted");
  const expected = {
    eventId: context.answerId,
    schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
    acceptedAt: context.acceptedAt,
    participantLineageId: request.participantLineageId,
    betaDay: request.betaDay,
    manifestLineageId: request.manifestLineageId,
    manifestVersionId: request.manifestVersionId,
    sessionId: request.sessionId,
    roundId: request.roundId,
    candidateSetVersionId: context.candidateSetVersionId,
    candidateId: context.candidateId,
    candidateCount: context.candidateCount,
    clueCount: context.clueCount,
    mode: "language",
    scoringVersionId: context.scoringVersionId,
  } as const;
  const eventRecord = event as unknown as Readonly<Record<string, unknown>>;
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (eventRecord[field] !== expectedValue) throw new Error(`authoritative answer mapping drifted at ${field}`);
  }
  return event;
};

const exercise = (clueCount: 0 | 1 | 2, candidateId = "lang-ts-01") => {
  const { data, input } = flowInput(clueCount, candidateId);
  let flow = createLanguageFlow(input);
  for (const { clueId } of data.candidateSet.clues) flow = flow.acceptClue(clueId);
  const outcome = flow.acceptAnswer(answer(candidateId)).reveal({ authority: data.authority, request, guards });
  if (!("answeredRoundPlay" in outcome)) throw new Error("authorized reveal did not produce an answered outcome");
  const acceptedAnswer = outcome.answeredRoundPlay.acceptedAnswer;
  if (acceptedAnswer === null) throw new Error("real answered RoundPlay has no accepted answer");
  const context = Object.freeze({
    answerId: acceptedAnswer.answerId,
    acceptedAt: acceptedAnswer.acceptedAt,
    candidateSetVersionId: data.candidateSet.versionId,
    candidateId: acceptedAnswer.candidateId,
    candidateCount: data.presentation.presentedCandidateCount,
    clueCount: outcome.result.cluesUsed,
    scoringVersionId: data.candidateSet.scoringVersionId,
  });
  const eventInput = deepFreeze({
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
    candidateSetVersionId: data.candidateSet.versionId,
    candidateId: acceptedAnswer.candidateId,
    candidateCount: data.presentation.presentedCandidateCount,
    clueCount: outcome.result.cluesUsed,
    mode: "language" as const,
    scoringVersionId: data.candidateSet.scoringVersionId,
  });
  return { data, flow, outcome, acceptedAnswer, context, eventInput };
};

describe("language calibration cross-contract audit", () => {
  it.each([0, 1, 2] as const)("binds configured and accepted clue count %i to the real answered flow", (clueCount) => {
    const { data, flow, outcome, acceptedAnswer, context, eventInput } = exercise(clueCount);
    const event = auditAnswerEvent(eventInput, context);
    const reparsed = parseAuthoritativeEvent(event);

    expect(data.candidateSet.calibration).toEqual({
      versionId: "language-calibration-v1",
      candidateSetVersionId: data.candidateSet.versionId,
      presentedCandidateCount: data.candidateSet.presentedCandidateCount,
      chanceBaseline: 1 / data.candidateSet.presentedCandidateCount,
      cluePolicyVersionId: data.candidateSet.cluePolicyVersionId,
      configuredClueCount: clueCount,
      scoringVersionId: data.candidateSet.scoringVersionId,
    });
    expect(flow.publicRound().versions.calibration).toBe(data.candidateSet.calibration.versionId);
    expect(flow.publicRound().versions.orderingRecord).toBe(data.presentation.orderingRecord.recordId);
    expect(outcome.result.cluesUsed).toBe(clueCount);
    expect(event).toMatchObject({
      eventId: acceptedAnswer.answerId,
      acceptedAt: acceptedAnswer.acceptedAt,
      candidateCount: data.presentation.presentedCandidateCount,
      clueCount,
      mode: "language",
    });
    expect(event).not.toBe(eventInput);
    expect(reparsed).not.toBe(event);
    expect(reparsed).toEqual(event);
    expect(recursivelyFrozen(event)).toBe(true);
    expect(recursivelyFrozen(reparsed)).toBe(true);
  });

  it("keeps the opaque answer transition as the authoritative event/reveal join", () => {
    const { acceptedAnswer, eventInput, context } = exercise(1);
    const event = auditAnswerEvent(eventInput, context);
    expect(event.eventFamilyId).toBe("ANSWER_ACCEPTED");
    if (event.eventFamilyId !== "ANSWER_ACCEPTED") throw new Error("unexpected family");
    expect(event.eventId).toBe(transitionId);
    expect(event.eventId).toBe(acceptedAnswer.answerId);
    expect(event.eventId).not.toBe(event.candidateId);
  });

  it.each([
    ["lang-ts-01", true],
    ["lang-js-01", false],
  ] as const)("maps the actually selected candidate %s without leaking correctness", (candidateId, correctness) => {
    const { eventInput, context, outcome } = exercise(1, candidateId);
    const event = auditAnswerEvent(eventInput, context);
    expect(event).toMatchObject({ candidateId, clueCount: 1 });
    expect(event).not.toHaveProperty("correctness");
    expect(outcome.publicProjection).toMatchObject({ correctness });
  });

  it("retains exact non-rounded one-third chance calibration while excluding it from the answer event", () => {
    const { data, eventInput, context } = exercise(2);
    const event = auditAnswerEvent(eventInput, context);
    expect(data.candidateSet.presentedCandidateCount).toBe(3);
    expect(data.candidateSet.calibration.chanceBaseline).toBe(1 / 3);
    expect(event).not.toHaveProperty("chanceBaseline");
    expect(event).not.toHaveProperty("calibrationVersionId");
  });

  it.each([
    ["event ID", { eventId: "another-answer-transition" }],
    ["acceptance time", { acceptedAt: "2026-08-03T10:00:01.000Z" }],
    ["participant lineage", { participantLineageId: "other-participant" }],
    ["beta day", { betaDay: "2026-08-04" }],
    ["manifest lineage", { manifestLineageId: "other-lineage" }],
    ["manifest version", { manifestVersionId: "other-manifest" }],
    ["session", { sessionId: "other-session" }],
    ["round", { roundId: "other-round" }],
    ["candidate set", { candidateSetVersionId: "other-candidate-set" }],
    ["candidate", { candidateId: "lang-js-01" }],
    ["candidate count", { candidateCount: 4 }],
    ["clue count", { clueCount: 0 }],
    ["mode", { mode: "provenance" }],
    ["scoring version", { scoringVersionId: "other-scoring" }],
    ["schema version", { schemaVersionId: "authoritative-events-v2" }],
  ] as const)("rejects authoritative ANSWER_ACCEPTED mapping drift: %s", (_name, change) => {
    const { eventInput, context } = exercise(1);
    expect(() => auditAnswerEvent(deepFreeze({ ...eventInput, ...change }), context)).toThrow();
  });

  it("rejects out-of-range actual clue-count evidence", () => {
    const { eventInput, context } = exercise(2);
    expect(() => auditAnswerEvent(deepFreeze({ ...eventInput, clueCount: 3 }), context)).toThrow(/clue|count|integer/i);
  });

  it.each(Object.entries({
    correctness: true,
    chanceBaseline: 1 / 3,
    calibrationVersionId: "language-calibration-v1",
    orderingRecordId: "language-ordering-record-v1",
    orderingPolicyVersionId: "language-ordering-policy-v1",
    correctCandidateId: "lang-ts-01",
    labels: ["TypeScript", "JavaScript", "Flow"],
    aliases: ["ts", "js", "flowtype"],
    distractorRationales: ["similar syntax"],
    cluePayload: { clueId: "language-clue-one" },
    clueText: "Look at the type annotation.",
    answer: { candidateId: "lang-ts-01" },
    reveal: { correctness: true },
    evidence: { evidenceVersionId: "evidence-language-v1" },
    prompt: "Which language?",
    code: "const typed: number = 1;",
  }))("rejects inapplicable or sensitive answer-event field %s", (field, value) => {
    const { eventInput, context } = exercise(1);
    expect(() => auditAnswerEvent(deepFreeze({ ...eventInput, [field]: value }), context)).toThrow();
    expect(() => auditAnswerEvent(deepFreeze({ ...eventInput, [field]: null }), context)).toThrow();
  });

  it("rejects mutable answer-event input", () => {
    const { eventInput, context } = exercise(1);
    expect(() => auditAnswerEvent({ ...eventInput }, context)).toThrow(/frozen|boundary/i);
  });

  it("keeps the audited pre-reveal projection spoiler-free while retaining required versions", () => {
    const { flow } = exercise(1);
    const publicRound = flow.publicRound();
    expect(publicRound).not.toHaveProperty("correctCandidateId");
    expect(publicRound).not.toHaveProperty("chanceBaseline");
    expect(publicRound).not.toHaveProperty("answer");
    expect(publicRound).not.toHaveProperty("reveal");
    expect(publicRound.versions.evidence).toBe("evidence-language-v1");
    expect(JSON.stringify(publicRound)).not.toMatch(/distractorRationale|creator-language|authorization-language|approvedEvidence/i);
  });
});
