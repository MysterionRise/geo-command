export const AUTHORITATIVE_EVENT_SCHEMA_VERSION = "authoritative-events-v1" as const;

export const AUTHORITATIVE_EVENT_FAMILIES = Object.freeze([
  "SESSION_ISSUED",
  "SESSION_STARTED",
  "ROUND_DISPLAYED",
  "CLUE_REVEALED",
  "ANSWER_ACCEPTED",
  "REVEAL_AUTHORIZED",
  "REVEAL_DENIED",
  "ROUND_CORRECTED",
  "CORRECTION_NOTICE_ACKNOWLEDGED",
  "SESSION_COMPLETED",
  "SESSION_EXPIRED",
  "CONSENT_OR_WITHDRAWAL_CHANGED",
  "CREDENTIAL_CHANGED",
  "SURVEY_OFFERED",
  "SURVEY_SUBMITTED",
  "CRITICAL_DEFECT_CHANGED",
  "OPERATIONAL_INCIDENT_OR_OUTAGE",
] as const);

export type AuthoritativeEventFamily = (typeof AUTHORITATIVE_EVENT_FAMILIES)[number];

type Mode = "provenance" | "language";
type SessionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "WITHDRAWN";
type InteractionStatus = "UNSEEN" | "OPEN" | "ANSWERED" | "REVEALED";
type CorrectionStatus = "ACTIVE" | "VOID" | "CONTENT_WITHDRAWN";
type TerminalCorrectionStatus = "VOID" | "CONTENT_WITHDRAWN";
type DenialReason =
  | "NOT_READY"
  | "EXPIRED"
  | "REPLAYED"
  | "SCOPE_MISMATCH"
  | "GUARD_REJECTED"
  | "ROUND_BLOCKED"
  | "PAYLOAD_REJECTED";
type AnalysisState = "PENDING" | "INCLUDED" | "EXCLUDED";
type CredentialClass = "ENROLLMENT" | "DAILY_SESSION" | "REVEAL";

type EventBase<Family extends AuthoritativeEventFamily> = Readonly<{
  eventId: string;
  eventFamilyId: Family;
  schemaVersionId: typeof AUTHORITATIVE_EVENT_SCHEMA_VERSION;
  acceptedAt: string;
}>;

type ParticipantDayManifest = Readonly<{
  participantLineageId: string;
  betaDay: string;
  manifestLineageId: string;
  manifestVersionId: string;
}>;

type ParticipantSession = ParticipantDayManifest & Readonly<{ sessionId: string }>;

type SessionIssuedEvent = EventBase<"SESSION_ISSUED"> & ParticipantDayManifest & Readonly<{
  issuedAt: string;
  credentialClass: CredentialClass;
  sessionStatus: SessionStatus;
}>;

type SessionStartedEvent = EventBase<"SESSION_STARTED"> & ParticipantSession & Readonly<{
  startedAt: string;
  eligibilityVersionId: string;
  consentVersionId: string;
}>;

type RoundDisplayedEvent = EventBase<"ROUND_DISPLAYED"> & ParticipantSession & Readonly<{
  roundId: string;
  contentId: string;
  mode: Mode;
  ordinalPosition: number;
  displayedAt: string;
  correctionStatus: CorrectionStatus;
}>;

type ClueRevealedEvent = EventBase<"CLUE_REVEALED"> & ParticipantSession & Readonly<{
  roundId: string;
  clueNumber: number;
  scoringVersionId: string;
  interactionStatus: InteractionStatus;
  correctionStatus: CorrectionStatus;
}>;

type AnswerAcceptedEvent = EventBase<"ANSWER_ACCEPTED"> & ParticipantSession & Readonly<{
  roundId: string;
  candidateSetVersionId: string;
  candidateId: string;
  candidateCount: number;
  clueCount: number;
  mode: Mode;
  scoringVersionId: string;
}>;

type RevealAuthorizedEvent = EventBase<"REVEAL_AUTHORIZED"> & Readonly<{
  acceptedAnswerId: string;
  revealedAt: string;
  correctness: boolean;
  evidenceVersionId: string;
  revealVersionId: string;
  authorizationOutcome: "AUTHORIZED";
}>;

type RevealDeniedEvent = EventBase<"REVEAL_DENIED"> & ParticipantDayManifest & Readonly<{
  roundId: string;
  deniedAt: string;
  denialReasonClass: DenialReason;
}>;

type RoundCorrectedEvent = EventBase<"ROUND_CORRECTED"> & Readonly<{
  roundId: string;
  priorCorrectionStatus: "ACTIVE";
  newCorrectionStatus: TerminalCorrectionStatus;
  correctionVersionId: string;
  effectiveAt: string;
  noticeClass: string;
  analyticalTreatment: string;
}>;

type CorrectionNoticeAcknowledgedEvent = EventBase<"CORRECTION_NOTICE_ACKNOWLEDGED"> & Readonly<{
  participantLineageId: string;
  sessionId: string;
  roundId: string;
  correctionVersionId: string;
  noticeVersionId: string;
  acknowledgedAt: string;
}>;

type SessionCompletedEvent = EventBase<"SESSION_COMPLETED"> & ParticipantSession & Readonly<{
  completedAt: string;
  roundCounts: Readonly<{
    ACTIVE: number;
    VOID: number;
    CONTENT_WITHDRAWN: number;
  }>;
  acknowledgementCompleteness: boolean;
  entertainmentScoreVersionId: string;
}>;

type SessionExpiredEvent = EventBase<"SESSION_EXPIRED"> & ParticipantSession & Readonly<{
  expiredAt: string;
  lastInteractionStatus: InteractionStatus;
  completedRoundCount: number;
  denominatorTreatment: string;
}>;

type ConsentOrWithdrawalChangedEvent = EventBase<"CONSENT_OR_WITHDRAWAL_CHANGED"> & Readonly<{
  participantLineageId: string;
  priorConsentState: string;
  newConsentState: string;
  effectiveAt: string;
  policyVersionId: string;
  analyticalInclusionTransition: Readonly<{ from: AnalysisState; to: AnalysisState }>;
  deletionCaseReference?: string;
}>;

type CredentialChangedBase = EventBase<"CREDENTIAL_CHANGED"> & Readonly<{
  participantLineageId: string;
  credentialClass: CredentialClass;
  effectiveAt: string;
  reasonClass: string;
}>;

type CredentialChangedEvent = CredentialChangedBase & (
  | Readonly<{
      credentialAction: "ISSUANCE";
      predecessorCredentialId?: never;
      descendantCredentialIds?: never;
    }>
  | Readonly<{
      credentialAction: "REISSUE";
      predecessorCredentialId: string;
      descendantCredentialIds?: never;
    }>
  | Readonly<{
      credentialAction: "REVOCATION";
      predecessorCredentialId?: never;
      descendantCredentialIds: readonly string[];
    }>
);

type SurveyOfferedEvent = EventBase<"SURVEY_OFFERED"> & Readonly<{
  participantLineageId: string;
  instrumentVersionId: string;
  offeredAt: string;
  signedTriggerClass: string;
  responseWindowEndsAt: string;
}>;

type SurveySubmittedEvent = EventBase<"SURVEY_SUBMITTED"> & Readonly<{
  participantLineageId: string;
  instrumentVersionId: string;
  submittedAt: string;
  closedResponseIds: readonly string[];
  analyticalInclusionState: AnalysisState;
}>;

type CriticalDefectChangedEvent = EventBase<"CRITICAL_DEFECT_CHANGED"> & Readonly<{
  defectId: string;
  defectStatus: "OPENED" | "RESOLVED";
  severity: string;
  affectedScopeId: string;
  affectedRequirementId: string;
  effectiveAt: string;
  releaseBlockingDecision: string;
  ownerId: string;
}>;

type OperationalIncidentOrOutageEvent = EventBase<"OPERATIONAL_INCIDENT_OR_OUTAGE"> & Readonly<{
  incidentId: string;
  incidentVersionId: string;
  startedAt: string;
  endedAt?: string;
  severity: string;
  affectedScopeId: string;
  exclusionTreatment: string;
  streakTreatment: string;
  decisionOwnerId: string;
}>;

type AuthoritativeEventShape =
  | SessionIssuedEvent
  | SessionStartedEvent
  | RoundDisplayedEvent
  | ClueRevealedEvent
  | AnswerAcceptedEvent
  | RevealAuthorizedEvent
  | RevealDeniedEvent
  | RoundCorrectedEvent
  | CorrectionNoticeAcknowledgedEvent
  | SessionCompletedEvent
  | SessionExpiredEvent
  | ConsentOrWithdrawalChangedEvent
  | CredentialChangedEvent
  | SurveyOfferedEvent
  | SurveySubmittedEvent
  | CriticalDefectChangedEvent
  | OperationalIncidentOrOutageEvent;

declare const authoritativeEventBrand: unique symbol;

export type AuthoritativeEvent = AuthoritativeEventShape & Readonly<{
  [authoritativeEventBrand]: true;
}>;

const UNIVERSAL_FIELDS = Object.freeze([
  "eventId",
  "eventFamilyId",
  "schemaVersionId",
  "acceptedAt",
] as const);

const FAMILY_BASE_FIELDS: Readonly<Record<AuthoritativeEventFamily, readonly string[]>> = Object.freeze({
  SESSION_ISSUED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "issuedAt",
    "credentialClass",
    "sessionStatus",
  ]),
  SESSION_STARTED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "startedAt",
    "eligibilityVersionId",
    "consentVersionId",
  ]),
  ROUND_DISPLAYED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "roundId",
    "contentId",
    "mode",
    "ordinalPosition",
    "displayedAt",
    "correctionStatus",
  ]),
  CLUE_REVEALED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "roundId",
    "clueNumber",
    "scoringVersionId",
    "interactionStatus",
    "correctionStatus",
  ]),
  ANSWER_ACCEPTED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "roundId",
    "candidateSetVersionId",
    "candidateId",
    "candidateCount",
    "clueCount",
    "mode",
    "scoringVersionId",
  ]),
  REVEAL_AUTHORIZED: Object.freeze([
    "acceptedAnswerId",
    "revealedAt",
    "correctness",
    "evidenceVersionId",
    "revealVersionId",
    "authorizationOutcome",
  ]),
  REVEAL_DENIED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "roundId",
    "deniedAt",
    "denialReasonClass",
  ]),
  ROUND_CORRECTED: Object.freeze([
    "roundId",
    "priorCorrectionStatus",
    "newCorrectionStatus",
    "correctionVersionId",
    "effectiveAt",
    "noticeClass",
    "analyticalTreatment",
  ]),
  CORRECTION_NOTICE_ACKNOWLEDGED: Object.freeze([
    "participantLineageId",
    "sessionId",
    "roundId",
    "correctionVersionId",
    "noticeVersionId",
    "acknowledgedAt",
  ]),
  SESSION_COMPLETED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "completedAt",
    "roundCounts",
    "acknowledgementCompleteness",
    "entertainmentScoreVersionId",
  ]),
  SESSION_EXPIRED: Object.freeze([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "expiredAt",
    "lastInteractionStatus",
    "completedRoundCount",
    "denominatorTreatment",
  ]),
  CONSENT_OR_WITHDRAWAL_CHANGED: Object.freeze([
    "participantLineageId",
    "priorConsentState",
    "newConsentState",
    "effectiveAt",
    "policyVersionId",
    "analyticalInclusionTransition",
  ]),
  CREDENTIAL_CHANGED: Object.freeze([
    "participantLineageId",
    "credentialClass",
    "credentialAction",
    "effectiveAt",
    "reasonClass",
  ]),
  SURVEY_OFFERED: Object.freeze([
    "participantLineageId",
    "instrumentVersionId",
    "offeredAt",
    "signedTriggerClass",
    "responseWindowEndsAt",
  ]),
  SURVEY_SUBMITTED: Object.freeze([
    "participantLineageId",
    "instrumentVersionId",
    "submittedAt",
    "closedResponseIds",
    "analyticalInclusionState",
  ]),
  CRITICAL_DEFECT_CHANGED: Object.freeze([
    "defectId",
    "defectStatus",
    "severity",
    "affectedScopeId",
    "affectedRequirementId",
    "effectiveAt",
    "releaseBlockingDecision",
    "ownerId",
  ]),
  OPERATIONAL_INCIDENT_OR_OUTAGE: Object.freeze([
    "incidentId",
    "incidentVersionId",
    "startedAt",
    "severity",
    "affectedScopeId",
    "exclusionTreatment",
    "streakTreatment",
    "decisionOwnerId",
  ]),
});

const NON_STRING_FIELDS = new Set([
  "ordinalPosition",
  "clueNumber",
  "candidateCount",
  "clueCount",
  "correctness",
  "roundCounts",
  "acknowledgementCompleteness",
  "completedRoundCount",
  "analyticalInclusionTransition",
  "closedResponseIds",
  "descendantCredentialIds",
]);

const FORBIDDEN_TELEMETRY_KEYS = new Set([
  "code",
  "rawcode",
  "sourcecode",
  "codesnippet",
  "excerpt",
  "prompt",
  "systemprompt",
  "questionprompt",
  "freetext",
  "freeformtext",
  "commenttext",
  "messagetext",
  "feedbacktext",
  "openresponse",
  "ipderivedfingerprint",
  "ipfingerprint",
  "networkfingerprint",
  "fulluseragent",
  "useragent",
  "useragentstring",
  "secret",
  "rawtoken",
  "accesstoken",
  "refreshtoken",
  "credentialtoken",
  "antiforgerytoken",
  "cookie",
  "authorizationheader",
  "password",
  "recruitmentidentity",
  "recruitmentidentityid",
  "recruitmentemail",
  "inviteeemail",
  "recruitmentname",
  "invitationrecipient",
  "recruitmentbridgeid",
]);

const MODE_VALUES = new Set(["provenance", "language"]);
const SESSION_STATUS_VALUES = new Set(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "WITHDRAWN"]);
const INTERACTION_STATUS_VALUES = new Set(["UNSEEN", "OPEN", "ANSWERED", "REVEALED"]);
const CORRECTION_STATUS_VALUES = new Set(["ACTIVE", "VOID", "CONTENT_WITHDRAWN"]);
const TERMINAL_CORRECTION_STATUS_VALUES = new Set(["VOID", "CONTENT_WITHDRAWN"]);
const DENIAL_REASON_VALUES = new Set([
  "NOT_READY",
  "EXPIRED",
  "REPLAYED",
  "SCOPE_MISMATCH",
  "GUARD_REJECTED",
  "ROUND_BLOCKED",
  "PAYLOAD_REJECTED",
]);
const ANALYSIS_STATE_VALUES = new Set(["PENDING", "INCLUDED", "EXCLUDED"]);
const CREDENTIAL_CLASS_VALUES = new Set(["ENROLLMENT", "DAILY_SESSION", "REVEAL"]);
const CREDENTIAL_ACTION_VALUES = new Set(["ISSUANCE", "REISSUE", "REVOCATION"]);
const DEFECT_STATUS_VALUES = new Set(["OPENED", "RESOLVED"]);

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BETA_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const STABLE_IDENTIFIER = /^[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/u;

const fail = (message: string): never => {
  throw new Error(message);
};

const hasOwn = (record: Readonly<Record<string, unknown>>, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, field);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireRecord = (value: unknown, label: string): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) throw new Error(`${label} must be a plain record`);
  return value;
};

const assertDeepFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if (!Object.isFrozen(value)) fail("Immutable boundary requires recursively frozen input");
  seen.add(value);
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
};

const normalizeTelemetryKey = (key: string): string =>
  key.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{Z}\p{Cf}]+/gu, "");

export const assertNoForbiddenTelemetry = (value: unknown): void => {
  const seen = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (typeof candidate !== "object" || candidate === null || seen.has(candidate)) return;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      for (const entry of candidate) visit(entry);
      return;
    }
    for (const [key, nested] of Object.entries(candidate)) {
      if (FORBIDDEN_TELEMETRY_KEYS.has(normalizeTelemetryKey(key))) {
        fail(`Forbidden telemetry field: ${key}`);
      }
      visit(nested);
    }
  };
  visit(value);
};

const requireStableIdentifier = (record: Readonly<Record<string, unknown>>, field: string): string => {
  const value = record[field];
  if (typeof value !== "string" || !STABLE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid stable identifier format for ${field}`);
  }
  return value;
};

const requireUtcInstant = (record: Readonly<Record<string, unknown>>, field: string): string => {
  const value = record[field];
  if (typeof value !== "string" || !UTC_INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid canonical UTC time for ${field}`);
  }
  if (new Date(value).toISOString() !== value) fail(`Invalid canonical UTC time for ${field}`);
  return value;
};

const requireBetaDay = (record: Readonly<Record<string, unknown>>): void => {
  if (!hasOwn(record, "betaDay")) return;
  const value = record.betaDay;
  if (typeof value !== "string" || !BETA_DAY.test(value)) fail("Invalid beta day date");
  const canonical = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(canonical.getTime()) || canonical.toISOString().slice(0, 10) !== value) {
    fail("Invalid beta day date");
  }
};

const requireEnum = (
  record: Readonly<Record<string, unknown>>,
  field: string,
  values: ReadonlySet<string>,
): void => {
  if (!hasOwn(record, field)) return;
  const value = record[field];
  if (typeof value !== "string" || !values.has(value)) fail(`Invalid enum value for ${field}`);
};

const requireInteger = (
  record: Readonly<Record<string, unknown>>,
  field: string,
  minimum: number,
  maximum?: number,
): void => {
  const value = record[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
    fail(`Invalid integer count or position for ${field}`);
  }
};

const requireBoolean = (record: Readonly<Record<string, unknown>>, field: string): void => {
  if (typeof record[field] !== "boolean") fail(`Invalid boolean for ${field}`);
};

const requireDistinctIdentifierArray = (
  record: Readonly<Record<string, unknown>>,
  field: string,
): readonly string[] => {
  const value = record[field];
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a nonblank identifier array`);
  const identifiers: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !STABLE_IDENTIFIER.test(entry)) {
      fail(`${field} must contain nonblank closed response or descendant identifiers`);
    }
    identifiers.push(entry);
  }
  if (new Set(identifiers).size !== identifiers.length) fail(`${field} identifiers must be distinct`);
  return identifiers;
};

const familyFrom = (record: Readonly<Record<string, unknown>>): AuthoritativeEventFamily => {
  const candidate = record.eventFamilyId;
  if (typeof candidate !== "string" || !(AUTHORITATIVE_EVENT_FAMILIES as readonly string[]).includes(candidate)) {
    fail("Unknown event family discriminator");
  }
  return candidate as AuthoritativeEventFamily;
};

const fieldsFor = (
  record: Readonly<Record<string, unknown>>,
  family: AuthoritativeEventFamily,
): Readonly<{ allowed: ReadonlySet<string>; required: ReadonlySet<string> }> => {
  const base = [...UNIVERSAL_FIELDS, ...FAMILY_BASE_FIELDS[family]];
  const allowed = new Set(base);
  const required = new Set(base);

  if (family === "CONSENT_OR_WITHDRAWAL_CHANGED" && record.newConsentState === "WITHDRAWN") {
    allowed.add("deletionCaseReference");
    required.add("deletionCaseReference");
  }

  if (family === "CREDENTIAL_CHANGED") {
    if (record.credentialAction === "REISSUE") {
      allowed.add("predecessorCredentialId");
      required.add("predecessorCredentialId");
    }
    if (record.credentialAction === "REVOCATION") {
      allowed.add("descendantCredentialIds");
      required.add("descendantCredentialIds");
    }
  }

  if (family === "OPERATIONAL_INCIDENT_OR_OUTAGE" && hasOwn(record, "endedAt")) {
    allowed.add("endedAt");
    required.add("endedAt");
  }

  return Object.freeze({ allowed, required });
};

const assertExactShape = (
  record: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  required: ReadonlySet<string>,
): void => {
  for (const field of required) {
    if (!hasOwn(record, field)) fail(`Missing required event field: ${field}`);
  }
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) fail(`Unknown or inapplicable event field: ${field}`);
  }
};

const validateRoundCounts = (record: Readonly<Record<string, unknown>>): void => {
  const roundCounts = requireRecord(record.roundCounts, "roundCounts");
  const expected = ["ACTIVE", "VOID", "CONTENT_WITHDRAWN"];
  if (Object.keys(roundCounts).length !== expected.length || expected.some((field) => !hasOwn(roundCounts, field))) {
    fail("Invalid exact round count field shape");
  }
  let total = 0;
  for (const field of expected) {
    const value = roundCounts[field];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error("Round counts must be nonnegative integers");
    }
    total += value;
  }
  if (total !== 5) fail("Round counts must total five");
};

const validateAnalysisTransition = (record: Readonly<Record<string, unknown>>): void => {
  const transition = requireRecord(record.analyticalInclusionTransition, "analytical inclusion transition");
  if (Object.keys(transition).length !== 2 || !hasOwn(transition, "from") || !hasOwn(transition, "to")) {
    fail("Invalid analytical transition field shape");
  }
  for (const field of ["from", "to"] as const) {
    const state = transition[field];
    if (typeof state !== "string" || !ANALYSIS_STATE_VALUES.has(state)) {
      fail(`Invalid analytical inclusion state for transition.${field}`);
    }
  }
};

const validateScalarFields = (record: Readonly<Record<string, unknown>>): void => {
  for (const field of Object.keys(record)) {
    if (field.endsWith("At")) {
      requireUtcInstant(record, field);
    } else if (field !== "betaDay" && !NON_STRING_FIELDS.has(field)) {
      requireStableIdentifier(record, field);
    }
  }
  requireBetaDay(record);

  requireEnum(record, "mode", MODE_VALUES);
  requireEnum(record, "sessionStatus", SESSION_STATUS_VALUES);
  requireEnum(record, "interactionStatus", INTERACTION_STATUS_VALUES);
  requireEnum(record, "lastInteractionStatus", INTERACTION_STATUS_VALUES);
  requireEnum(record, "correctionStatus", CORRECTION_STATUS_VALUES);
  requireEnum(record, "priorCorrectionStatus", new Set(["ACTIVE"]));
  requireEnum(record, "newCorrectionStatus", TERMINAL_CORRECTION_STATUS_VALUES);
  requireEnum(record, "authorizationOutcome", new Set(["AUTHORIZED"]));
  requireEnum(record, "denialReasonClass", DENIAL_REASON_VALUES);
  requireEnum(record, "credentialClass", CREDENTIAL_CLASS_VALUES);
  requireEnum(record, "credentialAction", CREDENTIAL_ACTION_VALUES);
  requireEnum(record, "analyticalInclusionState", ANALYSIS_STATE_VALUES);
  requireEnum(record, "defectStatus", DEFECT_STATUS_VALUES);
};

const validateFamilyValues = (
  record: Readonly<Record<string, unknown>>,
  family: AuthoritativeEventFamily,
): void => {
  switch (family) {
    case "ROUND_DISPLAYED":
      requireInteger(record, "ordinalPosition", 1, 5);
      break;
    case "CLUE_REVEALED":
      requireInteger(record, "clueNumber", 1, 2);
      break;
    case "ANSWER_ACCEPTED":
      requireInteger(record, "candidateCount", 1);
      requireInteger(record, "clueCount", 0, 2);
      break;
    case "REVEAL_AUTHORIZED":
      requireBoolean(record, "correctness");
      break;
    case "SESSION_COMPLETED":
      validateRoundCounts(record);
      requireBoolean(record, "acknowledgementCompleteness");
      break;
    case "SESSION_EXPIRED":
      requireInteger(record, "completedRoundCount", 0, 5);
      break;
    case "CONSENT_OR_WITHDRAWAL_CHANGED":
      validateAnalysisTransition(record);
      break;
    case "CREDENTIAL_CHANGED":
      if (record.credentialAction === "REVOCATION") {
        requireDistinctIdentifierArray(record, "descendantCredentialIds");
      }
      break;
    case "SURVEY_SUBMITTED":
      requireDistinctIdentifierArray(record, "closedResponseIds");
      break;
    case "OPERATIONAL_INCIDENT_OR_OUTAGE":
      if (hasOwn(record, "endedAt")) {
        const startedAt = requireUtcInstant(record, "startedAt");
        const endedAt = requireUtcInstant(record, "endedAt");
        if (Date.parse(endedAt) < Date.parse(startedAt)) fail("Incident end time precedes start time");
      }
      break;
    default:
      break;
  }
};

const cloneAndFreeze = (value: unknown, clones = new WeakMap<object, unknown>()): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const existing = clones.get(value);
  if (existing !== undefined) return existing;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    clones.set(value, copy);
    for (const entry of value) copy.push(cloneAndFreeze(entry, clones));
    return Object.freeze(copy);
  }
  const copy: Record<string, unknown> = {};
  clones.set(value, copy);
  for (const [key, nested] of Object.entries(value)) copy[key] = cloneAndFreeze(nested, clones);
  return Object.freeze(copy);
};

export const parseAuthoritativeEvent = (input: unknown): AuthoritativeEvent => {
  assertDeepFrozen(input);
  assertNoForbiddenTelemetry(input);
  const record = requireRecord(input, "Authoritative event");
  const family = familyFrom(record);
  const shape = fieldsFor(record, family);
  assertExactShape(record, shape.allowed, shape.required);
  if (record.schemaVersionId !== AUTHORITATIVE_EVENT_SCHEMA_VERSION) fail("Unknown schema version");
  validateScalarFields(record);
  validateFamilyValues(record, family);
  return cloneAndFreeze(record) as AuthoritativeEvent;
};

export const parseAuthoritativeEventBatch = (input: unknown): readonly AuthoritativeEvent[] => {
  if (!Array.isArray(input)) throw new Error("Authoritative event batch must be an array");
  assertDeepFrozen(input);
  const parsed = input.map((event) => parseAuthoritativeEvent(event));
  const eventIds = new Set<string>();
  for (const event of parsed) {
    const eventId = event.eventId;
    if (typeof eventId !== "string") throw new Error("Invalid eventId");
    if (eventIds.has(eventId)) fail(`Duplicate eventId in batch: ${eventId}`);
    eventIds.add(eventId);
  }
  return Object.freeze(parsed);
};
