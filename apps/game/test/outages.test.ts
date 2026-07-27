import { describe, expect, it } from "vitest";
import {
  createIncidentPolicy,
  evaluateAvailability,
  evaluateStreakProtection,
  recordOperationalIncident,
} from "../src/server/operations/incidents/index.js";

type RecordValue = Record<string, unknown>;
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};
const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, canonical(nested)]));
};
const digest = (value: unknown): string => JSON.stringify(canonical(value));
const POLICY_DOMAIN = "synthetic-incident-authority-domain-v1";
const signedIncidentClaim = (claim: Readonly<Record<string, unknown>>) => {
  const unsigned = { ...claim }; delete unsigned.signatureId;
  return `synthetic-incident-signature:${digest(unsigned)}`;
};
const authority = Object.freeze({ trustDomainId: POLICY_DOMAIN,
  verifyPolicy: (claim: Readonly<Record<string, unknown>>) => claim.authorityDomainId === POLICY_DOMAIN &&
    typeof claim.payloadDigest === "string" && claim.signatureId === `synthetic-policy-signature:${claim.payloadDigest}`,
  verifyIncident: (claim: Readonly<Record<string, unknown>>) => claim.authorityDomainId === POLICY_DOMAIN &&
    claim.signerRole === "RELEASE_OPERATOR" && claim.signatureId === signedIncidentClaim(claim) });
const policySource = () => {
  const unsigned = { authorityDomainId: POLICY_DOMAIN, incidentPolicyVersionId: "synthetic-incident-policy-v1",
    dayCalendarVersionId: "active-day-calendar-v1", rules: [
      { ruleId: "platform-major", severity: "MAJOR", platformCaused: true,
        exclusionTreatment: "PLATFORM_INVALID_PERIOD", streakTreatment: "PRESERVE" },
      { ruleId: "participant-minor", severity: "MINOR", platformCaused: false,
        exclusionTreatment: "NONE", streakTreatment: "UNCHANGED" },
    ], signedBy: "Don", signedAt: "2026-07-31T12:00:00.000Z" };
  return deepFreeze({ ...unsigned, signatureId: `synthetic-policy-signature:${digest(unsigned)}` });
};
const incident = (ruleId = "platform-major", overrides: RecordValue = {}) => {
  const policy = createIncidentPolicy(policySource(), authority);
  const explicitAttestation = overrides.attestation;
  const eventOverrides = { ...overrides }; delete eventOverrides.attestation;
  const source = { policy, eventId: `event-${ruleId}`, schemaVersionId: "authoritative-events-v1",
    acceptedAt: "2026-08-03T01:40:01.000Z", incidentId: `incident-${ruleId}`, incidentVersionId: `incident-${ruleId}-v1`,
    ruleId, startedAt: "2026-08-03T00:00:00.000Z", endedAt: "2026-08-03T01:40:00.000Z",
    affectedScopeId: "active-beta-service", decisionOwnerId: "release-owner-1", ...eventOverrides };
  const rule = policy.rules.find((entry) => entry.ruleId === source.ruleId) ?? policy.rules[0]!;
  const event = { eventId: source.eventId, eventFamilyId: "OPERATIONAL_INCIDENT_OR_OUTAGE",
    schemaVersionId: source.schemaVersionId, acceptedAt: source.acceptedAt, incidentId: source.incidentId,
    incidentVersionId: source.incidentVersionId, startedAt: source.startedAt, endedAt: source.endedAt,
    severity: rule.severity, affectedScopeId: source.affectedScopeId, exclusionTreatment: rule.exclusionTreatment,
    streakTreatment: rule.streakTreatment, decisionOwnerId: source.decisionOwnerId };
  const unsignedAttestation = { attestationId: `synthetic-attestation-${ruleId}`, authorityDomainId: POLICY_DOMAIN,
    signedBy: source.decisionOwnerId, signerRole: "RELEASE_OPERATOR", signedAt: source.acceptedAt, payloadDigest: digest(event) };
  const attestation = explicitAttestation ?? { ...unsignedAttestation, signatureId: signedIncidentClaim(unsignedAttestation) };
  return recordOperationalIncident(deepFreeze({ ...source, attestation }), authority);
};
const minutes = (available: number, total = 100): readonly RecordValue[] => Array.from({ length: total }, (_, index) => {
  const minute = new Date(Date.parse("2026-08-03T00:00:00.000Z") + index * 60_000).toISOString();
  return index < available ? { minute, status: "AVAILABLE" } : { minute, status: "PLATFORM_INVALID",
    incidentId: "incident-platform-major", incidentVersionId: "incident-platform-major-v1",
    incidentPolicyVersionId: "synthetic-incident-policy-v1", affectedScopeId: "active-beta-service" };
});
const evidence = (observations: readonly RecordValue[], incidents: readonly unknown[] = [incident()], overrides: RecordValue = {}) => deepFreeze({
  availabilityEvidenceVersionId: "synthetic-availability-evidence-v1", dayCalendarVersionId: "active-day-calendar-v1",
  observationWindowId: "active-beta-window-1", affectedScopeId: "active-beta-service", startsAt: "2026-08-03T00:00:00.000Z",
  endsAt: "2026-08-03T01:40:00.000Z", minuteObservations: observations, incidents, ...overrides,
});

describe("per-minute outage evidence and streak treatment", () => {
  it("counts platform-invalid minutes as unavailable and meets the target at exactly 99 percent", () => {
    const result = evaluateAvailability(evidence(minutes(99)), authority);
    expect(result).toEqual({ status: "PASS", targetMet: true, availabilityEvidenceVersionId: "synthetic-availability-evidence-v1",
      dayCalendarVersionId: "active-day-calendar-v1", observationWindowId: "active-beta-window-1",
      observedMinuteCount: 100, availableMinuteCount: 99, unavailableMinuteCount: 1, missingMinuteCount: 0,
      platformInvalidMinuteCount: 1, availabilityRate: 0.99 });
    expect(recursivelyFrozen(result)).toBe(true);
    expect(evaluateAvailability(evidence(minutes(98)), authority)).toMatchObject({ status: "FAIL", targetMet: false, availabilityRate: 0.98 });
  });

  it("keeps insufficient evidence distinct from a measured miss and rejects duplicate/noncanonical buckets", () => {
    expect(evaluateAvailability(evidence(minutes(99, 99)), authority)).toMatchObject({
      status: "INDETERMINATE", targetMet: false, observedMinuteCount: 99, missingMinuteCount: 1,
    });
    const duplicate = [...minutes(99, 99), minutes(99, 99)[0]!];
    expect(() => evaluateAvailability(evidence(duplicate), authority)).toThrow(/duplicate|minute/i);
    expect(() => evaluateAvailability(evidence([{ minute: "2026-08-03T01:00:00+01:00", status: "AVAILABLE" }]), authority))
      .toThrow(/UTC|canonical|minute/i);
    const base = minutes(99);
    const invalid = base[99] as RecordValue;
    expect(() => evaluateAvailability(evidence([...base.slice(0, 99), { ...invalid, affectedScopeId: "other-scope" }]), authority))
      .toThrow(/scope/i);
    expect(() => evaluateAvailability(evidence([...base.slice(0, 99), { ...invalid,
      incidentPolicyVersionId: "other-policy" }]), authority)).toThrow(/policy|version/i);
    expect(() => evaluateAvailability(evidence(base, [incident("platform-major", {
      endedAt: "2026-08-03T00:02:00.000Z", acceptedAt: "2026-08-03T00:02:01.000Z",
    })]), authority)).toThrow(/interval|incident|minute/i);
    expect(() => evaluateAvailability(evidence(base, [incident()], { dayCalendarVersionId: "other-calendar" }), authority))
      .toThrow(/calendar|version/i);
    const platform = incident() as unknown as RecordValue;
    const structuralForgery = deepFreeze({ event: platform.event, treatment: platform.treatment });
    expect(() => evaluateAvailability(evidence(base, [structuralForgery]), authority)).toThrow(/policy|signature|authority|recorded/i);
  });

  it("protects streaks only for exact version-bound platform incidents without inventing completion", () => {
    const platform = incident();
    expect(evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "active-beta-service",
      dayCalendarVersionId: "active-day-calendar-v1",
      incidentPolicyVersionId: "synthetic-incident-policy-v1", completionRecorded: false, incident: platform }), authority))
      .toEqual({ streakTreatment: "PRESERVE", protected: true, completionRecorded: false, completionFactCreated: false });
    const participant = incident("participant-minor");
    expect(evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "active-beta-service",
      dayCalendarVersionId: "active-day-calendar-v1",
      incidentPolicyVersionId: "synthetic-incident-policy-v1", completionRecorded: false, incident: participant }), authority))
      .toMatchObject({ streakTreatment: "UNCHANGED", protected: false, completionFactCreated: false });
    expect(() => evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "active-beta-service",
      dayCalendarVersionId: "other-calendar",
      incidentPolicyVersionId: "synthetic-incident-policy-v1", completionRecorded: true, incident: platform }), authority)).toThrow(/calendar|version/i);
    expect(() => evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "active-beta-service",
      dayCalendarVersionId: "active-day-calendar-v1",
      incidentPolicyVersionId: "other-policy", completionRecorded: true, incident: platform }), authority)).toThrow(/policy|version/i);
    const structuralForgery = deepFreeze({ event: (platform as unknown as RecordValue).event,
      treatment: (platform as unknown as RecordValue).treatment });
    expect(() => evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "active-beta-service",
      dayCalendarVersionId: "active-day-calendar-v1",
      incidentPolicyVersionId: "synthetic-incident-policy-v1", completionRecorded: false, incident: structuralForgery }), authority))
      .toThrow(/policy|signature|authority|recorded/i);
    expect(() => evaluateStreakProtection(deepFreeze({ betaDay: "2026-08-03", affectedScopeId: "unrelated-service",
      dayCalendarVersionId: "active-day-calendar-v1", incidentPolicyVersionId: "synthetic-incident-policy-v1",
      completionRecorded: false, incident: platform }), authority)).toThrow(/scope/i);
  });
});
