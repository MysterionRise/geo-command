import { describe, expect, it } from "vitest";

import {
  RoundPlay,
  RoundRuleError,
  type RoundDefinitionInput,
} from "../src/round/index.js";

const definition = (clueCount: 0 | 1 | 2 = 2): RoundDefinitionInput => ({
  roundVersionId: "round-version-4",
  scoringVersionId: "scoring-version-1",
  baseExcerpt: {
    referenceId: "excerpt-reference-7",
    versionId: "excerpt-version-3",
  },
  clueSetVersionId: "clue-set-version-2",
  clues: [
    { clueId: "clue-1", clueVersionId: "clue-version-1", order: 1 },
    { clueId: "clue-2", clueVersionId: "clue-version-2", order: 2 },
  ].slice(0, clueCount) as RoundDefinitionInput["clues"],
});

const answer = (correct: boolean) => ({
  answerId: "accepted-answer-1",
  candidateId: "candidate-3",
  acceptedAt: "2026-09-01T00:15:00.000Z",
  candidateCount: 5,
  correct,
});

describe("round clues and fixed scoring", () => {
  it("creates a deeply immutable versioned round definition", () => {
    const play = RoundPlay.create(definition());

    expect(play.definition.roundVersionId).toBe("round-version-4");
    expect(play.definition.scoringVersionId).toBe("scoring-version-1");
    expect(play.definition.clueSetVersionId).toBe("clue-set-version-2");
    expect(play.definition.baseExcerpt).toEqual({
      referenceId: "excerpt-reference-7",
      versionId: "excerpt-version-3",
    });
    expect(Object.isFrozen(play.definition)).toBe(true);
    expect(Object.isFrozen(play.definition.clues)).toBe(true);
    expect(Object.isFrozen(play.definition.baseExcerpt)).toBe(true);
  });

  it("rejects a clue set that is out of order", () => {
    const input = definition();
    const reversed = { ...input, clues: [...input.clues].reverse() };

    expect(() => RoundPlay.create(reversed)).toThrowError(
      new RoundRuleError("clues must be ordered consecutively from one"),
    );
  });

  it("rejects a third configured clue", () => {
    const input = definition();
    expect(() => RoundPlay.create({
      ...input,
      clues: [
        ...input.clues,
        { clueId: "clue-3", clueVersionId: "clue-version-3", order: 3 as 2 },
      ],
    })).toThrow("a round may define at most two clues");
  });

  it("accepts clues only in order and preserves earlier state", () => {
    const initial = RoundPlay.create(definition());
    expect(() => initial.acceptClue("clue-2")).toThrow("next clue must be clue-1");

    const afterFirst = initial.acceptClue("clue-1");
    const afterSecond = afterFirst.acceptClue("clue-2");
    expect(initial.acceptedClueIds).toEqual([]);
    expect(afterFirst.acceptedClueIds).toEqual(["clue-1"]);
    expect(afterSecond.acceptedClueIds).toEqual(["clue-1", "clue-2"]);
    expect(() => afterSecond.acceptClue("clue-3")).toThrow("no more clues are available");
  });

  it("rejects a clue after an answer", () => {
    const answered = RoundPlay.create(definition()).acceptAnswer(answer(true));
    expect(() => answered.acceptClue("clue-1")).toThrow(
      "clues cannot be accepted after an answer",
    );
  });

  it("accepts one answer with immutable candidate facts", () => {
    const initial = RoundPlay.create(definition());
    const answered = initial.acceptAnswer(answer(true));

    expect(answered.acceptedAnswer).toMatchObject({
      answerId: "accepted-answer-1",
      candidateId: "candidate-3",
      candidateCount: 5,
      acceptedAt: "2026-09-01T00:15:00.000Z",
    });
    expect(Object.isFrozen(answered.acceptedAnswer)).toBe(true);
    expect(initial.acceptedAnswer).toBe(null);
    expect(() => answered.acceptAnswer(answer(false))).toThrow(
      "an answer was already accepted",
    );
  });

  it.each([
    { clues: 0, points: 1000 },
    { clues: 1, points: 800 },
    { clues: 2, points: 500 },
  ] as const)("awards $points for a correct answer after $clues clues", ({ clues, points }) => {
    let play = RoundPlay.create(definition());
    if (clues >= 1) play = play.acceptClue("clue-1");
    if (clues >= 2) play = play.acceptClue("clue-2");

    const result = play.acceptAnswer(answer(true)).result();
    expect(result).toMatchObject({
      classification: "ENTERTAINMENT_ONLY",
      correct: true,
      points,
      maximumPoints: 1000,
      cluesUsed: clues,
      roundVersionId: "round-version-4",
      scoringVersionId: "scoring-version-1",
    });
  });

  it.each([0, 1, 2] as const)("awards zero for an incorrect answer after %s clues", (clues) => {
    let play = RoundPlay.create(definition());
    if (clues >= 1) play = play.acceptClue("clue-1");
    if (clues >= 2) play = play.acceptClue("clue-2");

    expect(play.acceptAnswer(answer(false)).result().points).toBe(0);
  });

  it("keeps accepted-answer and scoring facts immutable for later correction consumers", () => {
    const answered = RoundPlay.create(definition())
      .acceptClue("clue-1")
      .acceptAnswer(answer(true));
    const facts = answered.result();

    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(answered.acceptedAnswer)).toBe(true);
    expect(facts.points).toBe(800);
    expect(answered.result()).toBe(facts);
  });

  it("produces a spoiler-free entertainment projection", () => {
    const share = RoundPlay.create(definition())
      .acceptClue("clue-1")
      .acceptAnswer(answer(true))
      .spoilerFreeShare();
    const serialized = JSON.stringify(share).toLowerCase();
    const forbidden = [
      "answer",
      "code",
      "clue",
      "source",
      "language",
      "content",
      "attribution",
      "reveal",
      "url",
    ];

    expect(share).toEqual({
      formatVersion: "share-format-1",
      outcomeSymbol: "correct",
      points: 800,
      maximumPoints: 1000,
      hintsUsed: 1,
    });
    for (const forbiddenTerm of forbidden) {
      expect(serialized.includes(forbiddenTerm)).toBe(false);
    }
  });
});
