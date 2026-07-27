export class ReleaseRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReleaseRuleError";
  }
}

export type RecordValue = Record<string, unknown>;

export type ApprovalPurpose =
  | "UTC_LIFECYCLE"
  | "DAY7_GATE_CONFIGURATION"
  | "DAY7_REPORT"
  | "DAY8_OPEN_DECISION"
  | "DAY8_DEPARTURE_RATIONALE";

export interface AuthorityApprovalClaim extends Readonly<Record<string, unknown>> {
  readonly purpose: ApprovalPurpose;
  readonly signerName: string;
  readonly signerRole: string;
  readonly signedAt: string;
  readonly signatureId: string;
  readonly payloadDigest: string;
}

export interface AuthenticatedOperatorClaim extends Readonly<Record<string, unknown>> {
  readonly name: string;
  readonly role: "RELEASE_OPERATOR";
}

export interface AuthorityVerifier {
  readonly trustDomain: object;
  readonly verifyApproval: (claim: AuthorityApprovalClaim) => boolean;
  readonly isAuthenticatedOperator: (claim: AuthenticatedOperatorClaim) => boolean;
}

export interface AuthoritativeClock {
  readonly now: () => string;
}

export interface AuditIntegrity {
  readonly seal: (payloadDigest: string) => string;
  readonly verify: (payloadDigest: string, seal: string) => boolean;
}

export interface Day8AuthorizationStore {
  readonly transact: (scopeKey: string, transition: (prior: unknown | null) => unknown) => unknown;
}

export interface Day8AuthorizationServices {
  readonly authority: AuthorityVerifier;
  readonly auditIntegrity: AuditIntegrity;
  readonly clock: AuthoritativeClock;
  readonly store: Day8AuthorizationStore;
}

export interface ActiveDayWindow {
  readonly activeDayId: string;
  readonly ordinal: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly graceEndsAt: string;
}

export interface UtcBetaLifecycle {
  readonly lifecycleVersionId: string;
  readonly dayCalendarVersionId: string;
  readonly day1StartDate: string;
  readonly activeDayIds: readonly string[];
  readonly graceMinutes: 60;
  readonly initialWindows: readonly ActiveDayWindow[];
  readonly day7FreezeAt: string;
  readonly day8Start: null;
}

export interface AuthorizationAttempt {
  readonly outcome: "ALLOWED" | "DENIED";
  readonly reason: string;
  readonly occurredAt: string;
}

export interface AuthorizationAuditRecord {
  readonly sequence: number;
  readonly action: "AUTHORIZE_DAY8";
  readonly outcome: "ALLOWED" | "DENIED";
  readonly occurredAt: string;
  readonly operatorName: string;
  readonly operatorRole: string;
  readonly decisionId: string;
  readonly decisionDigest: string;
  readonly reportId: string;
  readonly reportVersionId: string;
  readonly decisionSignatureId: string;
  readonly departureRationaleReferenceId: string | null;
  readonly departureRationaleSignatureId: string | null;
  readonly reason: string | null;
  readonly signedDecision: Readonly<Record<string, unknown>>;
  readonly integritySeal: string;
}

export interface AllowedDay8Authorization {
  readonly allowed: true;
  readonly reason: "AUTHORIZED";
  readonly day8Start: string;
  readonly decisionId: string;
  readonly idempotencyKey: string;
  readonly reportId: string;
  readonly reportVersionId: string;
  readonly lifecycleVersionId: string;
  readonly decisionDigest: string;
  readonly signedDecision: Readonly<Record<string, unknown>>;
  readonly departureRationaleReferenceId: string | null;
  readonly departureRationaleSignatureId: string | null;
  readonly lastAttempt: AuthorizationAttempt;
  readonly auditRecords: readonly AuthorizationAuditRecord[];
  readonly stateIntegritySeal: string;
}

export interface DeniedDay8Authorization {
  readonly allowed: false;
  readonly reason: string;
  readonly lastAttempt: AuthorizationAttempt;
  readonly auditRecords: readonly AuthorizationAuditRecord[];
  readonly stateIntegritySeal: string;
}

export type Day8Authorization = AllowedDay8Authorization | DeniedDay8Authorization;

export interface Day7GateEvaluation {
  readonly reportId: string;
  readonly reportVersionId: string;
  readonly reportTemplateVersionId: string;
  readonly gateConfigurationVersionId: string;
  readonly lifecycleVersionId: string;
  readonly dayCalendarVersionId: string;
  readonly freezeAt: string;
  readonly reportSignedAt: string;
  readonly reportSignerName: string;
  readonly reportSignerRole: "GATE_REPORT_APPROVER";
  readonly reportSignatureId: string;
  readonly gateConfigurationSignedAt: string;
  readonly gateConfigurationSignatureId: string;
  readonly viewReferenceIds: Readonly<{ readonly mode: string; readonly day: string; readonly position: string; readonly cohort: string }>;
  readonly incidentTreatmentReferenceIds: readonly string[];
  readonly inventoryReadinessReferenceId: string;
  readonly missingDataTreatmentReferenceId: string;
  readonly criterionResults: readonly Readonly<Record<string, unknown>>[];
  readonly overallOutcome: "PASS" | "FAIL" | "INDETERMINATE";
  readonly recommendation: "OPEN" | "DO_NOT_OPEN" | "PAUSE";
}

const lifecycles = new WeakMap<object, object>();
const gateEvaluations = new WeakMap<object, object>();
const authorizations = new WeakMap<object, object>();

export function fail(message: string): never {
  throw new ReleaseRuleError(message);
}

export const asRecord = (value: unknown, label: string): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as RecordValue;
};

export const exact = (value: Readonly<Record<string, unknown>>, fields: readonly string[], label: string): void => {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(value, field)) || keys.some((field) => !fields.includes(field))) {
    fail(`${label} field set is invalid`);
  }
};

export const assertDeepFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail("Release input must be recursively frozen at the boundary");
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
};

export const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be nonblank`);
  return value;
};

export const canonicalInstant = (value: unknown, label: string): string => {
  const candidate = text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate) ||
    Number.isNaN(Date.parse(candidate)) || new Date(candidate).toISOString() !== candidate) {
    fail(`${label} must be a canonical UTC instant`);
  }
  return candidate;
};

export const utcDate = (value: unknown, label: string): string => {
  const candidate = text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate) ||
    new Date(`${candidate}T00:00:00.000Z`).toISOString().slice(0, 10) !== candidate) fail(`${label} must be a UTC date`);
  return candidate;
};

export const nonnegativeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail(`${label} must be a nonnegative integer`);
  return value;
};

export const finiteNonnegative = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${label} must be a finite nonnegative number`);
  return value;
};

export const boolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") fail(`${label} must be boolean`);
  return value;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalValue(value));

export const requireAuthority = (value: unknown): AuthorityVerifier => {
  const raw = asRecord(value, "release authority verifier");
  if (typeof raw.trustDomain !== "object" || raw.trustDomain === null ||
    typeof raw.verifyApproval !== "function" || typeof raw.isAuthenticatedOperator !== "function") {
    fail("Release authority verifier is invalid");
  }
  return value as AuthorityVerifier;
};

export const verifyApproval = (
  authority: AuthorityVerifier,
  purpose: ApprovalPurpose,
  signerName: string,
  signerRole: string,
  signedAt: string,
  signatureId: string,
  normalizedUnsignedPayload: unknown,
): boolean => {
  const claim = Object.freeze({ purpose, signerName, signerRole, signedAt, signatureId,
    payloadDigest: canonicalJson(normalizedUnsignedPayload) });
  try { return authority.verifyApproval(claim); }
  catch { return false; }
};

export const authenticatedOperator = (authority: AuthorityVerifier, name: string): boolean => {
  try { return authority.isAuthenticatedOperator(Object.freeze({ name, role: "RELEASE_OPERATOR" as const })); }
  catch { return false; }
};

export const deepDetach = <T>(value: T): T => {
  if (Array.isArray(value)) return Object.freeze(value.map((entry) => deepDetach(entry))) as T;
  if (typeof value !== "object" || value === null) return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deepDetach(nested)]))) as T;
};

export const freezeAuditRecords = (records: readonly AuthorizationAuditRecord[]): readonly AuthorizationAuditRecord[] =>
  Object.freeze(records.map((record) => deepDetach(record)));

export const registerLifecycle = <T extends UtcBetaLifecycle>(value: T, authority: AuthorityVerifier): T => {
  lifecycles.set(value, authority.trustDomain);
  return value;
};

export const requireLifecycle = (value: unknown, authority: AuthorityVerifier): UtcBetaLifecycle => {
  if (typeof value !== "object" || value === null || lifecycles.get(value) !== authority.trustDomain) fail("Lifecycle authority-domain provenance is invalid");
  return value as UtcBetaLifecycle;
};

export const registerGateEvaluation = <T extends Day7GateEvaluation>(value: T, authority: AuthorityVerifier): T => {
  gateEvaluations.set(value, authority.trustDomain);
  return value;
};

export const isGateEvaluation = (value: unknown, authority: AuthorityVerifier): value is Day7GateEvaluation =>
  typeof value === "object" && value !== null && gateEvaluations.get(value) === authority.trustDomain;

export const registerAuthorization = <T extends Day8Authorization>(value: T, authority: AuthorityVerifier): T => {
  authorizations.set(value, authority.trustDomain);
  return value;
};

export const isAuthorization = (value: unknown, authority: AuthorityVerifier): value is Day8Authorization =>
  typeof value === "object" && value !== null && authorizations.get(value) === authority.trustDomain;

export const detachedAuthorization = (value: Day8Authorization, authority: AuthorityVerifier): Day8Authorization =>
  registerAuthorization(deepDetach(value), authority);
