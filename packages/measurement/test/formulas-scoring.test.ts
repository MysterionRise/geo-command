import { describe, expect, it } from "vitest";
import { reproduceEntertainmentScore } from "../src/formulas/scoring.js";

const valid = (correct = true, clueCount: 0 | 1 | 2 = 0) => Object.freeze({
  formulaVersionId: "entertainment-score-formula-v1",
  scoringVersionId: "scoring-v1",
  correct,
  clueCount,
});

const omit = (value: Readonly<Record<string, unknown>>, field: string) => {
  const copy = { ...value };
  delete copy[field];
  return Object.freeze(copy);
};

describe("frozen entertainment scoring formula", () => {
  it.each([
    [true, 0, 1000], [true, 1, 800], [true, 2, 500],
    [false, 0, 0], [false, 1, 0], [false, 2, 0],
  ] as const)("reproduces correct=%s clues=%i as %i points", (correct, clueCount, points) => {
    const input = valid(correct, clueCount);
    const result = reproduceEntertainmentScore(input);
    expect(result).toEqual({
      measureId: "ENTERTAINMENT_SCORE",
      classification: "ENTERTAINMENT_ONLY",
      formulaVersionId: "entertainment-score-formula-v1",
      scoringVersionId: "scoring-v1",
      correct,
      clueCount,
      points,
      maximumPoints: 1000,
    });
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/combined|ability|difficulty|skill|caus|comparison|delta|rank/i);
  });

  it.each(["formulaVersionId", "scoringVersionId", "correct", "clueCount"])("rejects missing, null, and undefined %s", (field) => {
    const input = valid() as unknown as Readonly<Record<string, unknown>>;
    expect(() => reproduceEntertainmentScore(omit(input, field))).toThrow();
    expect(() => reproduceEntertainmentScore(Object.freeze({ ...input, [field]: null }))).toThrow();
    expect(() => reproduceEntertainmentScore(Object.freeze({ ...input, [field]: undefined }))).toThrow();
  });

  it("rejects mutable, extra, blank-version, invalid-correctness, and invalid-clue inputs", () => {
    expect(() => reproduceEntertainmentScore({ ...valid() })).toThrow(/frozen|immutable|boundary/i);
    expect(() => reproduceEntertainmentScore(Object.freeze({ ...valid(), extra: true }))).toThrow(/field|shape|extra|unknown/i);
    for (const formulaVersionId of ["", " "]) expect(() => reproduceEntertainmentScore(Object.freeze({ ...valid(), formulaVersionId }))).toThrow(/formula|version|blank/i);
    for (const scoringVersionId of ["", " "]) expect(() => reproduceEntertainmentScore(Object.freeze({ ...valid(), scoringVersionId }))).toThrow(/scoring|version|blank/i);
    for (const correct of [0, 1, "true"]) expect(() => reproduceEntertainmentScore(Object.freeze({ ...valid(), correct }))).toThrow(/correct|boolean/i);
    for (const clueCount of [-1, 1.5, 3, Number.NaN]) expect(() => reproduceEntertainmentScore(Object.freeze({ ...valid(), clueCount }))).toThrow(/clue|count/i);
  });

  it("reparses detached output inputs deterministically without adding analytical claims", () => {
    const first = reproduceEntertainmentScore(valid(true, 1));
    const second = reproduceEntertainmentScore(Object.freeze({
      formulaVersionId: first.formulaVersionId,
      scoringVersionId: first.scoringVersionId,
      correct: first.correct,
      clueCount: first.clueCount,
    }));
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(Object.keys(second).sort()).toEqual([
      "classification", "clueCount", "correct", "formulaVersionId", "maximumPoints", "measureId", "points", "scoringVersionId",
    ]);
  });
});
