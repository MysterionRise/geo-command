export type BetaDay = string;
export type RoundMode = "provenance" | "language";
export type RoundPosition = 1 | 2 | 3 | 4 | 5;

export interface ManifestRound {
  readonly position: RoundPosition;
  readonly roundId: string;
  readonly mode: RoundMode;
}

export type ManifestRounds = readonly [
  ManifestRound,
  ManifestRound,
  ManifestRound,
  ManifestRound,
  ManifestRound,
];

export interface InitialReleaseRecord {
  readonly kind: "INITIAL_RELEASE";
  readonly recordId: string;
}

export interface CorrectionRecord {
  readonly kind: "CORRECTION";
  readonly recordId: string;
  readonly reason: string;
}

export interface ReservePromotionRecord {
  readonly kind: "RESERVE_PROMOTION";
  readonly recordId: string;
  readonly reason: string;
}

export type SuccessorVersionRecord = CorrectionRecord | ReservePromotionRecord;
export type VersionRecord = InitialReleaseRecord | SuccessorVersionRecord;

export interface ManifestVersion {
  readonly betaDay: BetaDay;
  readonly lineageId: string;
  readonly versionId: string;
  readonly recordedAt: string;
  readonly record: VersionRecord;
  readonly rounds: ManifestRounds;
}

export interface ManifestLineage {
  readonly betaDay: BetaDay;
  readonly lineageId: string;
  readonly currentIssuanceVersionId: string;
  readonly versions: readonly ManifestVersion[];
}

export interface SessionManifestBinding {
  readonly sessionId: string;
  readonly participantId: string;
  readonly betaDay: BetaDay;
  readonly lineageId: string;
  readonly manifestVersionId: string;
  readonly issuedAt: string;
}

export interface CreateLineageInput {
  readonly betaDay: BetaDay;
  readonly lineageId: string;
  readonly initialVersionId: string;
  readonly recordedAt: string;
  readonly rounds: ManifestRounds;
}

export interface PromoteVersionInput {
  readonly betaDay: BetaDay;
  readonly versionId: string;
  readonly recordedAt: string;
  readonly record: SuccessorVersionRecord;
  readonly replacement: ManifestRound;
}

export interface IssueSessionInput {
  readonly sessionId: string;
  readonly participantId: string;
  readonly betaDay: BetaDay;
  readonly issuedAt: string;
}

export class ManifestRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ManifestRuleError";
  }
}

const UTC_DAY = /^\d{4}-\d{2}-\d{2}$/u;

const assertNonEmpty = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new ManifestRuleError(`${label} must not be empty`);
  }
};

const assertUtcDay = (day: BetaDay): void => {
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);
  if (
    !UTC_DAY.test(day) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== day
  ) {
    throw new ManifestRuleError(`${day} is not a valid UTC beta day`);
  }
};

const parseInstant = (instant: string): number => {
  const timestamp = Date.parse(instant);
  if (!Number.isFinite(timestamp)) {
    throw new ManifestRuleError(`${instant} is not a valid instant`);
  }

  return timestamp;
};

const instantInUtcDay = (instant: string, day: BetaDay): boolean =>
  new Date(parseInstant(instant)).toISOString().slice(0, 10) === day;

const frozenRound = (round: ManifestRound): ManifestRound =>
  Object.freeze({
    position: round.position,
    roundId: round.roundId,
    mode: round.mode,
  });

const validateRounds = (rounds: readonly ManifestRound[]): ManifestRounds => {
  if (
    rounds.length !== 5 ||
    new Set(rounds.map(({ position }) => position)).size !== 5 ||
    ![1, 2, 3, 4, 5].every((position) =>
      rounds.some((round) => round.position === position),
    )
  ) {
    throw new ManifestRuleError(
      "A manifest version must have positions 1 through 5 exactly once",
    );
  }

  for (const round of rounds) {
    assertNonEmpty(round.roundId, "Round ID");
    if (round.mode !== "provenance" && round.mode !== "language") {
      throw new ManifestRuleError(`Unsupported round mode: ${String(round.mode)}`);
    }
  }

  if (new Set(rounds.map(({ roundId }) => roundId)).size !== 5) {
    throw new ManifestRuleError("Round IDs must be distinct within a manifest version");
  }

  const provenanceCount = rounds.filter(({ mode }) => mode === "provenance").length;
  const languageCount = rounds.filter(({ mode }) => mode === "language").length;
  if (provenanceCount !== 3 || languageCount !== 2) {
    throw new ManifestRuleError(
      "A manifest version must contain three provenance and two language rounds",
    );
  }

  const ordered = [...rounds]
    .sort((left, right) => left.position - right.position)
    .map(frozenRound);
  return Object.freeze(ordered) as unknown as ManifestRounds;
};

const frozenVersion = (
  input: Omit<ManifestVersion, "rounds" | "record"> & {
    readonly rounds: readonly ManifestRound[];
    readonly record: VersionRecord;
  },
): ManifestVersion => {
  const record = Object.freeze({ ...input.record });
  return Object.freeze({
    betaDay: input.betaDay,
    lineageId: input.lineageId,
    versionId: input.versionId,
    recordedAt: input.recordedAt,
    record,
    rounds: validateRounds(input.rounds),
  });
};

const frozenLineage = (lineage: ManifestLineage): ManifestLineage =>
  Object.freeze({
    betaDay: lineage.betaDay,
    lineageId: lineage.lineageId,
    currentIssuanceVersionId: lineage.currentIssuanceVersionId,
    versions: Object.freeze([...lineage.versions]),
  });

const frozenBinding = (binding: SessionManifestBinding): SessionManifestBinding =>
  Object.freeze({ ...binding });

export class ManifestBook {
  readonly #activeDays: readonly BetaDay[];
  readonly #lineages: readonly ManifestLineage[];
  readonly #bindings: readonly SessionManifestBinding[];

  private constructor(
    activeDays: readonly BetaDay[],
    lineages: readonly ManifestLineage[],
    bindings: readonly SessionManifestBinding[],
  ) {
    this.#activeDays = Object.freeze([...activeDays]);
    this.#lineages = Object.freeze([...lineages]);
    this.#bindings = Object.freeze([...bindings]);
    Object.freeze(this);
  }

  public static forActiveDays(activeDays: readonly BetaDay[]): ManifestBook {
    if (activeDays.length === 0) {
      throw new ManifestRuleError("At least one active beta day is required");
    }

    for (const day of activeDays) {
      assertUtcDay(day);
    }
    if (new Set(activeDays).size !== activeDays.length) {
      throw new ManifestRuleError("Active beta days must be distinct");
    }

    return new ManifestBook(activeDays, [], []);
  }

  public createLineage(input: CreateLineageInput): ManifestBook {
    this.#assertActiveDay(input.betaDay);
    assertNonEmpty(input.lineageId, "Lineage ID");
    assertNonEmpty(input.initialVersionId, "Version ID");
    parseInstant(input.recordedAt);

    if (this.#lineages.some(({ betaDay }) => betaDay === input.betaDay)) {
      throw new ManifestRuleError(`A lineage already exists for ${input.betaDay}`);
    }
    if (this.#lineages.some(({ lineageId }) => lineageId === input.lineageId)) {
      throw new ManifestRuleError(`Lineage ${input.lineageId} already exists`);
    }
    this.#assertVersionIdAvailable(input.initialVersionId);
    this.#assertRoundsAvailableToLineage(input.rounds, input.lineageId);

    const version = frozenVersion({
      betaDay: input.betaDay,
      lineageId: input.lineageId,
      versionId: input.initialVersionId,
      recordedAt: input.recordedAt,
      record: {
        kind: "INITIAL_RELEASE",
        recordId: `lineage:${input.lineageId}`,
      },
      rounds: input.rounds,
    });
    const lineage = frozenLineage({
      betaDay: input.betaDay,
      lineageId: input.lineageId,
      currentIssuanceVersionId: version.versionId,
      versions: [version],
    });

    return new ManifestBook(
      this.#activeDays,
      [...this.#lineages, lineage],
      this.#bindings,
    );
  }

  public promoteVersion(input: PromoteVersionInput): ManifestBook {
    const lineage = this.lineageFor(input.betaDay);
    assertNonEmpty(input.versionId, "Version ID");
    this.#assertVersionIdAvailable(input.versionId);
    parseInstant(input.recordedAt);

    if (input.record.kind !== "CORRECTION" && input.record.kind !== "RESERVE_PROMOTION") {
      throw new ManifestRuleError(
        "A successor version requires a correction or reserve-promotion record",
      );
    }
    assertNonEmpty(input.record.recordId, "Version record ID");
    assertNonEmpty(input.record.reason, "Version record reason");

    const current = this.currentIssuanceVersion(input.betaDay);
    const replaced = current.rounds.find(
      ({ position }) => position === input.replacement.position,
    );
    if (replaced === undefined) {
      throw new ManifestRuleError(
        `Position ${String(input.replacement.position)} is not in the current version`,
      );
    }
    if (
      lineage.versions.some(({ rounds }) =>
        rounds.some(({ roundId }) => roundId === input.replacement.roundId),
      )
    ) {
      throw new ManifestRuleError(
        `Round ${input.replacement.roundId} is already scheduled in this lineage`,
      );
    }
    this.#assertRoundsAvailableToLineage([input.replacement], lineage.lineageId);

    const nextRounds = current.rounds.map((round) =>
      round.position === input.replacement.position ? input.replacement : round,
    );
    const version = frozenVersion({
      betaDay: lineage.betaDay,
      lineageId: lineage.lineageId,
      versionId: input.versionId,
      recordedAt: input.recordedAt,
      record: input.record,
      rounds: nextRounds,
    });
    const nextLineage = frozenLineage({
      ...lineage,
      currentIssuanceVersionId: version.versionId,
      versions: [...lineage.versions, version],
    });
    const nextLineages = this.#lineages.map((candidate) =>
      candidate.lineageId === lineage.lineageId ? nextLineage : candidate,
    );

    return new ManifestBook(this.#activeDays, nextLineages, this.#bindings);
  }

  public issueSession(input: IssueSessionInput): ManifestBook {
    assertNonEmpty(input.sessionId, "Session ID");
    assertNonEmpty(input.participantId, "Participant ID");
    if (this.#bindings.some(({ sessionId }) => sessionId === input.sessionId)) {
      throw new ManifestRuleError(`Session ${input.sessionId} is already issued`);
    }
    if (
      this.#bindings.some(
        ({ participantId, betaDay }) =>
          participantId === input.participantId && betaDay === input.betaDay,
      )
    ) {
      throw new ManifestRuleError(
        `Participant ${input.participantId} already has a session for ${input.betaDay}`,
      );
    }
    if (!instantInUtcDay(input.issuedAt, input.betaDay)) {
      throw new ManifestRuleError(
        `New sessions can only be issued during ${input.betaDay} UTC`,
      );
    }

    const lineage = this.lineageFor(input.betaDay);
    const binding = frozenBinding({
      sessionId: input.sessionId,
      participantId: input.participantId,
      betaDay: input.betaDay,
      lineageId: lineage.lineageId,
      manifestVersionId: lineage.currentIssuanceVersionId,
      issuedAt: input.issuedAt,
    });

    return new ManifestBook(
      this.#activeDays,
      this.#lineages,
      [...this.#bindings, binding],
    );
  }

  public lineageFor(betaDay: BetaDay): ManifestLineage {
    const lineage = this.#lineages.find((candidate) => candidate.betaDay === betaDay);
    if (lineage === undefined) {
      throw new ManifestRuleError(`No lineage exists for ${betaDay}`);
    }
    return lineage;
  }

  public currentIssuanceVersion(betaDay: BetaDay): ManifestVersion {
    const lineage = this.lineageFor(betaDay);
    const version = lineage.versions.find(
      ({ versionId }) => versionId === lineage.currentIssuanceVersionId,
    );
    if (version === undefined) {
      throw new ManifestRuleError(
        `Current issuance version is missing for ${lineage.lineageId}`,
      );
    }
    return version;
  }

  public isEligibleForNewIssuance(betaDay: BetaDay, versionId: string): boolean {
    return this.lineageFor(betaDay).currentIssuanceVersionId === versionId;
  }

  public bindingFor(sessionId: string): SessionManifestBinding {
    const binding = this.#bindings.find((candidate) => candidate.sessionId === sessionId);
    if (binding === undefined) {
      throw new ManifestRuleError(`No manifest binding exists for session ${sessionId}`);
    }
    return binding;
  }

  #assertActiveDay(betaDay: BetaDay): void {
    assertUtcDay(betaDay);
    if (!this.#activeDays.includes(betaDay)) {
      throw new ManifestRuleError(`${betaDay} is not an active beta day`);
    }
  }

  #assertVersionIdAvailable(versionId: string): void {
    if (
      this.#lineages.some(({ versions }) =>
        versions.some((version) => version.versionId === versionId),
      )
    ) {
      throw new ManifestRuleError(`Version ${versionId} already exists`);
    }
  }

  #assertRoundsAvailableToLineage(
    rounds: readonly ManifestRound[],
    lineageId: string,
  ): void {
    for (const { roundId } of rounds) {
      const conflictingLineage = this.#lineages.find(
        (lineage) =>
          lineage.lineageId !== lineageId &&
          lineage.versions.some(({ rounds: versionRounds }) =>
            versionRounds.some((round) => round.roundId === roundId),
          ),
      );
      if (conflictingLineage !== undefined) {
        throw new ManifestRuleError(
          `Round ${roundId} is already scheduled in another lineage`,
        );
      }
    }
  }
}
