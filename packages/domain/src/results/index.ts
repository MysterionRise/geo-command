export type ResultCorrectionStatus = "VOID" | "CONTENT_WITHDRAWN";
export type SessionResultStatus = "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

export interface ExistingManifestBinding {
  sessionId: string;
  manifestVersionId: string;
}

export interface PreIssueReserveInput {
  currentManifestVersionId: string;
  successorManifestVersionId: string;
  affectedRoundId: string;
  reserveRoundId: string;
  affectedMode: string;
  reserveMode: string;
  affectedDifficulty: string;
  reserveDifficulty: string;
  currentManifestIssuanceCount: number;
  existingBindings: ExistingManifestBinding[];
}

export interface RoundResultInput {
  roundId: string;
  displayed: boolean;
  answered: boolean;
  revealed: boolean;
  correction: "ACTIVE" | ResultCorrectionStatus;
  noticeAcknowledged: boolean;
  maximumPoints: number;
  historicalScore: number | null;
  historicalAnswerId: string | null;
}

export interface SessionResultsInput {
  sessionId: string;
  betaDay: string;
  manifestLineageId: string;
  issuedManifestVersionId: string;
  lineageVersionIds: string[];
  lineageAnsweredRoundIds: string[];
  utcDayEndsAt: string;
  started: boolean;
  status: SessionResultStatus;
  rounds: RoundResultInput[];
}

export interface CorrectionNotice {
  readonly kind: ResultCorrectionStatus;
  readonly text: "Round voided" | "Content unavailable";
}

export interface RoundResultFact extends RoundResultInput {
  readonly notice: CorrectionNotice | null;
}

export interface SessionCorrectionRecord {
  readonly roundId: string;
  readonly branch: "ISSUED_UNANSWERED" | "POST_ANSWER";
  readonly silentReplacement: false;
  readonly affectedManifestVersionIds: readonly string[];
}

export class ResultsRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ResultsRuleError";
  }
}

const text = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ResultsRuleError(`${field} must not be empty`);
  }
  return value.trim();
};

const requireCorrection = (
  value: string,
  allowActive: boolean,
  label: string,
): void => {
  if (
    value !== "VOID" &&
    value !== "CONTENT_WITHDRAWN" &&
    !(allowActive && value === "ACTIVE")
  ) {
    throw new ResultsRuleError(`${label} correction is not supported`);
  }
};

const frozenBinding = (binding: ExistingManifestBinding): ExistingManifestBinding =>
  Object.freeze({
    sessionId: text(binding.sessionId, "binding.sessionId"),
    manifestVersionId: text(binding.manifestVersionId, "binding.manifestVersionId"),
  });

export function promoteReserveBeforeIssue(input: PreIssueReserveInput) {
  if (
    input.affectedMode !== input.reserveMode ||
    input.affectedDifficulty !== input.reserveDifficulty
  ) {
    throw new ResultsRuleError("reserve must match mode and approved difficulty");
  }
  if (input.currentManifestIssuanceCount !== 0) {
    throw new ResultsRuleError("current manifest version must have zero issuances");
  }
  const currentManifestVersionId = text(
    input.currentManifestVersionId,
    "currentManifestVersionId",
  );
  const successorManifestVersionId = text(
    input.successorManifestVersionId,
    "successorManifestVersionId",
  );
  const affectedRoundId = text(input.affectedRoundId, "affectedRoundId");
  const reserveRoundId = text(input.reserveRoundId, "reserveRoundId");
  if (
    successorManifestVersionId === currentManifestVersionId ||
    reserveRoundId === affectedRoundId
  ) {
    throw new ResultsRuleError(
      "successor manifest and reserve round identities must be new",
    );
  }
  return Object.freeze({
    priorManifestVersionId: currentManifestVersionId,
    futureIssuanceManifestVersionId: successorManifestVersionId,
    affectedRoundId,
    reserveRoundId,
    existingBindings: Object.freeze(input.existingBindings.map(frozenBinding)),
  });
}

export interface QuarantineAffectedRoundInput {
  affectedRoundId: string;
  affectedManifestVersionId: string;
  replacementManifestVersionId: string;
  quarantinedAt: string;
  contentCachePurgedAt: string;
  displayed: boolean;
  correction: ResultCorrectionStatus;
}

export function quarantineAffectedRound(input: QuarantineAffectedRoundInput) {
  const quarantinedAt = Date.parse(input.quarantinedAt);
  const purgedAt = Date.parse(input.contentCachePurgedAt);
  if (!Number.isFinite(quarantinedAt) || !Number.isFinite(purgedAt)) {
    throw new ResultsRuleError("quarantine times must be valid instants");
  }
  const affectedManifestVersionId = text(
    input.affectedManifestVersionId,
    "affectedManifestVersionId",
  );
  const replacementManifestVersionId = text(
    input.replacementManifestVersionId,
    "replacementManifestVersionId",
  );
  if (replacementManifestVersionId === affectedManifestVersionId) {
    throw new ResultsRuleError(
      "replacement manifest version must differ from affected version",
    );
  }
  requireCorrection(input.correction, false, "quarantine");
  const deadline = quarantinedAt + 5 * 60 * 1000;
  return Object.freeze({
    affectedRoundId: text(input.affectedRoundId, "affectedRoundId"),
    affectedManifestVersionId,
    contentBlocked: true,
    revealBlocked: true,
    affectedManifestEligibleForNewIssuance: false,
    currentManifestForUnissuedParticipants: replacementManifestVersionId,
    existingCredential: Object.freeze({
      revoked: false,
      allowedTransitions: Object.freeze([
        "CORRECTION_NOTICE",
        "UNAFFECTED_ROUND",
        "UNAFFECTED_REVEAL",
      ]),
    }),
    cachePurgeDeadline: new Date(deadline).toISOString(),
    cachePurgedWithinDeadline: purgedAt <= deadline,
    displayedContentTreatment: input.displayed
      ? "ALREADY_DISPLAYED_NOT_RECALLABLE" as const
      : "NOT_PREVIOUSLY_DISPLAYED" as const,
    publishedNotice: Object.freeze({
      kind: input.correction,
      text: input.correction === "VOID"
        ? "Round voided" as const
        : "Content unavailable" as const,
    }),
  });
}

const freezeRound = (
  round: RoundResultInput,
  notice: CorrectionNotice | null = null,
): RoundResultFact => {
  requireCorrection(round.correction, true, "round");
  return Object.freeze({
  roundId: text(round.roundId, "roundId"),
  displayed: round.displayed,
  answered: round.answered,
  revealed: round.revealed,
  correction: round.correction,
  noticeAcknowledged: round.noticeAcknowledged,
  maximumPoints: round.maximumPoints,
  historicalScore: round.historicalScore,
  historicalAnswerId: round.historicalAnswerId,
  notice,
  });
};

const readonlyFacts = Object.freeze({
  mayCreateAnswerFact: false,
  mayCreateScoreFact: false,
  mayCreateCompletionFact: false,
  mayCreateGateFact: false,
});

export class CorrectionAwareSession {
  readonly #input: Readonly<Omit<
    SessionResultsInput,
    "rounds" | "lineageVersionIds" | "lineageAnsweredRoundIds"
  >>;
  readonly #lineageVersionIds: readonly string[];
  readonly #lineageAnsweredRoundIds: readonly string[];
  readonly #rounds: readonly RoundResultFact[];
  readonly #lastCorrection: SessionCorrectionRecord | null;

  private constructor(
    input: Readonly<Omit<
      SessionResultsInput,
      "rounds" | "lineageVersionIds" | "lineageAnsweredRoundIds"
    >>,
    lineageVersionIds: readonly string[],
    lineageAnsweredRoundIds: readonly string[],
    rounds: readonly RoundResultFact[],
    lastCorrection: SessionCorrectionRecord | null,
  ) {
    this.#input = input;
    this.#lineageVersionIds = lineageVersionIds;
    this.#lineageAnsweredRoundIds = lineageAnsweredRoundIds;
    this.#rounds = rounds;
    this.#lastCorrection = lastCorrection;
    Object.freeze(this);
  }

  public static create(input: SessionResultsInput): CorrectionAwareSession {
    if (!Number.isFinite(Date.parse(input.utcDayEndsAt))) {
      throw new ResultsRuleError("utcDayEndsAt must be a valid instant");
    }
    if (input.status === "EXPIRED" && !input.started) {
      throw new ResultsRuleError("expired session must be started");
    }
    const base = Object.freeze({
      sessionId: text(input.sessionId, "sessionId"),
      betaDay: text(input.betaDay, "betaDay"),
      manifestLineageId: text(input.manifestLineageId, "manifestLineageId"),
      issuedManifestVersionId: text(
        input.issuedManifestVersionId,
        "issuedManifestVersionId",
      ),
      utcDayEndsAt: input.utcDayEndsAt,
      started: input.started,
      status: input.status,
    });
    const lineageVersionIds = input.lineageVersionIds.map((id) =>
      text(id, "lineageVersionId")
    );
    if (new Set(lineageVersionIds).size !== lineageVersionIds.length) {
      throw new ResultsRuleError("lineage versions must be distinct");
    }
    if (
      lineageVersionIds.filter((id) => id === base.issuedManifestVersionId).length !== 1
    ) {
      throw new ResultsRuleError(
        "lineage versions must contain the issued manifest version exactly once",
      );
    }
    return new CorrectionAwareSession(
      base,
      Object.freeze(lineageVersionIds),
      Object.freeze(
        input.lineageAnsweredRoundIds.map((id) => text(id, "lineageAnsweredRoundId")),
      ),
      Object.freeze(input.rounds.map((round) => freezeRound(round))),
      null,
    );
  }

  public get lastCorrection(): SessionCorrectionRecord | null {
    return this.#lastCorrection;
  }

  public round(roundId: string): RoundResultFact {
    const round = this.#rounds.find((candidate) => candidate.roundId === roundId);
    if (!round) throw new ResultsRuleError(`round ${roundId} was not found`);
    return round;
  }

  public correctRound(
    roundId: string,
    correction: ResultCorrectionStatus,
  ): CorrectionAwareSession {
    requireCorrection(correction, false, "round");
    const affected = this.round(roundId);
    if (affected.correction !== "ACTIVE") {
      throw new ResultsRuleError("round is already corrected");
    }
    const branch = affected.answered || this.#lineageAnsweredRoundIds.includes(roundId)
      ? "POST_ANSWER"
      : "ISSUED_UNANSWERED";
    const versions = branch === "POST_ANSWER"
      ? this.#lineageVersionIds
      : Object.freeze([this.#input.issuedManifestVersionId]);
    const notice = Object.freeze({
      kind: correction,
      text: correction === "VOID" ? "Round voided" as const : "Content unavailable" as const,
    });
    const rounds = Object.freeze(this.#rounds.map((round) =>
      round.roundId === roundId
        ? freezeRound({ ...round, correction, noticeAcknowledged: false }, notice)
        : round,
    ));
    const record = Object.freeze({
      roundId,
      branch,
      silentReplacement: false as const,
      affectedManifestVersionIds: Object.freeze([...versions]),
    });
    return new CorrectionAwareSession(
      this.#input,
      this.#lineageVersionIds,
      this.#lineageAnsweredRoundIds,
      rounds,
      record,
    );
  }

  public acknowledgeNotice(roundId: string): CorrectionAwareSession {
    const target = this.round(roundId);
    if (target.correction === "ACTIVE") {
      throw new ResultsRuleError("active round has no correction notice");
    }
    const rounds = Object.freeze(this.#rounds.map((round) =>
      round.roundId === roundId
        ? freezeRound({ ...round, noticeAcknowledged: true }, round.notice)
        : round,
    ));
    return new CorrectionAwareSession(
      this.#input,
      this.#lineageVersionIds,
      this.#lineageAnsweredRoundIds,
      rounds,
      this.#lastCorrection,
    );
  }

  public projection() {
    const active = this.#rounds.filter((round) => round.correction === "ACTIVE");
    const excluded = this.#rounds.filter((round) => round.correction !== "ACTIVE");
    return Object.freeze({
      attainableMaximum: active.reduce((sum, round) => sum + round.maximumPoints, 0),
      currentScore: active.reduce((sum, round) => sum + (round.historicalScore ?? 0), 0),
      streakProtected: excluded.length > 0,
      analyticallyExcludedRoundIds: Object.freeze(excluded.map((round) => round.roundId)),
      correctnessAnalysisIncluded: excluded.length === 0,
      clueAnalysisIncluded: excluded.length === 0,
      scoreAnalysisIncluded: excluded.length === 0,
    });
  }

  public completion() {
    const canComplete = this.#rounds.every((round) =>
      round.correction === "ACTIVE" ? round.revealed : round.noticeAcknowledged,
    );
    return Object.freeze({
      canComplete,
      streakEligible: canComplete,
      unaffectedCompletionIncluded: canComplete,
    });
  }

  public reenter(now: string) {
    const timestamp = Date.parse(now);
    if (!Number.isFinite(timestamp)) throw new ResultsRuleError("reentry time is invalid");
    if (this.#input.status === "COMPLETED" || this.#input.status === "EXPIRED") {
      return Object.freeze({
        access: "READ_ONLY" as const,
        status: this.#input.status,
        denominatorStarted: this.#input.started,
        ...readonlyFacts,
      });
    }
    const graceEndsAt = Date.parse(this.#input.utcDayEndsAt) + 60 * 60 * 1000;
    if (timestamp < graceEndsAt) {
      return Object.freeze({
        access: "RESUME" as const,
        status: this.#input.status,
        manifestVersionId: this.#input.issuedManifestVersionId,
        attributeAcceptedFactsToBetaDay: this.#input.betaDay,
      });
    }
    return Object.freeze({
      access: "READ_ONLY" as const,
      status: "EXPIRED" as const,
      denominatorStarted: this.#input.started,
      ...readonlyFacts,
    });
  }

  public share() {
    const projection = this.projection();
    return Object.freeze({
      formatVersion: "session-share-1",
      points: projection.currentScore,
      maximum: projection.attainableMaximum,
      symbols: Object.freeze(this.#rounds.map((round) =>
        round.correction === "ACTIVE" ? "■" : "⊘",
      )),
    });
  }
}

export function utcCompletionStreak(
  completionDays: readonly string[],
  _localizedDisplayDates: readonly string[],
): number {
  const days = [...new Set(completionDays)].sort();
  let streak = days.length === 0 ? 0 : 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = Date.parse(`${days[index - 1]}T00:00:00.000Z`);
    const current = Date.parse(`${days[index]}T00:00:00.000Z`);
    streak = current - previous === 86_400_000 ? streak + 1 : 1;
  }
  return streak;
}
