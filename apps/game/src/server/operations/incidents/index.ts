import { parseAuthoritativeEvent } from "../../../../../../packages/measurement/src/events/index.js";

type RecordValue = Record<string, unknown>;
type DeliveryAction = "MANIFEST" | "REVEAL";

export class IncidentRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IncidentRuleError";
  }
}

export interface IncidentPolicyAuthority {
  readonly trustDomainId: string;
  readonly verifyPolicy: (claim: Readonly<Record<string, unknown>>) => boolean;
  readonly verifyIncident: (claim: Readonly<Record<string, unknown>>) => boolean;
}

interface IncidentRule {
  readonly ruleId: string;
  readonly severity: string;
  readonly platformCaused: boolean;
  readonly exclusionTreatment: "PLATFORM_INVALID_PERIOD" | "NONE";
  readonly streakTreatment: "PRESERVE" | "UNCHANGED";
}

interface IncidentPolicy {
  readonly authorityDomainId: string;
  readonly incidentPolicyVersionId: string;
  readonly dayCalendarVersionId: string;
  readonly rules: readonly IncidentRule[];
  readonly signedBy: "Don";
  readonly signedAt: string;
  readonly signatureId: string;
}

interface IncidentAttestation {
  readonly attestationId: string;
  readonly authorityDomainId: string;
  readonly signedBy: string;
  readonly signerRole: "RELEASE_OPERATOR";
  readonly signedAt: string;
  readonly payloadDigest: string;
  readonly signatureId: string;
}

interface RecordedIncident {
  readonly policy: IncidentPolicy;
  readonly attestation: IncidentAttestation;
  readonly event: Readonly<Record<string, unknown>>;
  readonly treatment: Readonly<{
    incidentPolicyVersionId: string;
    dayCalendarVersionId: string;
    ruleId: string;
    platformCaused: boolean;
  }>;
}

const fail = (message: string): never => { throw new IncidentRuleError(message); };

const asRecord = (value: unknown, label: string): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${label} must be an object`);
  return value as RecordValue;
};

const exact = (value: Readonly<Record<string, unknown>>, fields: readonly string[], label: string): void => {
  const keys = Object.keys(value);
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(value, field)) ||
    keys.some((field) => !fields.includes(field))) fail(`${label} field set is invalid`);
};

const assertDeepFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail("Incident operation input must be recursively frozen at the boundary");
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be nonblank`);
  return value as string;
};

const canonicalInstant = (value: unknown, label: string): string => {
  const candidate = text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate) ||
    Number.isNaN(Date.parse(candidate)) || new Date(candidate).toISOString() !== candidate) {
    fail(`${label} must be a canonical UTC instant`);
  }
  return candidate;
};

const utcDate = (value: unknown, label: string): string => {
  const candidate = text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate) ||
    new Date(`${candidate}T00:00:00.000Z`).toISOString().slice(0, 10) !== candidate) fail(`${label} must be a UTC date`);
  return candidate;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalValue(record[key])]));
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalValue(value));

const deepDetach = <T>(value: T): T => {
  if (Array.isArray(value)) return Object.freeze(value.map((entry) => deepDetach(entry))) as T;
  if (typeof value !== "object" || value === null) return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deepDetach(nested)]))) as T;
};

const requireAuthority = (value: unknown): IncidentPolicyAuthority => {
  const raw = asRecord(value, "incident policy authority");
  if (typeof raw.trustDomainId !== "string" || raw.trustDomainId.trim().length === 0 ||
    typeof raw.verifyPolicy !== "function" || typeof raw.verifyIncident !== "function") {
    fail("Incident policy authority is invalid");
  }
  return value as IncidentPolicyAuthority;
};

const parseRule = (value: unknown): IncidentRule => {
  const raw = asRecord(value, "incident policy rule");
  exact(raw, ["ruleId", "severity", "platformCaused", "exclusionTreatment", "streakTreatment"], "incident policy rule");
  const platformCaused = raw.platformCaused;
  const exclusionTreatment = raw.exclusionTreatment;
  const streakTreatment = raw.streakTreatment;
  if (typeof platformCaused !== "boolean") fail("Incident platform classification must be boolean");
  if (exclusionTreatment !== "PLATFORM_INVALID_PERIOD" && exclusionTreatment !== "NONE") {
    fail("Incident exclusion treatment is invalid");
  }
  if (streakTreatment !== "PRESERVE" && streakTreatment !== "UNCHANGED") fail("Incident streak treatment is invalid");
  if (platformCaused) {
    if (exclusionTreatment !== "PLATFORM_INVALID_PERIOD" || streakTreatment !== "PRESERVE") {
      fail("Platform incidents must preserve streaks and remain reported as invalid periods");
    }
  } else if (exclusionTreatment !== "NONE" || streakTreatment !== "UNCHANGED") {
    fail("Non-platform incidents cannot automatically receive platform treatment");
  }
  return Object.freeze({ ruleId: text(raw.ruleId, "Incident rule identity"), severity: text(raw.severity, "Incident severity"),
    platformCaused: platformCaused as boolean,
    exclusionTreatment: exclusionTreatment as IncidentRule["exclusionTreatment"],
    streakTreatment: streakTreatment as IncidentRule["streakTreatment"] });
};

export const createIncidentPolicy = (value: unknown, authorityInput: unknown): IncidentPolicy => {
  const authority = requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const raw = asRecord(value, "signed incident policy");
  exact(raw, ["authorityDomainId", "incidentPolicyVersionId", "dayCalendarVersionId", "rules", "signedBy", "signatureId", "signedAt"], "signed incident policy");
  const authorityDomainId = text(raw.authorityDomainId, "Incident policy authority domain");
  if (authorityDomainId !== authority.trustDomainId) fail("Incident policy authority domain does not match the verifier");
  const rawRules = raw.rules;
  if (!Array.isArray(rawRules) || rawRules.length === 0) fail("Incident policy rules must be nonempty");
  const rules: readonly IncidentRule[] = Object.freeze((rawRules as readonly unknown[]).map(parseRule));
  if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length) fail("Duplicate incident policy rule identity");
  if (raw.signedBy !== "Don") fail("Incident policy requires Don signature");
  const signedAt = canonicalInstant(raw.signedAt, "Incident policy signature time");
  const signatureId = text(raw.signatureId, "Incident policy signature");
  const unsigned = Object.freeze({ authorityDomainId, incidentPolicyVersionId: text(raw.incidentPolicyVersionId, "Incident policy version"),
    dayCalendarVersionId: text(raw.dayCalendarVersionId, "Day-calendar version"), rules, signedBy: "Don" as const, signedAt });
  const claim = Object.freeze({ authorityDomainId, signerName: "Don", signerRole: "DON", signedAt, signatureId,
    payloadDigest: canonicalJson(unsigned) });
  let verified = false;
  try { verified = authority.verifyPolicy(claim); }
  catch { verified = false; }
  if (!verified) fail("Incident policy signature authority verification failed");
  return Object.freeze({ ...unsigned, signatureId });
};

const verifyIncidentAttestation = (value: unknown, event: Readonly<Record<string, unknown>>,
  authority: IncidentPolicyAuthority): IncidentAttestation => {
  const raw = asRecord(value, "incident attestation");
  exact(raw, ["attestationId", "authorityDomainId", "signedBy", "signerRole", "signedAt", "payloadDigest", "signatureId"], "incident attestation");
  const authorityDomainId = text(raw.authorityDomainId, "Incident attestation authority domain");
  const signedBy = text(raw.signedBy, "Incident attestation signer");
  if (authorityDomainId !== authority.trustDomainId) fail("Incident attestation authority domain does not match the verifier");
  if (raw.signerRole !== "RELEASE_OPERATOR" || signedBy !== event.decisionOwnerId) {
    fail("Incident attestation requires its decision-owning release operator");
  }
  const signedAt = canonicalInstant(raw.signedAt, "Incident attestation time");
  if (Date.parse(signedAt) < Date.parse(String(event.startedAt)) || Date.parse(signedAt) > Date.parse(String(event.acceptedAt))) {
    fail("Incident attestation chronology is invalid");
  }
  const payloadDigest = text(raw.payloadDigest, "Incident attestation payload digest");
  if (payloadDigest !== canonicalJson(event)) fail("Incident attestation payload digest does not match the event");
  const attestation = Object.freeze({ attestationId: text(raw.attestationId, "Incident attestation identity"), authorityDomainId,
    signedBy, signerRole: "RELEASE_OPERATOR" as const, signedAt, payloadDigest,
    signatureId: text(raw.signatureId, "Incident attestation signature") });
  let verified = false;
  try { verified = authority.verifyIncident(attestation); }
  catch { verified = false; }
  if (!verified) fail("Incident occurrence attestation authority verification failed");
  return attestation;
};

export const recordOperationalIncident = (value: unknown, authorityInput: unknown): RecordedIncident => {
  assertDeepFrozen(value);
  const raw = asRecord(value, "operational incident");
  const hasEnd = Object.hasOwn(raw, "endedAt");
  exact(raw, hasEnd
    ? ["policy", "eventId", "schemaVersionId", "acceptedAt", "incidentId", "incidentVersionId", "ruleId", "startedAt", "endedAt", "affectedScopeId", "decisionOwnerId", "attestation"]
    : ["policy", "eventId", "schemaVersionId", "acceptedAt", "incidentId", "incidentVersionId", "ruleId", "startedAt", "affectedScopeId", "decisionOwnerId", "attestation"],
  "operational incident");
  const policy = createIncidentPolicy(raw.policy, authorityInput);
  const ruleId = text(raw.ruleId, "Incident rule identity");
  const rule = policy.rules.find((entry) => entry.ruleId === ruleId) ?? fail("Incident rule is not present in the signed policy");
  if (raw.schemaVersionId !== "authoritative-events-v1") fail("Incident event schema version is invalid");
  const startedAt = canonicalInstant(raw.startedAt, "Incident start");
  const acceptedAt = canonicalInstant(raw.acceptedAt, "Incident acceptance");
  if (Date.parse(acceptedAt) < Date.parse(startedAt)) fail("Incident acceptance precedes its start");
  const endedAt = hasEnd ? canonicalInstant(raw.endedAt, "Incident end") : undefined;
  if (endedAt !== undefined && Date.parse(endedAt) < Date.parse(startedAt)) fail("Incident end precedes its start");
  const event = Object.freeze({ eventId: text(raw.eventId, "Incident event identity"),
    eventFamilyId: "OPERATIONAL_INCIDENT_OR_OUTAGE" as const, schemaVersionId: "authoritative-events-v1" as const, acceptedAt,
    incidentId: text(raw.incidentId, "Incident identity"), incidentVersionId: text(raw.incidentVersionId, "Incident version"),
    startedAt, ...(endedAt === undefined ? {} : { endedAt }), severity: rule.severity,
    affectedScopeId: text(raw.affectedScopeId, "Incident affected scope"), exclusionTreatment: rule.exclusionTreatment,
    streakTreatment: rule.streakTreatment, decisionOwnerId: text(raw.decisionOwnerId, "Incident decision owner") });
  const parsedEvent = parseAuthoritativeEvent(event) as unknown as Readonly<Record<string, unknown>>;
  const attestation = verifyIncidentAttestation(raw.attestation, parsedEvent, requireAuthority(authorityInput));
  return Object.freeze({ policy: deepDetach(policy), attestation, event: parsedEvent,
    treatment: Object.freeze({ incidentPolicyVersionId: policy.incidentPolicyVersionId,
    dayCalendarVersionId: policy.dayCalendarVersionId, ruleId, platformCaused: rule.platformCaused }) });
};

const parseRecordedIncident = (value: unknown, authorityInput: unknown): RecordedIncident => {
  const raw = asRecord(value, "recorded incident");
  exact(raw, ["policy", "attestation", "event", "treatment"], "recorded incident");
  const authority = requireAuthority(authorityInput);
  const policy = createIncidentPolicy(raw.policy, authorityInput);
  const event = parseAuthoritativeEvent(raw.event) as unknown as Readonly<Record<string, unknown>>;
  if (event.eventFamilyId !== "OPERATIONAL_INCIDENT_OR_OUTAGE") fail("Recorded incident event family is invalid");
  const attestation = verifyIncidentAttestation(raw.attestation, event, authority);
  const treatmentRaw = asRecord(raw.treatment, "incident treatment");
  exact(treatmentRaw, ["incidentPolicyVersionId", "dayCalendarVersionId", "ruleId", "platformCaused"], "incident treatment");
  const platformCaused = treatmentRaw.platformCaused;
  if (typeof platformCaused !== "boolean") fail("Incident treatment platform classification is invalid");
  const treatment = Object.freeze({ incidentPolicyVersionId: text(treatmentRaw.incidentPolicyVersionId, "Incident policy version"),
    dayCalendarVersionId: text(treatmentRaw.dayCalendarVersionId, "Day-calendar version"),
    ruleId: text(treatmentRaw.ruleId, "Incident rule identity"), platformCaused: platformCaused as boolean });
  const rule = policy.rules.find((entry) => entry.ruleId === treatment.ruleId) ?? fail("Recorded incident rule is not signed");
  if (treatment.incidentPolicyVersionId !== policy.incidentPolicyVersionId ||
    treatment.dayCalendarVersionId !== policy.dayCalendarVersionId || treatment.platformCaused !== rule.platformCaused ||
    event.severity !== rule.severity || event.exclusionTreatment !== rule.exclusionTreatment || event.streakTreatment !== rule.streakTreatment) {
    fail("Incident treatment does not match the authoritative event");
  }
  return Object.freeze({ policy: deepDetach(policy), attestation, event: deepDetach(event), treatment });
};

const canonicalMinute = (value: unknown): string => {
  const instant = canonicalInstant(value, "Availability minute");
  const parsed = new Date(instant);
  if (parsed.getUTCSeconds() !== 0 || parsed.getUTCMilliseconds() !== 0) fail("Availability minute must be a canonical UTC minute bucket");
  return instant;
};

export const evaluateAvailability = (value: unknown, authorityInput: unknown) => {
  requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const raw = asRecord(value, "availability evidence");
  exact(raw, ["availabilityEvidenceVersionId", "dayCalendarVersionId", "observationWindowId", "affectedScopeId", "startsAt", "endsAt", "minuteObservations", "incidents"], "availability evidence");
  const startsAt = canonicalMinute(raw.startsAt);
  const endsAt = canonicalMinute(raw.endsAt);
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  if (duration <= 0 || duration % 60_000 !== 0) fail("Availability observation window is invalid");
  const expectedMinutes = duration / 60_000;
  if (!Number.isSafeInteger(expectedMinutes) || expectedMinutes > 14 * 24 * 60) fail("Availability observation window exceeds the beta boundary");
  const affectedScopeId = text(raw.affectedScopeId, "Availability affected scope");
  const rawIncidents = raw.incidents;
  if (!Array.isArray(rawIncidents)) fail("Availability incidents must be an array");
  const incidents: readonly RecordedIncident[] = (rawIncidents as readonly unknown[])
    .map((entry) => parseRecordedIncident(entry, authorityInput));
  const dayCalendarVersionId = text(raw.dayCalendarVersionId, "Day-calendar version");
  if (incidents.some((incident) => incident.treatment.dayCalendarVersionId !== dayCalendarVersionId)) {
    fail("Availability day-calendar version does not match its incident policy");
  }
  const incidentKeys = incidents.map(({ event }) => `${String(event.incidentId)}\u0000${String(event.incidentVersionId)}`);
  if (new Set(incidentKeys).size !== incidentKeys.length) fail("Duplicate incident version in availability evidence");
  const rawMinuteObservations = raw.minuteObservations;
  if (!Array.isArray(rawMinuteObservations)) fail("Availability minute observations must be an array");
  const seen = new Set<string>();
  let availableMinuteCount = 0;
  let unavailableMinuteCount = 0;
  let platformInvalidMinuteCount = 0;
  for (const entry of rawMinuteObservations as readonly unknown[]) {
    const observation = asRecord(entry, "availability minute observation");
    const minute = canonicalMinute(observation.minute);
    if (seen.has(minute)) fail("Duplicate availability minute observation");
    seen.add(minute);
    if (Date.parse(minute) < Date.parse(startsAt) || Date.parse(minute) >= Date.parse(endsAt)) {
      fail("Availability minute lies outside the observation window");
    }
    if (observation.status === "AVAILABLE") {
      exact(observation, ["minute", "status"], "available minute observation");
      availableMinuteCount += 1;
      continue;
    }
    if (observation.status === "UNAVAILABLE") {
      exact(observation, ["minute", "status"], "unavailable minute observation");
      unavailableMinuteCount += 1;
      continue;
    }
    if (observation.status !== "PLATFORM_INVALID") fail("Availability minute status is invalid");
    exact(observation, ["minute", "status", "incidentId", "incidentVersionId", "incidentPolicyVersionId", "affectedScopeId"], "platform-invalid minute observation");
    const incidentId = text(observation.incidentId, "Availability incident identity");
    const incidentVersionId = text(observation.incidentVersionId, "Availability incident version");
    const incident = incidents.find(({ event }) => event.incidentId === incidentId && event.incidentVersionId === incidentVersionId) ??
      fail("Platform-invalid minute has no matching platform incident");
    if (!incident.treatment.platformCaused) fail("Platform-invalid minute has no matching platform incident");
    if (observation.affectedScopeId !== affectedScopeId || incident.event.affectedScopeId !== affectedScopeId) {
      fail("Platform-invalid minute affected scope does not match its incident");
    }
    if (observation.incidentPolicyVersionId !== incident.treatment.incidentPolicyVersionId) {
      fail("Platform-invalid minute incident policy version does not match");
    }
    const incidentStart = Date.parse(String(incident.event.startedAt));
    const incidentEnd = Object.hasOwn(incident.event, "endedAt") ? Date.parse(String(incident.event.endedAt)) : Date.parse(endsAt);
    if (Date.parse(minute) < incidentStart || Date.parse(minute) >= incidentEnd) fail("Platform-invalid minute is outside its incident interval");
    unavailableMinuteCount += 1;
    platformInvalidMinuteCount += 1;
  }
  const observedMinuteCount = seen.size;
  if (observedMinuteCount > expectedMinutes) fail("Availability evidence exceeds its minute window");
  const missingMinuteCount = expectedMinutes - observedMinuteCount;
  const availabilityRate = availableMinuteCount / expectedMinutes;
  const targetMet = missingMinuteCount === 0 && availabilityRate >= 0.99;
  const status = missingMinuteCount > 0 ? "INDETERMINATE" as const : targetMet ? "PASS" as const : "FAIL" as const;
  return Object.freeze({ status, targetMet, availabilityEvidenceVersionId: text(raw.availabilityEvidenceVersionId, "Availability evidence version"),
    dayCalendarVersionId,
    observationWindowId: text(raw.observationWindowId, "Availability observation window"), observedMinuteCount,
    availableMinuteCount, unavailableMinuteCount, missingMinuteCount, platformInvalidMinuteCount, availabilityRate });
};

export const evaluateStreakProtection = (value: unknown, authorityInput: unknown) => {
  requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const raw = asRecord(value, "streak protection input");
  exact(raw, ["betaDay", "affectedScopeId", "dayCalendarVersionId", "incidentPolicyVersionId", "completionRecorded", "incident"], "streak protection input");
  if (typeof raw.completionRecorded !== "boolean") fail("Completion-recorded state must be boolean");
  const betaDay = utcDate(raw.betaDay, "Streak beta day");
  const incident = parseRecordedIncident(raw.incident, authorityInput);
  const affectedScopeId = text(raw.affectedScopeId, "Streak affected scope");
  if (incident.event.affectedScopeId !== affectedScopeId) fail("Streak affected scope does not match the incident");
  if (raw.dayCalendarVersionId !== incident.treatment.dayCalendarVersionId) fail("Streak day-calendar version does not match incident policy");
  if (raw.incidentPolicyVersionId !== incident.treatment.incidentPolicyVersionId) fail("Streak incident policy version does not match");
  const dayStart = Date.parse(`${betaDay}T00:00:00.000Z`);
  const dayEnd = dayStart + 86_400_000;
  const incidentStart = Date.parse(String(incident.event.startedAt));
  const incidentEnd = Object.hasOwn(incident.event, "endedAt") ? Date.parse(String(incident.event.endedAt)) : Number.POSITIVE_INFINITY;
  const affectsDay = incidentStart < dayEnd && incidentEnd > dayStart;
  const protectedValue = affectsDay && incident.treatment.platformCaused && incident.event.streakTreatment === "PRESERVE";
  return Object.freeze({ streakTreatment: protectedValue ? "PRESERVE" as const : "UNCHANGED" as const,
    protected: protectedValue, completionRecorded: raw.completionRecorded, completionFactCreated: false as const });
};

const denial = (reason: string) => Object.freeze({ allowed: false as const, reason });

export const executeFreshDelivery = (value: unknown, servicesInput: unknown) => {
  const services = asRecord(servicesInput, "fresh delivery services");
  const clock = asRecord(services.clock, "authoritative freshness clock");
  const verifier = asRecord(services.freshness, "freshness verifier");
  const delivery = asRecord(services.delivery, "protected delivery port");
  if (typeof clock.now !== "function" || typeof verifier.verify !== "function" ||
    typeof delivery.issueManifest !== "function" || typeof delivery.authorizeReveal !== "function") fail("Fresh delivery services are invalid");
  assertDeepFrozen(value);
  const raw = asRecord(value, "fresh delivery input");
  exact(raw, ["action", "scopeId", "expectedControlVersionId", "applicableVersionId", "freshnessEvidence"], "fresh delivery input");
  const rawAction = raw.action;
  if (rawAction !== "MANIFEST" && rawAction !== "REVEAL") fail("Fresh delivery action is invalid");
  const action = rawAction as DeliveryAction;
  const scopeId = text(raw.scopeId, "Fresh delivery scope");
  const expectedControlVersionId = text(raw.expectedControlVersionId, "Expected freshness-control version");
  const applicableVersionId = text(raw.applicableVersionId, "Applicable delivery version");
  const evidence = asRecord(raw.freshnessEvidence, "freshness evidence");
  exact(evidence, ["evidenceId", "scopeId", "controlVersionId", "observedAt"], "freshness evidence");
  const normalizedEvidence = Object.freeze({ evidenceId: text(evidence.evidenceId, "Freshness evidence identity"),
    scopeId: text(evidence.scopeId, "Freshness evidence scope"), controlVersionId: text(evidence.controlVersionId, "Freshness control version"),
    observedAt: canonicalInstant(evidence.observedAt, "Freshness observation time") });
  if (normalizedEvidence.scopeId !== scopeId) return denial("SCOPE_MISMATCH");
  if (normalizedEvidence.controlVersionId !== expectedControlVersionId) return denial("VERSION_MISMATCH");
  let verified = false;
  try { verified = (verifier.verify as (claim: Readonly<Record<string, unknown>>) => boolean)(
    Object.freeze({ action, applicableVersionId, ...normalizedEvidence })); }
  catch { verified = false; }
  if (!verified) return denial("UNVERIFIED_EVIDENCE");
  const now = canonicalInstant((clock.now as () => unknown)(), "Authoritative freshness time");
  const freshnessAgeMilliseconds = Date.parse(now) - Date.parse(normalizedEvidence.observedAt);
  if (freshnessAgeMilliseconds < 0) return denial("FUTURE_EVIDENCE");
  if (freshnessAgeMilliseconds > 300_000) return denial("STALE_CONTROL");
  if (action === "MANIFEST") (delivery.issueManifest as (claim: Readonly<Record<string, unknown>>) => void)(
    Object.freeze({ scopeId, applicableVersionId }));
  else (delivery.authorizeReveal as (claim: Readonly<Record<string, unknown>>) => void)(Object.freeze({ scopeId, applicableVersionId }));
  return Object.freeze({ allowed: true as const, action, scopeId, controlVersionId: expectedControlVersionId,
    applicableVersionId, freshnessAgeMilliseconds });
};

const purgeFailure = () => Object.freeze({ status: "FAIL" as const, purgedWithinFiveMinutes: false as const });

export const evaluateCachePurge = (value: unknown, servicesInput: unknown) => {
  const services = asRecord(servicesInput, "cache-purge services");
  const clock = asRecord(services.clock, "authoritative purge clock");
  const verifier = asRecord(services.purgeEvidence, "cache-purge evidence verifier");
  const quarantineVerifier = asRecord(services.quarantine, "quarantine attestation verifier");
  if (typeof clock.now !== "function" || typeof verifier.verify !== "function" ||
    typeof quarantineVerifier.trustDomainId !== "string" || quarantineVerifier.trustDomainId.trim().length === 0 ||
    typeof quarantineVerifier.verify !== "function") fail("Cache-purge services are invalid");
  assertDeepFrozen(value);
  const raw = asRecord(value, "cache-purge input");
  exact(raw, ["quarantine", "affectedScopeId", "correctionVersionId", "quarantineAttestation", "purgeEvidence"], "cache-purge input");
  const quarantine = asRecord(raw.quarantine, "quarantine result");
  exact(quarantine, ["affectedRoundId", "affectedManifestVersionId", "contentBlocked", "revealBlocked",
    "affectedManifestEligibleForNewIssuance", "currentManifestForUnissuedParticipants", "existingCredential",
    "cachePurgeDeadline", "cachePurgedWithinDeadline", "displayedContentTreatment", "publishedNotice"], "quarantine result");
  const quarantineAttestationRaw = asRecord(raw.quarantineAttestation, "quarantine attestation");
  exact(quarantineAttestationRaw, ["attestationId", "authorityDomainId", "payloadDigest", "signatureId"], "quarantine attestation");
  const quarantineAttestation = Object.freeze({
    attestationId: text(quarantineAttestationRaw.attestationId, "Quarantine attestation identity"),
    authorityDomainId: text(quarantineAttestationRaw.authorityDomainId, "Quarantine attestation authority domain"),
    payloadDigest: text(quarantineAttestationRaw.payloadDigest, "Quarantine attestation payload digest"),
    signatureId: text(quarantineAttestationRaw.signatureId, "Quarantine attestation signature"),
  });
  if (quarantineAttestation.authorityDomainId !== quarantineVerifier.trustDomainId ||
    quarantineAttestation.payloadDigest !== canonicalJson(quarantine)) return purgeFailure();
  let quarantineVerified = false;
  try { quarantineVerified = (quarantineVerifier.verify as (claim: Readonly<Record<string, unknown>>) => boolean)(quarantineAttestation); }
  catch { quarantineVerified = false; }
  if (!quarantineVerified) return purgeFailure();
  if (quarantine.contentBlocked !== true || quarantine.revealBlocked !== true ||
    quarantine.affectedManifestEligibleForNewIssuance !== false || quarantine.cachePurgedWithinDeadline !== true) {
    return purgeFailure();
  }
  const existingCredential = asRecord(quarantine.existingCredential, "quarantine credential scope");
  exact(existingCredential, ["revoked", "allowedTransitions"], "quarantine credential scope");
  if (existingCredential.revoked !== false || !Array.isArray(existingCredential.allowedTransitions) ||
    canonicalJson(existingCredential.allowedTransitions) !== canonicalJson(["CORRECTION_NOTICE", "UNAFFECTED_ROUND", "UNAFFECTED_REVEAL"])) {
    fail("Round quarantine cannot automatically revoke or broaden credentials");
  }
  const notice = asRecord(quarantine.publishedNotice, "quarantine notice");
  exact(notice, ["kind", "text"], "quarantine notice");
  if ((notice.kind !== "VOID" || notice.text !== "Round voided") &&
    (notice.kind !== "CONTENT_WITHDRAWN" || notice.text !== "Content unavailable")) fail("Quarantine notice is invalid");
  if (quarantine.displayedContentTreatment !== "ALREADY_DISPLAYED_NOT_RECALLABLE" &&
    quarantine.displayedContentTreatment !== "NOT_PREVIOUSLY_DISPLAYED") fail("Displayed-content treatment is invalid");
  const affectedScopeId = text(raw.affectedScopeId, "Purge affected scope");
  const affectedManifestVersionId = text(quarantine.affectedManifestVersionId, "Affected manifest version");
  const correctionVersionId = text(raw.correctionVersionId, "Correction version");
  const deadline = canonicalInstant(quarantine.cachePurgeDeadline, "Cache-purge deadline");
  const evidence = asRecord(raw.purgeEvidence, "cache-purge evidence");
  exact(evidence, ["evidenceId", "affectedScopeId", "affectedManifestVersionId", "correctionVersionId", "purgedAt"], "cache-purge evidence");
  const normalizedEvidence = Object.freeze({ evidenceId: text(evidence.evidenceId, "Purge evidence identity"),
    affectedScopeId: text(evidence.affectedScopeId, "Purge evidence scope"),
    affectedManifestVersionId: text(evidence.affectedManifestVersionId, "Purge evidence manifest version"),
    correctionVersionId: text(evidence.correctionVersionId, "Purge evidence correction version"),
    purgedAt: canonicalInstant(evidence.purgedAt, "Purge completion time") });
  if (affectedScopeId !== quarantine.affectedRoundId || normalizedEvidence.affectedScopeId !== affectedScopeId ||
    normalizedEvidence.affectedManifestVersionId !== affectedManifestVersionId ||
    normalizedEvidence.correctionVersionId !== correctionVersionId) return purgeFailure();
  let verified = false;
  try { verified = (verifier.verify as (claim: Readonly<Record<string, unknown>>) => boolean)(
    Object.freeze({ ...normalizedEvidence, cachePurgeDeadline: deadline })); }
  catch { verified = false; }
  if (!verified) return purgeFailure();
  const now = canonicalInstant((clock.now as () => unknown)(), "Authoritative purge time");
  const purgedAt = Date.parse(normalizedEvidence.purgedAt);
  if (purgedAt > Date.parse(now) || purgedAt > Date.parse(deadline) || purgedAt < Date.parse(deadline) - 300_000) {
    return purgeFailure();
  }
  return Object.freeze({ status: "PASS" as const, purgedWithinFiveMinutes: true as const, affectedManifestVersionId,
    correctionVersionId, displayedContentTreatment: quarantine.displayedContentTreatment, recallClaim: "NOT_MADE" as const });
};
