import { describe, expect, it } from "vitest";

import {
  createLanguageCandidatePresentation,
  createLanguageCandidateSet,
  resolveLanguageCandidateId,
  type LanguageCandidatePresentation,
  type LanguageCandidateSet,
} from "../../../packages/domain/src/index.js";

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
};

const candidateInput = (
  count: 3 | 4 = 4,
  kind: "deterministic" | "randomized" = "deterministic",
) => {
  const candidates = [
    { id: "lang-ts-01", canonicalLabel: "TypeScript", aliases: ["ts"], distractorRationale: null },
    { id: "lang-js-01", canonicalLabel: "JavaScript", aliases: ["js"], distractorRationale: "No static type syntax." },
    { id: "lang-kotlin-01", canonicalLabel: "Kotlin", aliases: ["kt"], distractorRationale: "Different declaration syntax." },
    { id: "lang-swift-01", canonicalLabel: "Swift", aliases: ["swiftlang"], distractorRationale: "Different generic syntax." },
  ].slice(0, count);
  return deepFreeze({
    versionId: `language-set-${count}-v1`,
    presentedCandidateCount: count,
    correctCandidateId: "lang-ts-01",
    candidates,
    orderingPolicy: { versionId: `language-order-${kind}-v1`, kind },
    clueSetVersionId: "language-clues-v1",
    cluePolicyVersionId: "language-clue-policy-v1",
    scoringVersionId: "language-scoring-v1",
    clues: [
      { clueId: "clue-one", clueVersionId: "clue-one-v1", order: 1 },
      { clueId: "clue-two", clueVersionId: "clue-two-v1", order: 2 },
    ],
    calibration: {
      versionId: `language-calibration-${count}-v1`,
      candidateSetVersionId: `language-set-${count}-v1`,
      presentedCandidateCount: count,
      chanceBaseline: 1 / count,
      cluePolicyVersionId: "language-clue-policy-v1",
      configuredClueCount: 2,
      scoringVersionId: "language-scoring-v1",
    },
  });
};

const deterministicRecord = (candidateSet: LanguageCandidateSet, sessionId = "session-language") => deepFreeze({
  recordId: "ordering-record-deterministic-v1",
  sessionId,
  candidateSetVersionId: candidateSet.versionId,
  policyVersionId: candidateSet.orderingPolicy.versionId,
  kind: "deterministic" as const,
  presentedCandidateIds: candidateSet.candidates.map(({ id }) => id),
});

const randomizedRecord = (candidateSet: LanguageCandidateSet, sessionId = "session-language") => deepFreeze({
  recordId: "ordering-record-randomized-v1",
  sessionId,
  candidateSetVersionId: candidateSet.versionId,
  policyVersionId: candidateSet.orderingPolicy.versionId,
  kind: "randomized" as const,
  presentedCandidateIds: [
    candidateSet.candidates[2]!.id,
    candidateSet.candidates[0]!.id,
    candidateSet.candidates[1]!.id,
    ...candidateSet.candidates.slice(3).map(({ id }) => id),
  ],
  randomizationRecordId: "randomization-language-v1",
  recordedAt: "2026-08-03T09:59:00.000Z",
});

const exactValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => exactValue(entry, right[index]));
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord);
  return leftKeys.length === Object.keys(rightRecord).length && leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(rightRecord, key) && exactValue(leftRecord[key], rightRecord[key]));
};

const auditOrdering = (
  candidateSet: LanguageCandidateSet,
  presentation: LanguageCandidatePresentation,
  authoritativeSessionId = "session-language",
): Readonly<{ candidateSet: LanguageCandidateSet; presentation: LanguageCandidatePresentation }> => {
  const reparsedSet = createLanguageCandidateSet(candidateSet);
  if (resolveLanguageCandidateId(reparsedSet, "TypeScript") !== reparsedSet.correctCandidateId) {
    throw new Error("candidate set certification failed");
  }
  const reparsedPresentation = createLanguageCandidatePresentation(reparsedSet, presentation.orderingRecord);
  if (!exactValue(reparsedPresentation, presentation)) throw new Error("presentation reconstruction drifted");
  if (reparsedPresentation.orderingRecord.sessionId !== authoritativeSessionId) {
    throw new Error("ordering record is not bound to the authoritative session");
  }
  if (reparsedPresentation.presentedCandidateCount !== reparsedSet.presentedCandidateCount) {
    throw new Error("presentation candidate count drifted");
  }
  if (reparsedSet.calibration.candidateSetVersionId !== reparsedSet.versionId ||
    reparsedSet.calibration.presentedCandidateCount !== reparsedSet.presentedCandidateCount ||
    reparsedSet.calibration.chanceBaseline !== 1 / reparsedSet.presentedCandidateCount ||
    reparsedSet.calibration.cluePolicyVersionId !== reparsedSet.cluePolicyVersionId ||
    reparsedSet.calibration.configuredClueCount !== reparsedSet.clues.length ||
    reparsedSet.calibration.scoringVersionId !== reparsedSet.scoringVersionId) {
    throw new Error("calibration is not exactly bound to the candidate set");
  }
  return Object.freeze({ candidateSet: reparsedSet, presentation: reparsedPresentation });
};

describe("language candidate ordering audit", () => {
  it.each([3, 4] as const)("reconstructs a %i-candidate exact chance baseline without rounding", (count) => {
    const candidateSet = createLanguageCandidateSet(candidateInput(count));
    const presentation = createLanguageCandidatePresentation(candidateSet, deterministicRecord(candidateSet));
    const audited = auditOrdering(candidateSet, presentation);

    expect(audited.candidateSet).not.toBe(candidateSet);
    expect(audited.presentation).not.toBe(presentation);
    expect(audited.candidateSet.correctCandidateId).toBe("lang-ts-01");
    expect(audited.candidateSet.correctCandidateId).not.toBe("typescript");
    expect(audited.candidateSet.calibration.chanceBaseline).toBe(1 / count);
    expect(audited.presentation.presentedCandidateCount).toBe(count);
    expect(audited.candidateSet.candidates).not.toBe(candidateSet.candidates);
    expect(audited.candidateSet.candidates[0]).not.toBe(candidateSet.candidates[0]);
    expect(audited.candidateSet.candidates[0]?.aliases).not.toBe(candidateSet.candidates[0]?.aliases);
    expect(audited.candidateSet.orderingPolicy).not.toBe(candidateSet.orderingPolicy);
    expect(audited.candidateSet.clues).not.toBe(candidateSet.clues);
    expect(audited.candidateSet.calibration).not.toBe(candidateSet.calibration);
    expect(audited.presentation.candidateIds).not.toBe(presentation.candidateIds);
    expect(audited.presentation.orderingRecord).not.toBe(presentation.orderingRecord);
    expect(audited.presentation.orderingRecord.presentedCandidateIds)
      .not.toBe(presentation.orderingRecord.presentedCandidateIds);
    expect(recursivelyFrozen(audited)).toBe(true);
  });

  it("preserves declared order for the deterministic policy and authoritative session", () => {
    const candidateSet = createLanguageCandidateSet(candidateInput());
    const record = deterministicRecord(candidateSet);
    const presentation = createLanguageCandidatePresentation(candidateSet, record);
    const audited = auditOrdering(candidateSet, presentation);

    expect(audited.presentation.candidateIds).toEqual(candidateSet.candidates.map(({ id }) => id));
    expect(audited.presentation.orderingRecord).toEqual(record);
    expect(audited.presentation.orderingRecord).not.toBe(record);
  });

  it("preserves an explicit randomized permutation and its durable record evidence", () => {
    const candidateSet = createLanguageCandidateSet(candidateInput(4, "randomized"));
    const record = randomizedRecord(candidateSet);
    const presentation = createLanguageCandidatePresentation(candidateSet, record);
    const audited = auditOrdering(candidateSet, presentation);

    expect(audited.presentation.candidateIds).toEqual(record.presentedCandidateIds);
    expect(audited.presentation.orderingRecord).toMatchObject({
      kind: "randomized",
      recordId: "ordering-record-randomized-v1",
      randomizationRecordId: "randomization-language-v1",
      recordedAt: "2026-08-03T09:59:00.000Z",
    });
    expect(new Set(audited.presentation.candidateIds)).toEqual(new Set(candidateSet.candidates.map(({ id }) => id)));
    expect(audited.presentation).not.toBe(presentation);
    expect(audited.presentation.candidateIds).not.toBe(presentation.candidateIds);
    expect(audited.presentation.orderingRecord).not.toBe(record);
    expect(audited.presentation.orderingRecord.presentedCandidateIds).not.toBe(record.presentedCandidateIds);
    expect(recursivelyFrozen(audited)).toBe(true);
  });

  it("rejects an otherwise valid ordering record bound to another authoritative session", () => {
    const candidateSet = createLanguageCandidateSet(candidateInput());
    const presentation = createLanguageCandidatePresentation(candidateSet, deterministicRecord(candidateSet, "other-session"));
    expect(() => auditOrdering(candidateSet, presentation)).toThrow(/session/i);
  });

  it.each([
    ["presented count", (presentation: LanguageCandidatePresentation) => ({ ...presentation, presentedCandidateCount: 3 })],
    ["presented order", (presentation: LanguageCandidatePresentation) => ({ ...presentation, candidateIds: [...presentation.candidateIds].reverse() })],
  ] as const)("rejects structural presentation drift: %s", (_name, alter) => {
    const candidateSet = createLanguageCandidateSet(candidateInput());
    const presentation = createLanguageCandidatePresentation(candidateSet, deterministicRecord(candidateSet));
    expect(() => auditOrdering(candidateSet, deepFreeze(alter(presentation)) as LanguageCandidatePresentation)).toThrow(/presentation/i);
  });

  it.each([
    ["set version", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, candidateSetVersionId: "other-set" })],
    ["policy version", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, policyVersionId: "other-policy" })],
    ["reordered deterministic IDs", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, presentedCandidateIds: [...record.presentedCandidateIds].reverse() })],
    ["duplicate ID", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, presentedCandidateIds: [record.presentedCandidateIds[0], record.presentedCandidateIds[0], ...record.presentedCandidateIds.slice(2)] })],
    ["unknown ID", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, presentedCandidateIds: [...record.presentedCandidateIds.slice(0, -1), "ruby"] })],
    ["extra field", (record: ReturnType<typeof deterministicRecord>) => ({ ...record, guessedOrder: true })],
  ] as const)("rejects deterministic ordering drift: %s", (_name, alter) => {
    const candidateSet = createLanguageCandidateSet(candidateInput());
    expect(() => createLanguageCandidatePresentation(candidateSet, deepFreeze(alter(deterministicRecord(candidateSet))))).toThrow();
  });

  it("rejects mutable deterministic roots and nested orders", () => {
    const candidateSet = createLanguageCandidateSet(candidateInput());
    const record = deterministicRecord(candidateSet);
    expect(() => createLanguageCandidatePresentation(candidateSet, { ...record })).toThrow(/frozen/i);
    expect(() => createLanguageCandidatePresentation(candidateSet, Object.freeze({ ...record, presentedCandidateIds: [...record.presentedCandidateIds] }))).toThrow(/frozen/i);
  });

  it.each([
    ["missing randomization record", (record: ReturnType<typeof randomizedRecord>) => {
      const copy = { ...record } as Record<string, unknown>;
      delete copy.randomizationRecordId;
      return copy;
    }],
    ["blank randomization record", (record: ReturnType<typeof randomizedRecord>) => ({ ...record, randomizationRecordId: " " })],
    ["missing record time", (record: ReturnType<typeof randomizedRecord>) => {
      const copy = { ...record } as Record<string, unknown>;
      delete copy.recordedAt;
      return copy;
    }],
    ["blank record time", (record: ReturnType<typeof randomizedRecord>) => ({ ...record, recordedAt: " " })],
    ["duplicate ID", (record: ReturnType<typeof randomizedRecord>) => ({ ...record, presentedCandidateIds: [record.presentedCandidateIds[0], record.presentedCandidateIds[0], ...record.presentedCandidateIds.slice(2)] })],
    ["unknown ID", (record: ReturnType<typeof randomizedRecord>) => ({ ...record, presentedCandidateIds: [...record.presentedCandidateIds.slice(0, -1), "ruby"] })],
    ["extra field", (record: ReturnType<typeof randomizedRecord>) => ({ ...record, randomSeed: "not-permitted" })],
  ] as const)("rejects randomized ordering without exact recorded evidence: %s", (_name, alter) => {
    const candidateSet = createLanguageCandidateSet(candidateInput(4, "randomized"));
    expect(() => createLanguageCandidatePresentation(candidateSet, deepFreeze(alter(randomizedRecord(candidateSet))))).toThrow();
  });

  it("rejects policy/record kind substitution and mutable randomized evidence", () => {
    const deterministicSet = createLanguageCandidateSet(candidateInput());
    expect(() => createLanguageCandidatePresentation(deterministicSet, randomizedRecord(deterministicSet))).toThrow(/kind|policy/i);

    const randomizedSet = createLanguageCandidateSet(candidateInput(4, "randomized"));
    const record = randomizedRecord(randomizedSet);
    expect(() => createLanguageCandidatePresentation(randomizedSet, { ...record })).toThrow(/frozen/i);
    expect(() => createLanguageCandidatePresentation(randomizedSet, Object.freeze({ ...record, presentedCandidateIds: [...record.presentedCandidateIds] }))).toThrow(/frozen/i);
  });

  it.each([
    ["candidate count", (input: ReturnType<typeof candidateInput>) => ({ ...input, presentedCandidateCount: 3 })],
    ["calibration set", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, candidateSetVersionId: "other-set" } })],
    ["calibration count", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, presentedCandidateCount: 3 } })],
    ["chance baseline", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, chanceBaseline: 0.25 + Number.EPSILON } })],
    ["clue policy", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, cluePolicyVersionId: "other-policy" } })],
    ["configured clues", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, configuredClueCount: 1 } })],
    ["scoring version", (input: ReturnType<typeof candidateInput>) => ({ ...input, calibration: { ...input.calibration, scoringVersionId: "other-scoring" } })],
  ] as const)("rejects calibration or count drift: %s", (_name, alter) => {
    expect(() => createLanguageCandidateSet(deepFreeze(alter(candidateInput())))).toThrow(/calibration|count|size/i);
  });
});
