export class PrivacyRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PrivacyRuleError";
  }
}

const DAY = 86_400_000;
const required = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new PrivacyRuleError(`${label} is required`);
  return normalized;
};
const time = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new PrivacyRuleError("Valid instant is required");
  return parsed;
};
const iso = (value: string): string => new Date(time(value)).toISOString();
const plusDays = (value: string, days: number): string => new Date(time(value) + days * DAY).toISOString();

export interface CredentialCascadePlan {
  readonly participantLineageId: string;
  readonly descendantCredentialIds: readonly string[];
  commit(): void;
  rollback(): void;
}

type WithdrawalFactType =
  | "CONSENT_WITHDRAWN"
  | "ANALYSIS_EXCLUDED"
  | "CREDENTIAL_CASCADE_REVOKED"
  | "OPTIONAL_TELEMETRY_DISABLED"
  | "OPTIONAL_PROCESSING_STOPPED"
  | "DELETION_CASE_OPENED"
  | "WITHDRAWAL_AUDITED";

export interface AtomicWithdrawalBundle {
  readonly participantLineageId: string;
  readonly deletionCaseId: string;
  readonly requestedAt: string;
  readonly facts: readonly { readonly factType: WithdrawalFactType; readonly occurredAt: string }[];
  readonly cascade: CredentialCascadePlan;
}

interface DeletionCaseStepBase {
  readonly occurredAt: string;
}
export type DeletionCaseStepInput =
  | (DeletionCaseStepBase & { readonly stepType: "ACKNOWLEDGED" | "ACTIVE_STORES_COMPLETED" | "BACKUPS_AGED_OUT" })
  | (DeletionCaseStepBase & { readonly stepType: "DERIVED_RECORDS_COMPLETED"; readonly treatment: "DELETE" | "IRREVERSIBLY_DELINK" })
  | (DeletionCaseStepBase & { readonly stepType: "PROVIDER_PROPAGATED"; readonly providerReference: string });
type DeletionCaseStep =
  | { readonly stepType: "CASE_OPENED"; readonly occurredAt: string }
  | { readonly stepType: "DEADLINE_MISSED"; readonly occurredAt: string; readonly deadline: "ACKNOWLEDGEMENT" | "ACTIVE_STORES" | "BACKUPS"; readonly dueAt: string }
  | DeletionCaseStepInput;

export class DeletionCase {
  public readonly caseId: string;
  readonly #participantLineageId: string;
  readonly #openedAt: string;
  readonly #history: readonly DeletionCaseStep[];

  private constructor(caseId: string, participantLineageId: string, openedAt: string, history: readonly DeletionCaseStep[]) {
    this.caseId = caseId;
    this.#participantLineageId = participantLineageId;
    this.#openedAt = openedAt;
    this.#history = Object.freeze(history.map((step) => Object.freeze({ ...step })));
    Object.freeze(this);
  }

  public static open(input: { readonly caseId: string; readonly participantLineageId: string; readonly openedAt: string }): DeletionCase {
    const openedAt = iso(input.openedAt);
    return new DeletionCase(required(input.caseId, "Deletion case ID"), required(input.participantLineageId, "Participant lineage ID"), openedAt, [{ stepType: "CASE_OPENED", occurredAt: openedAt }]);
  }

  public deadlines(): { readonly acknowledgementDueAt: string; readonly activeStoresDueAt: string; readonly backupsDueAt: string } {
    return Object.freeze({ acknowledgementDueAt: plusDays(this.#openedAt, 7), activeStoresDueAt: plusDays(this.#openedAt, 30), backupsDueAt: plusDays(this.#openedAt, 35) });
  }

  public record(step: DeletionCaseStepInput): DeletionCase {
    const occurred = time(step.occurredAt);
    if (occurred < time(this.#openedAt)) throw new PrivacyRuleError("Deletion step cannot precede case open");
    if (
      (step.stepType === "ACKNOWLEDGED" || step.stepType === "ACTIVE_STORES_COMPLETED" || step.stepType === "BACKUPS_AGED_OUT") &&
      this.#history.some((entry) => entry.stepType === step.stepType)
    ) throw new PrivacyRuleError("Deletion terminal step already recorded");
    if (step.stepType === "DERIVED_RECORDS_COMPLETED" && this.#history.some((entry) => entry.stepType === "DERIVED_RECORDS_COMPLETED")) {
      throw new PrivacyRuleError("Derived-record treatment is already final");
    }
    if (step.stepType === "PROVIDER_PROPAGATED") required(step.providerReference, "Provider reference");
    const deadline = step.stepType === "ACKNOWLEDGED" ? { deadline: "ACKNOWLEDGEMENT" as const, dueAt: this.deadlines().acknowledgementDueAt }
      : step.stepType === "ACTIVE_STORES_COMPLETED" ? { deadline: "ACTIVE_STORES" as const, dueAt: this.deadlines().activeStoresDueAt }
      : step.stepType === "BACKUPS_AGED_OUT" ? { deadline: "BACKUPS" as const, dueAt: this.deadlines().backupsDueAt } : undefined;
    const miss: DeletionCaseStep[] = deadline !== undefined && occurred > time(deadline.dueAt)
      ? [{ stepType: "DEADLINE_MISSED", occurredAt: step.occurredAt, ...deadline }] : [];
    return new DeletionCase(this.caseId, this.#participantLineageId, this.#openedAt, [...this.#history, ...miss, step]);
  }

  public history(): readonly DeletionCaseStep[] {
    return this.#history;
  }

  public stepState() { return this.#stateFrom(this.#history); }

  #stateFrom(history: readonly DeletionCaseStep[]) {
    const derived = history.find((step) => step.stepType === "DERIVED_RECORDS_COMPLETED");
    return Object.freeze({
      acknowledged: history.some((step) => step.stepType === "ACKNOWLEDGED"),
      activeStoresCompleted: history.some((step) => step.stepType === "ACTIVE_STORES_COMPLETED"),
      derivedTreatment: derived?.stepType === "DERIVED_RECORDS_COMPLETED" ? derived.treatment : undefined,
      providerPropagated: history.some((step) => step.stepType === "PROVIDER_PROPAGATED"),
      backupsAgedOut: history.some((step) => step.stepType === "BACKUPS_AGED_OUT"),
      deadlineMisses: Object.freeze(history.flatMap((entry) => entry.stepType === "DEADLINE_MISSED" ? [entry.deadline] : [])),
    });
  }

  public statusAt(at: string): { readonly acknowledgementOverdue: boolean; readonly activeStoresOverdue: boolean; readonly backupsOverdue: boolean } {
    const now = time(at);
    const deadlines = this.deadlines();
    const state = this.#stateFrom(this.#history.filter((step) => time(step.occurredAt) <= now));
    return Object.freeze({
      acknowledgementOverdue: !state.acknowledged && now > time(deadlines.acknowledgementDueAt),
      activeStoresOverdue: !state.activeStoresCompleted && now > time(deadlines.activeStoresDueAt),
      backupsOverdue: !state.backupsAgedOut && now > time(deadlines.backupsDueAt),
    });
  }
}

export class WithdrawalCoordinator {
  readonly #authenticator: { authenticate(input: { readonly participantLineageId: string; readonly authenticationProof: string }): boolean };
  readonly #caseIds: { generate(): string };
  readonly #cascade: { prepare(participantLineageId: string): CredentialCascadePlan };
  readonly #transaction: { commit(bundle: AtomicWithdrawalBundle): void };
  readonly #states = new Map<string, object>();
  readonly #audits: object[] = [];

  public constructor(ports: {
    readonly authenticator: { authenticate(input: { readonly participantLineageId: string; readonly authenticationProof: string }): boolean };
    readonly deletionCaseIdGenerator: { generate(): string };
    readonly credentialCascade: { prepare(participantLineageId: string): CredentialCascadePlan };
    readonly transaction: { commit(bundle: AtomicWithdrawalBundle): void };
  }) {
    this.#authenticator = ports.authenticator;
    this.#caseIds = ports.deletionCaseIdGenerator;
    this.#cascade = ports.credentialCascade;
    this.#transaction = ports.transaction;
  }

  public withdraw(input: { readonly participantLineageId: string; readonly authenticationProof: string; readonly requestedAt: string }): { readonly deletionCase: DeletionCase; readonly physicalDeletionMode: "ASYNCHRONOUS" } {
    const lineage = required(input.participantLineageId, "Participant lineage ID");
    if (!this.#authenticator.authenticate({ participantLineageId: lineage, authenticationProof: input.authenticationProof })) {
      throw new PrivacyRuleError("Withdrawal authentication failed");
    }
    const requestedAt = iso(input.requestedAt);
    const deletionCase = DeletionCase.open({ caseId: required(this.#caseIds.generate(), "Deletion case ID"), participantLineageId: lineage, openedAt: requestedAt });
    const cascade = this.#cascade.prepare(lineage);
    const types: readonly WithdrawalFactType[] = ["CONSENT_WITHDRAWN", "ANALYSIS_EXCLUDED", "CREDENTIAL_CASCADE_REVOKED", "OPTIONAL_TELEMETRY_DISABLED", "OPTIONAL_PROCESSING_STOPPED", "DELETION_CASE_OPENED", "WITHDRAWAL_AUDITED"];
    const bundle: AtomicWithdrawalBundle = Object.freeze({ participantLineageId: lineage, deletionCaseId: deletionCase.caseId, requestedAt, facts: Object.freeze(types.map((factType) => Object.freeze({ factType, occurredAt: requestedAt }))), cascade });
    try { this.#transaction.commit(bundle); } catch (error) { cascade.rollback(); throw error; }
    this.#states.set(lineage, Object.freeze({ consent: "WITHDRAWN", analysis: "EXCLUDED", optionalTelemetry: "DISABLED", optionalProcessing: "STOPPED", deletionCaseId: deletionCase.caseId }));
    this.#audits.push(Object.freeze({ event: "WITHDRAWAL_COMMITTED", occurredAt: requestedAt, deletionCaseId: deletionCase.caseId }));
    return Object.freeze({ deletionCase, physicalDeletionMode: "ASYNCHRONOUS" });
  }

  public safeState(lineage: string): object | undefined { return this.#states.get(lineage); }
  public optionalTelemetryDecision(lineage: string) { return this.#states.has(lineage) ? Object.freeze({ allowed: false as const, reason: "WITHDRAWN" as const }) : Object.freeze({ allowed: true as const }); }
  public runOptionalProcessing(lineage: string, operation: () => unknown) {
    if (this.#states.has(lineage)) return Object.freeze({ allowed: false as const, reason: "WITHDRAWN" as const });
    operation(); return Object.freeze({ allowed: true as const });
  }
  public safeTelemetry(lineage: string): object { return Object.freeze({ optionalTelemetry: this.#states.has(lineage) ? "DISABLED" : "UNKNOWN" }); }
  public auditRecords(): readonly object[] { return Object.freeze([...this.#audits]); }
}

type RetentionInput =
  | { readonly storageClass: "RAW_GAMEPLAY_OR_RECRUITMENT_BRIDGE"; readonly betaClosedAt: string; readonly withdrawalAt: string }
  | { readonly storageClass: "PROVIDER_CDN_APP_LOG"; readonly createdAt: string; readonly propagatedDeletionDeadline: string }
  | { readonly storageClass: "TEMP_EXPORT_OR_SUPPORT"; readonly createdAt: string; readonly requestAt: string }
  | { readonly storageClass: "PROJECT_BACKUP"; readonly createdAt: string; readonly propagatedAt: string };

export const calculateRetentionDeadline = (input: RetentionInput) => {
  let candidates: readonly { deadline: string; source: string }[];
  switch (input.storageClass) {
    case "RAW_GAMEPLAY_OR_RECRUITMENT_BRIDGE": candidates = [{ deadline: plusDays(input.betaClosedAt, 30), source: "BETA_CLOSE_PLUS_30_DAYS" }, { deadline: plusDays(input.withdrawalAt, 30), source: "WITHDRAWAL_PLUS_30_DAYS" }]; break;
    case "PROVIDER_CDN_APP_LOG": candidates = [{ deadline: plusDays(input.createdAt, 30), source: "CREATION_PLUS_30_DAYS" }, { deadline: iso(input.propagatedDeletionDeadline), source: "PROPAGATED_OR_PROVIDER_RULE" }]; break;
    case "TEMP_EXPORT_OR_SUPPORT": candidates = [{ deadline: plusDays(input.createdAt, 7), source: "CREATION_PLUS_7_DAYS" }, { deadline: plusDays(input.requestAt, 7), source: "REQUEST_PLUS_7_DAYS" }]; break;
    case "PROJECT_BACKUP": candidates = [{ deadline: plusDays(input.createdAt, 35), source: "CREATION_PLUS_35_DAYS" }, { deadline: plusDays(input.propagatedAt, 35), source: "PROPAGATION_PLUS_35_DAYS" }]; break;
  }
  const controlling = [...candidates].sort((a, b) => time(a.deadline) - time(b.deadline))[0];
  if (controlling === undefined) throw new PrivacyRuleError("Retention candidates are required");
  return Object.freeze({ deadline: controlling.deadline, controllingSource: controlling.source, evidence: Object.freeze(candidates.map(({ source, deadline }) => `${source}:${deadline}`)), isOverdueAt: (at: string) => time(at) > time(controlling.deadline) });
};

export interface LegalHold {
  readonly holdId: string; readonly approver: string; readonly purpose: string;
  readonly fields: readonly string[]; readonly copyIds: readonly string[];
  readonly startedAt: string; readonly reviewEveryDays: 30; readonly expiresAt: string;
  readonly nextReviewAt: string; readonly renewalEvidenceId?: string;
  readonly qualifiedCounsel?: string;
}

export const createLegalHold = (input: Omit<LegalHold, "nextReviewAt">): LegalHold => {
  if (input.reviewEveryDays !== 30) throw new PrivacyRuleError("Legal hold review cadence must be 30 days");
  if (input.fields.length === 0 || input.copyIds.length === 0) throw new PrivacyRuleError("Legal hold scope is required");
  const fields = Object.freeze(input.fields.map((field) => required(field, "Held field")));
  const copyIds = Object.freeze(input.copyIds.map((copy) => required(copy, "Held copy")));
  const startedAt = iso(input.startedAt);
  const expiresAt = iso(input.expiresAt);
  if (time(expiresAt) <= time(startedAt)) throw new PrivacyRuleError("Legal hold expiry must follow its start");
  if (time(expiresAt) > time(startedAt) + 180 * DAY) throw new PrivacyRuleError("Unrenewed legal hold cannot exceed 180 days");
  return Object.freeze({ holdId: required(input.holdId, "Legal hold ID"), approver: required(input.approver, "Legal hold approver"), purpose: required(input.purpose, "Legal hold purpose"), fields, copyIds, startedAt, reviewEveryDays: 30, expiresAt, nextReviewAt: plusDays(startedAt, 30), ...(input.renewalEvidenceId === undefined ? {} : { renewalEvidenceId: input.renewalEvidenceId }) });
};

export const renewLegalHold = (hold: LegalHold, input: { readonly qualifiedCounsel: string; readonly writtenEvidenceId: string; readonly renewedAt: string; readonly newExpiresAt: string }): LegalHold => {
  const counsel = required(input.qualifiedCounsel, "Qualified counsel");
  const evidence = required(input.writtenEvidenceId, "Written renewal evidence");
  const renewedAt = iso(input.renewedAt);
  const expiresAt = iso(input.newExpiresAt);
  if (time(renewedAt) < time(hold.startedAt)) throw new PrivacyRuleError("Renewal cannot precede hold start");
  if (time(renewedAt) > time(hold.expiresAt)) throw new PrivacyRuleError("Expired legal hold cannot be renewed");
  if (time(expiresAt) <= time(renewedAt)) throw new PrivacyRuleError("Renewed expiry must follow renewal");
  if (time(expiresAt) > time(renewedAt) + 180 * DAY) throw new PrivacyRuleError("Renewed legal hold cannot exceed 180 days");
  return Object.freeze({ ...hold, expiresAt, nextReviewAt: plusDays(renewedAt, 30), renewalEvidenceId: evidence, qualifiedCounsel: counsel });
};

export const applyLegalHold = (baseDeadline: string, hold: LegalHold, target: { readonly field: string; readonly copyId: string }) => {
  const base = iso(baseDeadline);
  const applies = hold.fields.includes(target.field) && hold.copyIds.includes(target.copyId);
  const effective = time(hold.expiresAt) > time(base) ? hold.expiresAt : base;
  return Object.freeze(applies
    ? { baseDeadline: base, effectiveDeadline: effective, holdExpiresAt: hold.expiresAt }
    : { baseDeadline: base, effectiveDeadline: base });
};
