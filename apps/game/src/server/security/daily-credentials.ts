export class CredentialRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CredentialRuleError";
  }
}

export interface TokenGenerator {
  generate(): string;
}

export interface TokenDigester {
  digest(value: string): string;
}

export interface RateLimiter {
  allow(key: string): boolean;
}

export type CredentialTransition =
  | "SESSION_START"
  | "ROUND_DISPLAY"
  | "ANSWER_SUBMIT"
  | "CLUE_REVEAL"
  | "CORRECTION_NOTICE"
  | "SESSION_COMPLETE";

export interface CredentialOperator {
  readonly name: string;
  readonly role: "CREDENTIAL_OPERATOR" | "CONTENT_OPERATOR";
}

interface CredentialRecord {
  readonly credentialId: string;
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly betaDay: string;
  readonly manifestVersionId: string;
  readonly permittedTransitions: readonly CredentialTransition[];
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly tokenDigest: string;
  readonly antiForgeryDigest: string;
  status: "ACTIVE" | "REVOKED";
}

export interface AuthorizationRequest {
  readonly credentialId: string;
  readonly rawToken: string;
  readonly participantLineageId: string;
  readonly betaDay: string;
  readonly manifestVersionId: string;
  readonly transition: CredentialTransition;
  readonly roundId: string;
  readonly occurredAt: string;
  readonly mutationKey: string;
  readonly antiForgeryToken: string;
  readonly rateLimitKey: string;
  readonly inputBytes: number;
}

type DenialReason =
  | "CREDENTIAL_UNKNOWN"
  | "INPUT_BOUNDS"
  | "MUTATION_KEY_REQUIRED"
  | "ANTI_FORGERY"
  | "TOKEN_INVALID"
  | "SCOPE_MISMATCH"
  | "TRANSITION_NOT_PERMITTED"
  | "EXPIRED"
  | "REVOKED"
  | "PARTICIPANT_WITHDRAWN"
  | "ROUND_CORRECTED"
  | "RATE_LIMITED"
  | "REPLAY"
  | "MUTATION_FAILED";

export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: DenialReason };

export interface SecurityAuditRecord {
  readonly sequence: number;
  readonly action: "ISSUE" | "REVOKE" | "CASCADE_REVOKE" | "WITHDRAWAL" | "ROUND_CORRECTION" | "AUTHORIZE";
  readonly outcome: "ALLOWED" | "DENIED";
  readonly occurredAt: string;
  readonly credentialId?: string;
  readonly participantLineageId?: string;
  readonly operatorName?: string;
  readonly reason?: DenialReason;
}

const text = (value: string | undefined, message: string): string => {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) throw new CredentialRuleError(message);
  return normalized;
};

const instant = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new CredentialRuleError("Valid UTC instant is required");
  return parsed;
};

const credentialOperator = (operator: CredentialOperator): string => {
  const name = text(operator.name, "Named operator is required");
  if (operator.role !== "CREDENTIAL_OPERATOR") {
    throw new CredentialRuleError("Credential operator role is required");
  }
  return name;
};

export class DailyCredentialRegistry {
  readonly #tokenGenerator: TokenGenerator;
  readonly #digester: TokenDigester;
  readonly #rateLimiter: RateLimiter;
  readonly #approvedLineages: ReadonlySet<string>;
  readonly #maximumInputBytes: number;
  readonly #records = new Map<string, CredentialRecord>();
  readonly #issuedDays = new Set<string>();
  readonly #withdrawnLineages = new Set<string>();
  readonly #mutationKeys = new Set<string>();
  readonly #roundCorrections = new Map<string, "VOID" | "CONTENT_WITHDRAWN">();
  readonly #audits: SecurityAuditRecord[] = [];

  public constructor(input: {
    readonly tokenGenerator: TokenGenerator;
    readonly digester: TokenDigester;
    readonly rateLimiter: RateLimiter;
    readonly approvedParticipantLineageIds: readonly string[];
    readonly maximumInputBytes: number;
  }) {
    this.#tokenGenerator = input.tokenGenerator;
    this.#digester = input.digester;
    this.#rateLimiter = input.rateLimiter;
    this.#approvedLineages = new Set(input.approvedParticipantLineageIds);
    this.#maximumInputBytes = input.maximumInputBytes;
  }

  public issue(input: {
    readonly credentialId: string;
    readonly invitationId: string;
    readonly participantLineageId: string;
    readonly betaDay: string;
    readonly manifestVersionId: string;
    readonly permittedTransitions: readonly CredentialTransition[];
    readonly issuedAt: string;
    readonly antiForgeryToken: string;
    readonly operator: CredentialOperator;
  }): { readonly credentialId: string; readonly expiresAt: string; takeRawToken(): string } {
    return this.#privilegedAction("ISSUE", input.issuedAt, input.operator, undefined, undefined, (operatorName) => {
    if (!this.#approvedLineages.has(input.participantLineageId)) {
      throw new CredentialRuleError("Participant lineage is not approved");
    }
    const dayKey = `${input.participantLineageId}:${input.betaDay}`;
    if (this.#issuedDays.has(dayKey)) {
      throw new CredentialRuleError("Daily credential already issued for lineage and beta day");
    }
    const dayStart = Date.parse(`${input.betaDay}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.betaDay) ||
      !Number.isFinite(dayStart) ||
      new Date(dayStart).toISOString().slice(0, 10) !== input.betaDay
    ) {
      throw new CredentialRuleError("UTC beta day is required");
    }
    const allowedTransitions: readonly CredentialTransition[] = [
      "SESSION_START", "ROUND_DISPLAY", "ANSWER_SUBMIT", "CLUE_REVEAL", "CORRECTION_NOTICE", "SESSION_COMPLETE",
    ];
    if (
      input.permittedTransitions.length === 0 ||
      input.permittedTransitions.some((transition) => !allowedTransitions.includes(transition)) ||
      new Set(input.permittedTransitions).size !== input.permittedTransitions.length
    ) {
      throw new CredentialRuleError("Permitted transition scope is invalid");
    }
    const issuedMs = instant(input.issuedAt);
    const expiresAt = new Date(Math.min(issuedMs + 26 * 3_600_000, dayStart + 25 * 3_600_000)).toISOString();
    const rawToken = text(this.#tokenGenerator.generate(), "Generated token is required");
    const tokenDigest = this.#digester.digest(rawToken);
    const antiForgeryDigest = this.#digester.digest(text(input.antiForgeryToken, "Anti-forgery token is required"));
    if (tokenDigest.trim().length === 0 || antiForgeryDigest.trim().length === 0) {
      throw new CredentialRuleError("Credential digests must be nonblank");
    }
    const record: CredentialRecord = {
      credentialId: text(input.credentialId, "Credential ID is required"),
      invitationId: text(input.invitationId, "Invitation ID is required"),
      participantLineageId: input.participantLineageId,
      betaDay: input.betaDay,
      manifestVersionId: text(input.manifestVersionId, "Manifest version is required"),
      permittedTransitions: Object.freeze([...input.permittedTransitions]),
      issuedAt: input.issuedAt,
      expiresAt,
      tokenDigest,
      antiForgeryDigest,
      status: "ACTIVE",
    };
    if (this.#records.has(record.credentialId)) throw new CredentialRuleError("Credential ID already exists");
    this.#records.set(record.credentialId, record);
    this.#issuedDays.add(dayKey);
    this.#audit({ action: "ISSUE", outcome: "ALLOWED", occurredAt: input.issuedAt, credentialId: record.credentialId, participantLineageId: record.participantLineageId, operatorName });
    let available = true;
    return Object.freeze({
      credentialId: record.credentialId,
      expiresAt,
      takeRawToken: (): string => {
        if (!available) throw new CredentialRuleError("Raw token already consumed");
        available = false;
        return rawToken;
      },
    });
    });
  }

  public credentialRecord(credentialId: string): Readonly<CredentialRecord> {
    const record = this.#requireRecord(credentialId);
    return Object.freeze({ ...record, permittedTransitions: Object.freeze([...record.permittedTransitions]) });
  }

  public authorizeAndApply(request: AuthorizationRequest, apply: () => unknown): AuthorizationDecision {
    const record = this.#records.get(request.credentialId);
    const deny = (reason: DenialReason): AuthorizationDecision => {
      const occurredAt = typeof request.occurredAt === "string" && request.occurredAt.trim().length > 0
        ? request.occurredAt
        : "UNRECORDED";
      this.#audit({ action: "AUTHORIZE", outcome: "DENIED", occurredAt, credentialId: request.credentialId, participantLineageId: request.participantLineageId, reason });
      return Object.freeze({ allowed: false, reason });
    };
    if (
      typeof request.occurredAt !== "string" ||
      request.occurredAt.trim().length === 0 ||
      !Number.isFinite(Date.parse(request.occurredAt)) ||
      typeof request.roundId !== "string" ||
      request.roundId.trim().length === 0 ||
      typeof request.rateLimitKey !== "string" ||
      request.rateLimitKey.trim().length === 0
    ) return deny("INPUT_BOUNDS");
    if (record === undefined) return deny("CREDENTIAL_UNKNOWN");
    if (!Number.isInteger(request.inputBytes) || request.inputBytes < 0 || request.inputBytes > this.#maximumInputBytes) return deny("INPUT_BOUNDS");
    if (typeof request.mutationKey !== "string" || request.mutationKey.trim().length === 0) return deny("MUTATION_KEY_REQUIRED");
    if (typeof request.antiForgeryToken !== "string" || this.#digester.digest(request.antiForgeryToken) !== record.antiForgeryDigest) return deny("ANTI_FORGERY");
    if (typeof request.rawToken !== "string" || this.#digester.digest(request.rawToken) !== record.tokenDigest) return deny("TOKEN_INVALID");
    if (request.participantLineageId !== record.participantLineageId || request.betaDay !== record.betaDay || request.manifestVersionId !== record.manifestVersionId) return deny("SCOPE_MISMATCH");
    if (record.status === "REVOKED") return deny("REVOKED");
    if (this.#withdrawnLineages.has(record.participantLineageId)) return deny("PARTICIPANT_WITHDRAWN");
    if (instant(request.occurredAt) >= Date.parse(record.expiresAt)) return deny("EXPIRED");
    if (!record.permittedTransitions.includes(request.transition)) return deny("TRANSITION_NOT_PERMITTED");
    if (this.#roundCorrections.has(`${record.credentialId}:${request.roundId}`) && request.transition !== "CORRECTION_NOTICE") return deny("ROUND_CORRECTED");
    const rateLimitKey = [record.credentialId, record.participantLineageId, record.betaDay, record.manifestVersionId, request.transition].join(":");
    if (!this.#rateLimiter.allow(rateLimitKey)) return deny("RATE_LIMITED");
    const mutationKey = `${record.credentialId}:${request.mutationKey}`;
    if (this.#mutationKeys.has(mutationKey)) return deny("REPLAY");
    this.#mutationKeys.add(mutationKey);
    try {
      apply();
    } catch {
      return deny("MUTATION_FAILED");
    }
    this.#audit({ action: "AUTHORIZE", outcome: "ALLOWED", occurredAt: request.occurredAt, credentialId: record.credentialId, participantLineageId: record.participantLineageId });
    return Object.freeze({ allowed: true });
  }

  public revoke(input: { readonly credentialId: string; readonly occurredAt: string; readonly operator: CredentialOperator }): void {
    this.#privilegedAction("REVOKE", input.occurredAt, input.operator, input.credentialId, undefined, (operatorName) => {
      const record = this.#requireRecord(input.credentialId);
      record.status = "REVOKED";
      this.#audit({ action: "REVOKE", outcome: "ALLOWED", occurredAt: input.occurredAt, credentialId: record.credentialId, participantLineageId: record.participantLineageId, operatorName });
    });
  }

  public cascadeRevoke(input: { readonly invitationId: string; readonly participantLineageId: string; readonly descendantCredentialIds: readonly string[]; readonly occurredAt: string; readonly operator: CredentialOperator }): void {
    this.#privilegedAction("CASCADE_REVOKE", input.occurredAt, input.operator, undefined, input.participantLineageId, (operatorName) => {
      const supplied = input.descendantCredentialIds.map((id) => this.#requireRecord(id));
      if (supplied.some((record) => record.invitationId !== input.invitationId || record.participantLineageId !== input.participantLineageId)) throw new CredentialRuleError("Cascade descendant scope mismatch");
      const descendants = [...this.#records.values()].filter((record) => record.invitationId === input.invitationId && record.participantLineageId === input.participantLineageId);
      for (const record of descendants) record.status = "REVOKED";
      this.#audit({ action: "CASCADE_REVOKE", outcome: "ALLOWED", occurredAt: input.occurredAt, participantLineageId: input.participantLineageId, operatorName });
    });
  }

  public recordParticipantWithdrawal(input: { readonly participantLineageId: string; readonly occurredAt: string; readonly operator: CredentialOperator }): void {
    const operatorName = credentialOperator(input.operator);
    this.#withdrawnLineages.add(input.participantLineageId);
    this.#audit({ action: "WITHDRAWAL", outcome: "ALLOWED", occurredAt: input.occurredAt, participantLineageId: input.participantLineageId, operatorName });
  }

  public recordRoundCorrection(input: { readonly credentialId: string; readonly roundId: string; readonly status: "VOID" | "CONTENT_WITHDRAWN"; readonly occurredAt: string; readonly operator: CredentialOperator }): void {
    const operatorName = credentialOperator(input.operator);
    const record = this.#requireRecord(input.credentialId);
    this.#roundCorrections.set(`${record.credentialId}:${text(input.roundId, "Round ID is required")}`, input.status);
    this.#audit({ action: "ROUND_CORRECTION", outcome: "ALLOWED", occurredAt: input.occurredAt, credentialId: record.credentialId, participantLineageId: record.participantLineageId, operatorName });
  }

  public auditRecords(): readonly SecurityAuditRecord[] {
    return Object.freeze([...this.#audits]);
  }

  public safeUrlParameters(_credentialId: string): Readonly<Record<string, never>> {
    return Object.freeze({});
  }

  public safeLogProjection(credentialId: string): Readonly<Record<string, string>> {
    const record = this.#requireRecord(credentialId);
    return Object.freeze({ credentialId: record.credentialId, status: record.status });
  }

  public safeAnalyticsProjection(credentialId: string): Readonly<Record<string, string>> {
    const record = this.#requireRecord(credentialId);
    return Object.freeze({ credentialId: record.credentialId, betaDay: record.betaDay, manifestVersionId: record.manifestVersionId });
  }

  #requireRecord(credentialId: string): CredentialRecord {
    const record = this.#records.get(credentialId);
    if (record === undefined) throw new CredentialRuleError("Credential does not exist");
    return record;
  }

  #privilegedAction<T>(
    action: "ISSUE" | "REVOKE" | "CASCADE_REVOKE",
    occurredAt: string,
    operator: CredentialOperator,
    credentialId?: string,
    participantLineageId?: string,
    operation?: (operatorName: string) => T,
  ): T {
    try {
      const operatorName = credentialOperator(operator);
      if (operation === undefined) throw new CredentialRuleError("Privileged operation is required");
      return operation(operatorName);
    } catch (error) {
      const audit: Omit<SecurityAuditRecord, "sequence"> = {
        action,
        outcome: "DENIED",
        occurredAt,
        ...(credentialId === undefined ? {} : { credentialId }),
        ...(participantLineageId === undefined ? {} : { participantLineageId }),
        ...(operator.name.trim().length === 0 ? {} : { operatorName: operator.name.trim() }),
      };
      this.#audit(audit);
      throw error;
    }
  }

  #audit(input: Omit<SecurityAuditRecord, "sequence">): void {
    this.#audits.push(Object.freeze({ sequence: this.#audits.length + 1, ...input }));
  }
}
