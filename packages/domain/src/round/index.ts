export interface BaseExcerptReference {
  readonly referenceId: string;
  readonly versionId: string;
}

export interface OrderedClueReference {
  readonly clueId: string;
  readonly clueVersionId: string;
  readonly order: 1 | 2;
}

export interface RoundDefinitionInput {
  readonly roundVersionId: string;
  readonly scoringVersionId: string;
  readonly baseExcerpt: BaseExcerptReference;
  readonly clueSetVersionId: string;
  readonly clues: readonly OrderedClueReference[];
}

export interface RoundDefinition extends RoundDefinitionInput {
  readonly baseExcerpt: BaseExcerptReference;
  readonly clues: readonly OrderedClueReference[];
}

export interface AcceptRoundAnswerInput {
  readonly answerId: string;
  readonly candidateId: string;
  readonly acceptedAt: string;
  readonly candidateCount: number;
  readonly correct: boolean;
}

export interface AcceptedRoundAnswer extends AcceptRoundAnswerInput {}

export interface EntertainmentRoundResult {
  readonly classification: "ENTERTAINMENT_ONLY";
  readonly correct: boolean;
  readonly points: 0 | 500 | 800 | 1000;
  readonly maximumPoints: 1000;
  readonly cluesUsed: 0 | 1 | 2;
  readonly roundVersionId: string;
  readonly scoringVersionId: string;
}

export interface SpoilerFreeRoundShare {
  readonly formatVersion: "share-format-1";
  readonly outcomeSymbol: "correct" | "incorrect";
  readonly points: 0 | 500 | 800 | 1000;
  readonly maximumPoints: 1000;
  readonly hintsUsed: 0 | 1 | 2;
}

export class RoundRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RoundRuleError";
  }
}

const CORRECT_POINTS = Object.freeze([1000, 800, 500] as const);

const nonBlank = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RoundRuleError(`${field} must not be empty`);
  }
  return value.trim();
};

const freezeDefinition = (input: RoundDefinitionInput): RoundDefinition => {
  if (!Array.isArray(input.clues)) {
    throw new RoundRuleError("clues must be an array");
  }
  if (input.clues.length > 2) {
    throw new RoundRuleError("a round may define at most two clues");
  }
  const clues = Object.freeze(input.clues.map((clue, index) => {
    if (clue.order !== index + 1) {
      throw new RoundRuleError("clues must be ordered consecutively from one");
    }
    return Object.freeze({
      clueId: nonBlank(clue.clueId, `clues[${index}].clueId`),
      clueVersionId: nonBlank(
        clue.clueVersionId,
        `clues[${index}].clueVersionId`,
      ),
      order: clue.order,
    });
  }));
  if (new Set(clues.map(({ clueId }) => clueId)).size !== clues.length) {
    throw new RoundRuleError("clueId values must be distinct");
  }
  if (
    new Set(clues.map(({ clueVersionId }) => clueVersionId)).size !== clues.length
  ) {
    throw new RoundRuleError("clueVersionId values must be distinct");
  }

  return Object.freeze({
    roundVersionId: nonBlank(input.roundVersionId, "roundVersionId"),
    scoringVersionId: nonBlank(input.scoringVersionId, "scoringVersionId"),
    baseExcerpt: Object.freeze({
      referenceId: nonBlank(input.baseExcerpt.referenceId, "baseExcerpt.referenceId"),
      versionId: nonBlank(input.baseExcerpt.versionId, "baseExcerpt.versionId"),
    }),
    clueSetVersionId: nonBlank(input.clueSetVersionId, "clueSetVersionId"),
    clues,
  });
};

const freezeAnswer = (input: AcceptRoundAnswerInput): AcceptedRoundAnswer => {
  const acceptedAt = nonBlank(input.acceptedAt, "acceptedAt");
  if (!Number.isFinite(Date.parse(acceptedAt))) {
    throw new RoundRuleError("acceptedAt must be a valid instant");
  }
  if (!Number.isInteger(input.candidateCount) || input.candidateCount < 1) {
    throw new RoundRuleError("candidateCount must be a positive integer");
  }
  if (typeof input.correct !== "boolean") {
    throw new RoundRuleError("correct must be a boolean");
  }
  return Object.freeze({
    answerId: nonBlank(input.answerId, "answerId"),
    candidateId: nonBlank(input.candidateId, "candidateId"),
    acceptedAt,
    candidateCount: input.candidateCount,
    correct: input.correct,
  });
};

export class RoundPlay {
  readonly #definition: RoundDefinition;
  readonly #acceptedClueIds: readonly string[];
  readonly #acceptedAnswer: AcceptedRoundAnswer | null;
  readonly #result: EntertainmentRoundResult | null;

  private constructor(
    definition: RoundDefinition,
    acceptedClueIds: readonly string[],
    acceptedAnswer: AcceptedRoundAnswer | null,
    result: EntertainmentRoundResult | null,
  ) {
    this.#definition = definition;
    this.#acceptedClueIds = Object.freeze([...acceptedClueIds]);
    this.#acceptedAnswer = acceptedAnswer;
    this.#result = result;
    Object.freeze(this);
  }

  public static create(input: RoundDefinitionInput): RoundPlay {
    return new RoundPlay(freezeDefinition(input), [], null, null);
  }

  public get definition(): RoundDefinition {
    return this.#definition;
  }

  public get acceptedClueIds(): readonly string[] {
    return this.#acceptedClueIds;
  }

  public get acceptedAnswer(): AcceptedRoundAnswer | null {
    return this.#acceptedAnswer;
  }

  public acceptClue(clueId: string): RoundPlay {
    if (this.#acceptedAnswer !== null) {
      throw new RoundRuleError("clues cannot be accepted after an answer");
    }
    const next = this.#definition.clues[this.#acceptedClueIds.length];
    if (!next) {
      throw new RoundRuleError("no more clues are available");
    }
    if (clueId !== next.clueId) {
      throw new RoundRuleError(`next clue must be ${next.clueId}`);
    }
    return new RoundPlay(
      this.#definition,
      [...this.#acceptedClueIds, next.clueId],
      null,
      null,
    );
  }

  public acceptAnswer(input: AcceptRoundAnswerInput): RoundPlay {
    if (this.#acceptedAnswer !== null) {
      throw new RoundRuleError("an answer was already accepted");
    }
    const acceptedAnswer = freezeAnswer(input);
    const cluesUsed = this.#acceptedClueIds.length as 0 | 1 | 2;
    const points = acceptedAnswer.correct ? CORRECT_POINTS[cluesUsed] : 0;
    const result = Object.freeze({
      classification: "ENTERTAINMENT_ONLY" as const,
      correct: acceptedAnswer.correct,
      points,
      maximumPoints: 1000 as const,
      cluesUsed,
      roundVersionId: this.#definition.roundVersionId,
      scoringVersionId: this.#definition.scoringVersionId,
    });
    return new RoundPlay(
      this.#definition,
      this.#acceptedClueIds,
      acceptedAnswer,
      result,
    );
  }

  public result(): EntertainmentRoundResult {
    if (this.#result === null) {
      throw new RoundRuleError("a result requires an accepted answer");
    }
    return this.#result;
  }

  public spoilerFreeShare(): SpoilerFreeRoundShare {
    const result = this.result();
    return Object.freeze({
      formatVersion: "share-format-1",
      outcomeSymbol: result.correct ? "correct" : "incorrect",
      points: result.points,
      maximumPoints: 1000,
      hintsUsed: result.cluesUsed,
    });
  }
}
