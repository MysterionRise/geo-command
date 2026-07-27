export type ComplaintSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type CorrectionStatus = "VOID" | "CONTENT_WITHDRAWN";

export interface RubricEntry {
  readonly definition: string;
  readonly examples: readonly string[];
  readonly acknowledgementHours: 48;
  readonly quarantineHours: 4 | 24 | null;
  readonly decisionDays: 7 | 14;
}

const rubricEntry = (entry: RubricEntry): RubricEntry =>
  Object.freeze({ ...entry, examples: Object.freeze([...entry.examples]) });

export const COMPLAINT_RUBRIC: Readonly<Record<ComplaintSeverity, RubricEntry>> =
  Object.freeze({
    CRITICAL: rubricEntry({
      definition:
        "Credible ongoing unlawful, secret, personal-data, or imminent harm exposure.",
      examples: ["exposed credential", "personal data disclosure"],
      acknowledgementHours: 48,
      quarantineHours: 4,
      decisionDays: 7,
    }),
    HIGH: rubricEntry({
      definition:
        "Credible material rights, provenance, privacy, or safety harm without critical immediacy.",
      examples: ["material license dispute", "material provenance error"],
      acknowledgementHours: 48,
      quarantineHours: 24,
      decisionDays: 7,
    }),
    MEDIUM: rubricEntry({
      definition: "Credible bounded issue with limited impact and no urgent exposure.",
      examples: ["incomplete attribution detail", "non-urgent ambiguity"],
      acknowledgementHours: 48,
      quarantineHours: null,
      decisionDays: 14,
    }),
    LOW: rubricEntry({
      definition: "Minor correction or clarification without material harm.",
      examples: ["typographical correction", "clarification request"],
      acknowledgementHours: 48,
      quarantineHours: null,
      decisionDays: 14,
    }),
  });

export class ComplaintRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ComplaintRuleError";
  }
}

export interface ComplaintSnapshot {
  readonly caseId: string;
  readonly contentId: string;
  readonly roundId: string;
  readonly manifestVersionId: string;
  readonly severity: ComplaintSeverity;
  readonly credible: boolean;
  readonly receivedAt: string;
  readonly evidenceRefs: readonly string[];
  readonly originalContentEditorId: string;
  readonly originalRightsSafetyReviewerId: string;
  readonly acknowledgement?: {
    readonly acknowledgedAt: string;
    readonly missedDeadlineRationale?: string;
  };
  readonly quarantine?: {
    readonly quarantinedAt: string;
    readonly contentAccess: "DENIED";
    readonly revealAccess: "DENIED";
    readonly manifestNewIssuance: "INELIGIBLE";
    readonly existingSessionCredentialScope: readonly [
      "CORRECTION_NOTICE",
      "UNAFFECTED_TRANSITIONS",
    ];
    readonly credentialRevocation: "UNCHANGED";
    readonly pendingDecisionAvailability: "UNAVAILABLE";
    readonly correctionStatus: CorrectionStatus;
    readonly notice: string;
    readonly cachePurgeDueAt: string;
    readonly alreadyDisplayedContent: "NOT_RECALLABLE" | "NOT_DISPLAYED";
    readonly missedDeadlineRationale?: string;
  };
  readonly credentialRevocations: readonly {
    readonly credentialId: string;
    readonly revokedAt: string;
    readonly reason: string;
  }[];
  readonly decision?: {
    readonly decidedAt: string;
    readonly reviewerId: string;
    readonly correction: string;
    readonly deletion: string;
    readonly escalation: string;
    readonly completedAt: string;
    readonly missedDeadlineRationale?: string;
  };
}

export interface ComplaintHistoryEntry {
  readonly event:
    | "RECEIVED"
    | "ACKNOWLEDGED"
    | "QUARANTINED"
    | "CREDENTIAL_REVOKED"
    | "DECIDED"
    | "COMPLETED";
  readonly occurredAt: string;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const time = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ComplaintRuleError(`${value} is not a valid instant`);
  return parsed;
};

const text = (value: string, label: string): string => {
  if (value.trim().length === 0) throw new ComplaintRuleError(`${label} is required`);
  return value;
};

const lateRationale = (
  actual: number,
  due: number,
  rationale: string | undefined,
  action: string,
): void => {
  if (actual > due && (rationale === undefined || rationale.trim().length === 0)) {
    throw new ComplaintRuleError(`Missed ${action} requires a rationale`);
  }
};

const freezeSnapshot = (snapshot: ComplaintSnapshot): ComplaintSnapshot =>
  Object.freeze({
    ...snapshot,
    evidenceRefs: Object.freeze([...snapshot.evidenceRefs]),
    credentialRevocations: Object.freeze(
      snapshot.credentialRevocations.map((entry) => Object.freeze({ ...entry })),
    ),
    ...(snapshot.acknowledgement === undefined
      ? {}
      : { acknowledgement: Object.freeze({ ...snapshot.acknowledgement }) }),
    ...(snapshot.quarantine === undefined
      ? {}
      : {
          quarantine: Object.freeze({
            ...snapshot.quarantine,
            existingSessionCredentialScope: Object.freeze([
              ...snapshot.quarantine.existingSessionCredentialScope,
            ]) as readonly ["CORRECTION_NOTICE", "UNAFFECTED_TRANSITIONS"],
          }),
        }),
    ...(snapshot.decision === undefined
      ? {}
      : { decision: Object.freeze({ ...snapshot.decision }) }),
  });

export class ComplaintCase {
  readonly #snapshot: ComplaintSnapshot;
  readonly #history: readonly ComplaintHistoryEntry[];

  private constructor(
    snapshot: ComplaintSnapshot,
    history: readonly ComplaintHistoryEntry[],
  ) {
    this.#snapshot = freezeSnapshot(snapshot);
    this.#history = Object.freeze(history.map((entry) => Object.freeze({ ...entry })));
    Object.freeze(this);
  }

  public static open(input: Omit<ComplaintSnapshot, "acknowledgement" | "quarantine" | "credentialRevocations" | "decision">): ComplaintCase {
    time(input.receivedAt);
    if (input.evidenceRefs.length === 0) throw new ComplaintRuleError("Complaint evidence is required");
    text(input.originalContentEditorId, "Original Content Editor");
    text(input.originalRightsSafetyReviewerId, "Original Rights/Safety reviewer");
    return new ComplaintCase(
      { ...input, credentialRevocations: [] },
      [{ event: "RECEIVED", occurredAt: input.receivedAt }],
    );
  }

  public acknowledge(input: {
    readonly acknowledgedAt: string;
    readonly missedDeadlineRationale?: string;
  }): ComplaintCase {
    const actual = time(input.acknowledgedAt);
    lateRationale(
      actual,
      time(this.#snapshot.receivedAt) + 48 * HOUR_MS,
      input.missedDeadlineRationale,
      "acknowledgement",
    );
    return this.#next(
      {
        ...this.#snapshot,
        acknowledgement: Object.freeze({ ...input }),
      },
      { event: "ACKNOWLEDGED", occurredAt: input.acknowledgedAt },
    );
  }

  public quarantine(input: {
    readonly quarantinedAt: string;
    readonly correctionStatus: CorrectionStatus;
    readonly alreadyDisplayed: boolean;
    readonly missedDeadlineRationale?: string;
  }): ComplaintCase {
    const hours = COMPLAINT_RUBRIC[this.#snapshot.severity].quarantineHours;
    if (!this.#snapshot.credible || hours === null) {
      throw new ComplaintRuleError("Emergency quarantine requires a credible critical/high case");
    }
    const actual = time(input.quarantinedAt);
    lateRationale(
      actual,
      time(this.#snapshot.receivedAt) + hours * HOUR_MS,
      input.missedDeadlineRationale,
      "quarantine",
    );
    const rationale =
      input.missedDeadlineRationale === undefined
        ? {}
        : { missedDeadlineRationale: input.missedDeadlineRationale };
    const quarantine = Object.freeze({
      quarantinedAt: input.quarantinedAt,
      contentAccess: "DENIED" as const,
      revealAccess: "DENIED" as const,
      manifestNewIssuance: "INELIGIBLE" as const,
      existingSessionCredentialScope: Object.freeze([
        "CORRECTION_NOTICE",
        "UNAFFECTED_TRANSITIONS",
      ]) as readonly ["CORRECTION_NOTICE", "UNAFFECTED_TRANSITIONS"],
      credentialRevocation: "UNCHANGED" as const,
      pendingDecisionAvailability: "UNAVAILABLE" as const,
      correctionStatus: input.correctionStatus,
      notice:
        input.correctionStatus === "CONTENT_WITHDRAWN"
          ? "Content was withdrawn."
          : "Round voided.",
      cachePurgeDueAt: new Date(actual + 5 * 60_000).toISOString(),
      alreadyDisplayedContent: input.alreadyDisplayed
        ? ("NOT_RECALLABLE" as const)
        : ("NOT_DISPLAYED" as const),
      ...rationale,
    });
    return this.#next(
      { ...this.#snapshot, quarantine },
      { event: "QUARANTINED", occurredAt: input.quarantinedAt },
    );
  }

  public explicitlyRevokeCredential(input: {
    readonly credentialId: string;
    readonly revokedAt: string;
    readonly reason: string;
  }): ComplaintCase {
    time(input.revokedAt);
    text(input.credentialId, "Credential ID");
    text(input.reason, "Revocation reason");
    return this.#next(
      {
        ...this.#snapshot,
        credentialRevocations: [...this.#snapshot.credentialRevocations, input],
      },
      { event: "CREDENTIAL_REVOKED", occurredAt: input.revokedAt },
    );
  }

  public decide(input: {
    readonly decidedAt: string;
    readonly reviewerId: string;
    readonly outcome: string;
    readonly escalation: string;
    readonly deletion: string;
    readonly completedAt: string;
    readonly missedDeadlineRationale?: string;
  }): ComplaintCase {
    if (
      input.reviewerId === this.#snapshot.originalContentEditorId ||
      input.reviewerId === this.#snapshot.originalRightsSafetyReviewerId
    ) {
      throw new ComplaintRuleError(
        "Decision reviewer must be independent of original reviewers",
      );
    }
    if (this.#snapshot.acknowledgement === undefined) {
      throw new ComplaintRuleError("Complaint must be acknowledged before decision");
    }
    if (
      this.#snapshot.credible &&
      (this.#snapshot.severity === "CRITICAL" || this.#snapshot.severity === "HIGH") &&
      this.#snapshot.quarantine === undefined
    ) {
      throw new ComplaintRuleError(
        "Credible critical/high complaint must be quarantined before decision",
      );
    }
    const actual = time(input.decidedAt);
    lateRationale(
      actual,
      time(this.#snapshot.receivedAt) +
        COMPLAINT_RUBRIC[this.#snapshot.severity].decisionDays * DAY_MS,
      input.missedDeadlineRationale,
      "decision",
    );
    time(input.completedAt);
    text(input.reviewerId, "Decision reviewer");
    text(input.outcome, "Correction decision");
    text(input.escalation, "Escalation record");
    text(input.deletion, "Deletion record");
    const decision = Object.freeze({
      decidedAt: input.decidedAt,
      reviewerId: input.reviewerId,
      correction: input.outcome,
      escalation: input.escalation,
      deletion: input.deletion,
      completedAt: input.completedAt,
      ...(input.missedDeadlineRationale === undefined
        ? {}
        : { missedDeadlineRationale: input.missedDeadlineRationale }),
    });
    const decided = this.#next(
      { ...this.#snapshot, decision },
      { event: "DECIDED", occurredAt: input.decidedAt },
    );
    return decided.#next(
      decided.#snapshot,
      { event: "COMPLETED", occurredAt: input.completedAt },
    );
  }

  public snapshot(): ComplaintSnapshot {
    return this.#snapshot;
  }

  public history(): readonly ComplaintHistoryEntry[] {
    return this.#history;
  }

  #next(snapshot: ComplaintSnapshot, event: ComplaintHistoryEntry): ComplaintCase {
    return new ComplaintCase(snapshot, [...this.#history, event]);
  }
}
