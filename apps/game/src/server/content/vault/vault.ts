export type EvidenceRole =
  | "EVIDENCE_CUSTODIAN"
  | "RIGHTS_REVIEWER"
  | "SECURITY_REVIEWER";

export type PublicChannel =
  | "PUBLIC_BUNDLE"
  | "SOURCE_MAP"
  | "PREFETCH"
  | "ANALYTICS"
  | "LOG";

export type RestoreLedger = "WITHDRAWAL" | "CONSENT" | "DELETION" | "REVOCATION";

export type AccessPurpose = "RIGHTS_REVIEW" | "SECURITY_REVIEW" | "LEGAL_RESPONSE";

type AuditPurpose =
  | AccessPurpose
  | "UNSPECIFIED"
  | "ENCRYPTED_STORAGE"
  | "LOCAL_DELETION_AND_PROPAGATION"
  | "RESTORE_QUARANTINE_CREATED"
  | "RESTORE_RECONCILIATION_PASSED";

export interface NamedOperator {
  readonly operatorId: string;
  readonly operatorName: string;
  readonly roles: readonly EvidenceRole[];
}

export interface EncryptedEnvelope {
  readonly algorithm: string;
  readonly keyId: string;
  readonly nonce: string;
  readonly ciphertext: string;
}

export interface ProjectEncryption {
  seal(plaintext: Uint8Array): EncryptedEnvelope;
  withUnsealed(
    envelope: EncryptedEnvelope,
    consume: (plaintext: Uint8Array) => void,
  ): void;
}

export interface MinimizationMetadata {
  readonly retainedFields: readonly string[];
  readonly removedFields: readonly string[];
  readonly redactionsApplied: readonly string[];
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

export interface RetentionEvents {
  readonly betaClosedAt?: string;
  readonly itemWithdrawnAt?: string;
  readonly authenticatedRequestAt?: string;
}

export interface CounselRenewal {
  readonly counselName: string;
  readonly writtenRecordId: string;
  readonly qualifiedCounsel: true;
}

export interface LegalHoldInput {
  readonly holdId: string;
  readonly approver: string;
  readonly purpose: string;
  readonly fields: readonly string[];
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly counselRenewal?: CounselRenewal;
}

export interface LegalHold extends LegalHoldInput {
  readonly reviewEveryDays: 30;
  readonly nextReviewAt: string;
}

export interface StoreEvidenceInput {
  readonly operator: NamedOperator;
  readonly evidenceId: string;
  readonly versionId: string;
  readonly plaintext: Uint8Array;
  readonly allowedRoles: readonly EvidenceRole[];
  readonly minimization: MinimizationMetadata;
  readonly retentionEvents: RetentionEvents;
  readonly storedAt: string;
  readonly legalHold?: LegalHold;
}

export interface EvidenceReceipt {
  readonly evidenceId: string;
  readonly versionId: string;
  readonly retentionDeadline: string;
  readonly minimization: MinimizationMetadata;
}

export interface AccessRequest {
  readonly operator: NamedOperator;
  readonly evidenceId: string;
  readonly accessedAt: string;
  readonly purpose: AccessPurpose;
}

export type AccessDenialReason =
  | "OPERATOR_NOT_NAMED"
  | "ROLE_NOT_ALLOWED"
  | "NOT_FOUND"
  | "PURPOSE_NOT_ALLOWED"
  | "RETENTION_EXPIRED";

export type AccessReceipt =
  | {
      readonly auditId: string;
      readonly evidenceId: string;
      readonly outcome: "GRANTED";
    }
  | {
      readonly auditId: string;
      readonly evidenceId: string;
      readonly outcome: "DENIED";
      readonly reason: AccessDenialReason;
    };

export interface AuditEntry {
  readonly auditId: string;
  readonly evidenceId: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly action: "STORE" | "ACCESS" | "DELETE" | "RESTORE";
  readonly outcome: "GRANTED" | "DENIED";
  readonly occurredAt: string;
  readonly purpose: AuditPurpose;
  readonly reason?: string;
}

export interface RestorableEvidenceEntry {
  readonly evidenceId: string;
  readonly versionId: string;
  readonly envelope: EncryptedEnvelope;
  readonly allowedRoles: readonly EvidenceRole[];
  readonly minimization: MinimizationMetadata;
  readonly retentionDeadline: string;
  readonly legalHold?: LegalHold;
}

interface StoredEvidence extends RestorableEvidenceEntry {}

interface RestoreState {
  readonly restoreId: string;
  readonly initiatorOperatorId: string;
  readonly entries: readonly StoredEvidence[];
  readonly replayedLedgers: Set<RestoreLedger>;
}

export class VaultRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "VaultRuleError";
  }
}

const DAY_MS = 86_400_000;
const REQUIRED_RESTORE_LEDGERS: readonly RestoreLedger[] = [
  "WITHDRAWAL",
  "CONSENT",
  "DELETION",
  "REVOCATION",
];
const ACCESS_PURPOSES = new Set<AccessPurpose>([
  "RIGHTS_REVIEW",
  "SECURITY_REVIEW",
  "LEGAL_RESPONSE",
]);

const requiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new VaultRuleError(`${label} must be named`);
  }
  return normalized;
};

const requiredPurpose = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new VaultRuleError(`${label} must not be empty`);
  }
  return normalized;
};

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new VaultRuleError(`${value} is not a valid instant`);
  }
  return parsed;
};

const isoAfterDays = (timestamp: number, days: number): string =>
  new Date(timestamp + days * DAY_MS).toISOString();

const freezeStrings = (values: readonly string[]): readonly string[] =>
  Object.freeze(values.map((value) => requiredPurpose(value, "Metadata field")));

const freezeMinimization = (
  metadata: MinimizationMetadata,
): MinimizationMetadata => {
  requiredText(metadata.reviewedBy, "Minimization reviewer");
  instant(metadata.reviewedAt);
  if (metadata.retainedFields.length === 0) {
    throw new VaultRuleError("Minimization metadata requires retained fields");
  }
  return Object.freeze({
    retainedFields: freezeStrings(metadata.retainedFields),
    removedFields: freezeStrings(metadata.removedFields),
    redactionsApplied: freezeStrings(metadata.redactionsApplied),
    reviewedBy: metadata.reviewedBy,
    reviewedAt: metadata.reviewedAt,
  });
};

const freezeEnvelope = (envelope: EncryptedEnvelope): EncryptedEnvelope => {
  requiredPurpose(envelope.algorithm, "Encryption algorithm");
  requiredPurpose(envelope.keyId, "Encryption key ID");
  requiredPurpose(envelope.nonce, "Encryption nonce");
  requiredPurpose(envelope.ciphertext, "Encrypted ciphertext");
  return Object.freeze({ ...envelope });
};

const namedOperator = (operator: NamedOperator): boolean =>
  operator.operatorId.trim().length > 0 && operator.operatorName.trim().length > 0;

const requireOperatorRole = (
  operator: NamedOperator,
  requiredRole: EvidenceRole,
): void => {
  if (!namedOperator(operator)) {
    throw new VaultRuleError("A named operator is required");
  }
  if (!operator.roles.includes(requiredRole)) {
    throw new VaultRuleError(`${requiredRole} role is required`);
  }
};

export const retentionDeadlineForRestrictedEvidence = (
  events: RetentionEvents,
): string => {
  const eventTimes = [
    events.betaClosedAt,
    events.itemWithdrawnAt,
    events.authenticatedRequestAt,
  ]
    .filter((value): value is string => value !== undefined)
    .map(instant);
  if (eventTimes.length === 0) {
    throw new VaultRuleError("Restricted evidence requires a retention event");
  }
  return isoAfterDays(Math.min(...eventTimes), 90);
};

export const createLegalHold = (input: LegalHoldInput): LegalHold => {
  requiredPurpose(input.holdId, "Legal hold ID");
  if (input.approver.trim().length === 0) {
    throw new VaultRuleError("Legal hold approver must be named");
  }
  requiredPurpose(input.purpose, "Legal hold purpose");
  if (input.fields.length === 0) {
    throw new VaultRuleError("Legal hold fields must not be empty");
  }
  const startsAt = instant(input.startsAt);
  const expiresAt = instant(input.expiresAt);
  if (expiresAt <= startsAt) {
    throw new VaultRuleError("Legal hold expiry must follow its start");
  }
  if (expiresAt > startsAt + 180 * DAY_MS) {
    const renewal = input.counselRenewal;
    if (
      renewal === undefined ||
      renewal.qualifiedCounsel !== true ||
      renewal.counselName.trim().length === 0 ||
      renewal.writtenRecordId.trim().length === 0
    ) {
      throw new VaultRuleError(
        "A legal hold beyond 180 days requires a written qualified-counsel renewal",
      );
    }
  }
  const fields = freezeStrings(input.fields);
  const counselRenewal =
    input.counselRenewal === undefined
      ? {}
      : { counselRenewal: Object.freeze({ ...input.counselRenewal }) };
  return Object.freeze({
    holdId: input.holdId,
    approver: input.approver,
    purpose: input.purpose,
    fields,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    ...counselRenewal,
    reviewEveryDays: 30,
    nextReviewAt: isoAfterDays(startsAt, 30),
  });
};

export class EvidenceVault {
  readonly #encryption: ProjectEncryption;
  readonly #records = new Map<string, StoredEvidence>();
  readonly #deletedEvidenceIds = new Set<string>();
  readonly #audits: AuditEntry[] = [];
  readonly #restores = new Map<string, RestoreState>();

  public constructor(encryption: ProjectEncryption) {
    this.#encryption = encryption;
  }

  public store(input: StoreEvidenceInput): EvidenceReceipt {
    requireOperatorRole(input.operator, "EVIDENCE_CUSTODIAN");
    requiredPurpose(input.evidenceId, "Evidence ID");
    requiredPurpose(input.versionId, "Evidence version ID");
    instant(input.storedAt);
    if (this.#records.has(input.evidenceId) || this.#deletedEvidenceIds.has(input.evidenceId)) {
      throw new VaultRuleError(`Evidence ${input.evidenceId} already exists or was deleted`);
    }
    if (input.allowedRoles.length === 0) {
      throw new VaultRuleError("Restricted evidence requires at least one allowed role");
    }

    const transientPlaintext = Uint8Array.from(input.plaintext);
    let envelope: EncryptedEnvelope;
    try {
      envelope = freezeEnvelope(this.#encryption.seal(transientPlaintext));
      if (envelope.ciphertext === new TextDecoder().decode(transientPlaintext)) {
        throw new VaultRuleError("Encryption provider returned plaintext as ciphertext");
      }
    } finally {
      transientPlaintext.fill(0);
    }

    const minimization = freezeMinimization(input.minimization);
    const retentionDeadline = retentionDeadlineForRestrictedEvidence(input.retentionEvents);
    const legalHold = input.legalHold === undefined ? {} : { legalHold: input.legalHold };
    const record: StoredEvidence = Object.freeze({
      evidenceId: input.evidenceId,
      versionId: input.versionId,
      envelope,
      allowedRoles: Object.freeze([...input.allowedRoles]),
      minimization,
      retentionDeadline,
      ...legalHold,
    });
    this.#records.set(input.evidenceId, record);
    this.#appendAudit({
      evidenceId: input.evidenceId,
      operator: input.operator,
      action: "STORE",
      outcome: "GRANTED",
      occurredAt: input.storedAt,
      purpose: "ENCRYPTED_STORAGE",
    });

    return Object.freeze({
      evidenceId: record.evidenceId,
      versionId: record.versionId,
      retentionDeadline,
      minimization,
    });
  }

  public withEvidenceAccess(
    request: AccessRequest,
    consume: (plaintext: Uint8Array) => void,
  ): AccessReceipt {
    const accessedAt = instant(request.accessedAt);
    const record = this.#records.get(request.evidenceId);
    const auditPurpose: AuditPurpose = ACCESS_PURPOSES.has(request.purpose)
      ? request.purpose
      : "UNSPECIFIED";
    let reason: AccessDenialReason;
    if (!namedOperator(request.operator)) {
      reason = "OPERATOR_NOT_NAMED";
    } else if (record === undefined) {
      reason = "NOT_FOUND";
    } else if (!request.operator.roles.some((role) => record.allowedRoles.includes(role))) {
      reason = "ROLE_NOT_ALLOWED";
    } else if (!ACCESS_PURPOSES.has(request.purpose)) {
      reason = "PURPOSE_NOT_ALLOWED";
    } else if (accessedAt >= instant(record.retentionDeadline)) {
      reason = "RETENTION_EXPIRED";
    } else {
      const audit = this.#appendAudit({
        evidenceId: request.evidenceId,
        operator: request.operator,
        action: "ACCESS",
        outcome: "GRANTED",
        occurredAt: request.accessedAt,
        purpose: auditPurpose,
      });
      this.#encryption.withUnsealed(record.envelope, consume);
      return Object.freeze({
        auditId: audit.auditId,
        evidenceId: request.evidenceId,
        outcome: "GRANTED",
      });
    }

    const audit = this.#appendAudit({
      evidenceId: request.evidenceId,
      operator: request.operator,
      action: "ACCESS",
      outcome: "DENIED",
      occurredAt: request.accessedAt,
      purpose: auditPurpose,
      reason,
    });
    return Object.freeze({
      auditId: audit.auditId,
      evidenceId: request.evidenceId,
      outcome: "DENIED",
      reason,
    });
  }

  public auditTrail(): readonly AuditEntry[] {
    return Object.freeze([...this.#audits]);
  }

  public projectForPublicChannel(_evidenceId: string, channel: PublicChannel): never {
    throw new VaultRuleError(`Restricted evidence cannot enter ${channel}`);
  }

  public deleteEvidence(input: {
    readonly operator: NamedOperator;
    readonly evidenceId: string;
    readonly requestedAt: string;
    readonly destinations: readonly string[];
  }): {
    readonly outcome: "DELETED";
    readonly propagation: readonly {
      readonly destination: string;
      readonly status: "PENDING";
      readonly requestedAt: string;
    }[];
  } {
    requireOperatorRole(input.operator, "EVIDENCE_CUSTODIAN");
    const requestedAt = instant(input.requestedAt);
    const record = this.#records.get(input.evidenceId);
    if (record === undefined) {
      throw new VaultRuleError(`Evidence ${input.evidenceId} was not found`);
    }
    if (record.legalHold !== undefined && instant(record.legalHold.expiresAt) > requestedAt) {
      throw new VaultRuleError(`Evidence ${input.evidenceId} is under an active legal hold`);
    }
    if (input.destinations.length === 0) {
      throw new VaultRuleError("Deletion propagation requires destinations");
    }
    this.#records.delete(input.evidenceId);
    this.#deletedEvidenceIds.add(input.evidenceId);
    const propagation = Object.freeze(
      input.destinations.map((destination) =>
        Object.freeze({
          destination: requiredPurpose(destination, "Deletion destination"),
          status: "PENDING" as const,
          requestedAt: input.requestedAt,
        }),
      ),
    );
    this.#appendAudit({
      evidenceId: input.evidenceId,
      operator: input.operator,
      action: "DELETE",
      outcome: "GRANTED",
      occurredAt: input.requestedAt,
      purpose: "LOCAL_DELETION_AND_PROPAGATION",
    });
    return Object.freeze({ outcome: "DELETED", propagation });
  }

  public beginRestore(input: {
    readonly operator: NamedOperator;
    readonly restoreId: string;
    readonly startedAt: string;
    readonly entries: readonly RestorableEvidenceEntry[];
  }): void {
    requireOperatorRole(input.operator, "SECURITY_REVIEWER");
    requiredPurpose(input.restoreId, "Restore ID");
    instant(input.startedAt);
    if (this.#restores.has(input.restoreId)) {
      throw new VaultRuleError(`Restore ${input.restoreId} already exists`);
    }
    const entries = input.entries.map((entry) => this.#freezeRestorableEntry(entry));
    this.#restores.set(input.restoreId, {
      restoreId: input.restoreId,
      initiatorOperatorId: input.operator.operatorId,
      entries: Object.freeze(entries),
      replayedLedgers: new Set(),
    });
    this.#appendAudit({
      evidenceId: input.restoreId,
      operator: input.operator,
      action: "RESTORE",
      outcome: "GRANTED",
      occurredAt: input.startedAt,
      purpose: "RESTORE_QUARANTINE_CREATED",
    });
  }

  public recordLedgerReplay(input: {
    readonly operator: NamedOperator;
    readonly restoreId: string;
    readonly ledger: RestoreLedger;
    readonly replayedAt: string;
  }): void {
    requireOperatorRole(input.operator, "SECURITY_REVIEWER");
    instant(input.replayedAt);
    const restore = this.#requireRestore(input.restoreId);
    restore.replayedLedgers.add(input.ledger);
  }

  public completeRestore(input: {
    readonly operator: NamedOperator;
    readonly restoreId: string;
    readonly reconciledAt: string;
    readonly passed: boolean;
  }): void {
    requireOperatorRole(input.operator, "SECURITY_REVIEWER");
    instant(input.reconciledAt);
    const restore = this.#requireRestore(input.restoreId);
    if (
      !REQUIRED_RESTORE_LEDGERS.every((ledger) => restore.replayedLedgers.has(ledger))
    ) {
      throw new VaultRuleError(
        "Restore requires withdrawal, consent, deletion and revocation ledger replay",
      );
    }
    if (!input.passed) {
      throw new VaultRuleError("Restore reconciliation must pass before release");
    }
    if (input.operator.operatorId === restore.initiatorOperatorId) {
      throw new VaultRuleError("Restore reconciliation requires an independent verifier");
    }
    for (const entry of restore.entries) {
      if (!this.#deletedEvidenceIds.has(entry.evidenceId)) {
        if (this.#records.has(entry.evidenceId)) {
          throw new VaultRuleError(`Evidence ${entry.evidenceId} already exists`);
        }
        this.#records.set(entry.evidenceId, entry);
      }
    }
    this.#restores.delete(input.restoreId);
    this.#appendAudit({
      evidenceId: input.restoreId,
      operator: input.operator,
      action: "RESTORE",
      outcome: "GRANTED",
      occurredAt: input.reconciledAt,
      purpose: "RESTORE_RECONCILIATION_PASSED",
    });
  }

  #freezeRestorableEntry(entry: RestorableEvidenceEntry): StoredEvidence {
    requiredPurpose(entry.evidenceId, "Evidence ID");
    requiredPurpose(entry.versionId, "Evidence version ID");
    instant(entry.retentionDeadline);
    const legalHold = entry.legalHold === undefined ? {} : { legalHold: entry.legalHold };
    return Object.freeze({
      evidenceId: entry.evidenceId,
      versionId: entry.versionId,
      envelope: freezeEnvelope(entry.envelope),
      allowedRoles: Object.freeze([...entry.allowedRoles]),
      minimization: freezeMinimization(entry.minimization),
      retentionDeadline: entry.retentionDeadline,
      ...legalHold,
    });
  }

  #requireRestore(restoreId: string): RestoreState {
    const restore = this.#restores.get(restoreId);
    if (restore === undefined) {
      throw new VaultRuleError(`Restore ${restoreId} was not found`);
    }
    return restore;
  }

  #appendAudit(input: {
    readonly evidenceId: string;
    readonly operator: NamedOperator;
    readonly action: AuditEntry["action"];
    readonly outcome: AuditEntry["outcome"];
    readonly occurredAt: string;
    readonly purpose: AuditPurpose;
    readonly reason?: string;
  }): AuditEntry {
    const reason = input.reason === undefined ? {} : { reason: input.reason };
    const entry: AuditEntry = Object.freeze({
      auditId: `audit-${String(this.#audits.length + 1)}`,
      evidenceId: input.evidenceId,
      operatorId: input.operator.operatorId || "UNNAMED",
      operatorName: input.operator.operatorName || "UNNAMED",
      action: input.action,
      outcome: input.outcome,
      occurredAt: input.occurredAt,
      purpose: input.purpose,
      ...reason,
    });
    this.#audits.push(entry);
    return entry;
  }
}
