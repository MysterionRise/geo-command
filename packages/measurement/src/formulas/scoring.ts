import { asRecord, assertDeepFrozen, exact, fail, text } from "./types.js";

const FIELDS = ["formulaVersionId", "scoringVersionId", "correct", "clueCount"] as const;

export const reproduceEntertainmentScore = (value: unknown) => {
  assertDeepFrozen(value);
  const raw = asRecord(value, "entertainment scoring input"); exact(raw, FIELDS, "entertainment scoring input");
  const formulaVersionId = text(raw.formulaVersionId, "formulaVersionId");
  const scoringVersionId = text(raw.scoringVersionId, "scoringVersionId");
  if (typeof raw.correct !== "boolean") fail("correct must be boolean");
  if (raw.clueCount !== 0 && raw.clueCount !== 1 && raw.clueCount !== 2) fail("clueCount must be zero, one, or two");
  const correct = raw.correct;
  const clueCount = raw.clueCount;
  const points = correct ? ([1000, 800, 500] as const)[clueCount] : 0;
  return Object.freeze({ measureId: "ENTERTAINMENT_SCORE" as const, classification: "ENTERTAINMENT_ONLY" as const,
    formulaVersionId, scoringVersionId, correct, clueCount, points, maximumPoints: 1000 as const });
};
