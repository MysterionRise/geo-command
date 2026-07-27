import { describe, expect, it } from "vitest";
import { COMPLAINT_RUBRIC, ComplaintCase } from "../src/server/content/corrections/corrections.js";
import {
  createIncidentPolicy,
  recordOperationalIncident,
} from "../src/server/operations/incidents/index.js";
import { parseAuthoritativeEvent } from "../../../packages/measurement/src/events/index.js";

type RecordValue = Record<string, unknown>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true
  : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);

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

const authority = Object.freeze({
  trustDomainId: POLICY_DOMAIN,
  verifyPolicy: (claim: Readonly<Record<string, unknown>>) => claim.signerName === "Don" &&
    claim.signerRole === "DON" && claim.authorityDomainId === POLICY_DOMAIN && typeof claim.payloadDigest === "string" &&
    claim.signatureId === `synthetic-policy-signature:${claim.payloadDigest}`,
  verifyIncident: (claim: Readonly<Record<string, unknown>>) => claim.authorityDomainId === POLICY_DOMAIN &&
    claim.signerRole === "RELEASE_OPERATOR" && claim.signatureId === signedIncidentClaim(claim),
});

const policySource = (overrides: RecordValue = {}) => {
  const explicitSignature = overrides.signatureId;
  const unsignedOverrides = { ...overrides }; delete unsignedOverrides.signatureId;
  const unsigned = { authorityDomainId: POLICY_DOMAIN, incidentPolicyVersionId: "synthetic-incident-policy-v1",
    dayCalendarVersionId: "active-day-calendar-v1",
    rules: [
      { ruleId: "platform-major", severity: "MAJOR", platformCaused: true,
        exclusionTreatment: "PLATFORM_INVALID_PERIOD", streakTreatment: "PRESERVE" },
      { ruleId: "participant-minor", severity: "MINOR", platformCaused: false,
        exclusionTreatment: "NONE", streakTreatment: "UNCHANGED" },
    ], signedBy: "Don", signedAt: "2026-07-31T12:00:00.000Z", ...unsignedOverrides };
  return deepFreeze({ ...unsigned, signatureId: explicitSignature ?? `synthetic-policy-signature:${digest(unsigned)}` });
};

const incidentSource = (policy: unknown, overrides: RecordValue = {}) => {
  const explicitAttestation = overrides.attestation;
  const eventOverrides = { ...overrides }; delete eventOverrides.attestation;
  const source = { policy, eventId: "event-operational-incident-1", schemaVersionId: "authoritative-events-v1",
    acceptedAt: "2026-08-03T13:00:01.000Z", incidentId: "incident-1", incidentVersionId: "incident-1-v1",
    ruleId: "platform-major", startedAt: "2026-08-03T13:00:00.000Z", endedAt: "2026-08-03T13:01:00.000Z",
    affectedScopeId: "manifest-service", decisionOwnerId: "release-owner-1", ...eventOverrides };
  const rules = (policy as RecordValue).rules as readonly RecordValue[];
  const rule = rules.find((entry) => entry.ruleId === source.ruleId) ?? rules[0]!;
  const event = { eventId: source.eventId, eventFamilyId: "OPERATIONAL_INCIDENT_OR_OUTAGE",
    schemaVersionId: source.schemaVersionId, acceptedAt: source.acceptedAt, incidentId: source.incidentId,
    incidentVersionId: source.incidentVersionId, startedAt: source.startedAt, endedAt: source.endedAt,
    severity: rule.severity, affectedScopeId: source.affectedScopeId, exclusionTreatment: rule.exclusionTreatment,
    streakTreatment: rule.streakTreatment, decisionOwnerId: source.decisionOwnerId };
  const unsignedAttestation = { attestationId: "synthetic-incident-attestation-1", authorityDomainId: POLICY_DOMAIN,
    signedBy: source.decisionOwnerId, signerRole: "RELEASE_OPERATOR", signedAt: source.acceptedAt, payloadDigest: digest(event) };
  const attestation = explicitAttestation ?? { ...unsignedAttestation, signatureId: signedIncidentClaim(unsignedAttestation) };
  return deepFreeze({ ...source, attestation });
};

describe("versioned operational incident policy and event", () => {
  it("emits the exact authoritative incident event and detached policy treatment", () => {
    const policyInput = policySource();
    const policy = createIncidentPolicy(policyInput, authority);
    const recorded = recordOperationalIncident(incidentSource(policy), authority);
    expect(recorded).toEqual({
      policy: policySource(),
      attestation: (incidentSource(policy) as RecordValue).attestation,
      event: {
        eventId: "event-operational-incident-1", eventFamilyId: "OPERATIONAL_INCIDENT_OR_OUTAGE",
        schemaVersionId: "authoritative-events-v1", acceptedAt: "2026-08-03T13:00:01.000Z",
        incidentId: "incident-1", incidentVersionId: "incident-1-v1", startedAt: "2026-08-03T13:00:00.000Z",
        endedAt: "2026-08-03T13:01:00.000Z", severity: "MAJOR", affectedScopeId: "manifest-service",
        exclusionTreatment: "PLATFORM_INVALID_PERIOD", streakTreatment: "PRESERVE", decisionOwnerId: "release-owner-1",
      },
      treatment: { incidentPolicyVersionId: "synthetic-incident-policy-v1", dayCalendarVersionId: "active-day-calendar-v1",
        ruleId: "platform-major", platformCaused: true },
    });
    expect(parseAuthoritativeEvent(recorded.event)).toEqual(recorded.event);
    expect(recursivelyFrozen(recorded)).toBe(true);
    expect(recorded.event).not.toHaveProperty("provider");
    expect(recorded.event).not.toHaveProperty("code");
    expect(recorded.event).not.toHaveProperty("description");
    expect(recorded.event).not.toHaveProperty("participantLineageId");
    expect(recorded.event).not.toHaveProperty("manifestVersionId");
    expect(recorded).not.toBe(policyInput);
  });

  it("keeps complaint severity separate and reuses the frozen complaint rubric", () => {
    expect(COMPLAINT_RUBRIC.CRITICAL).toMatchObject({ acknowledgementHours: 48, quarantineHours: 4, decisionDays: 7 });
    expect(COMPLAINT_RUBRIC.HIGH).toMatchObject({ acknowledgementHours: 48, quarantineHours: 24, decisionDays: 7 });
    expect(COMPLAINT_RUBRIC.MEDIUM).toMatchObject({ quarantineHours: null, decisionDays: 14 });
    expect(COMPLAINT_RUBRIC.LOW).toMatchObject({ quarantineHours: null, decisionDays: 14 });
    const medium = ComplaintCase.open({ caseId: "case-medium", contentId: "content-1", roundId: "round-1",
      manifestVersionId: "manifest-v1", severity: "MEDIUM", credible: true, receivedAt: "2026-08-03T10:00:00.000Z",
      evidenceRefs: ["evidence-1"], originalContentEditorId: "editor-1", originalRightsSafetyReviewerId: "rights-1" });
    expect(() => medium.quarantine({ quarantinedAt: "2026-08-03T11:00:00.000Z", correctionStatus: "VOID", alreadyDisplayed: false }))
      .toThrow(/critical|high|quarantine/i);
  });

  it("rejects forged, mutable, malformed, duplicate and semantically drifting policy or incident inputs", () => {
    expect(() => createIncidentPolicy({ ...policySource() }, authority)).toThrow(/frozen|immutable/i);
    expect(() => createIncidentPolicy(policySource({ signatureId: "plausible-forgery" }), authority)).toThrow(/signature|authority|verify/i);
    const signed = policySource();
    expect(() => createIncidentPolicy(deepFreeze({ ...signed, rules: [
      { ...(signed.rules as readonly RecordValue[])[0]!, severity: "CRITICAL" },
      (signed.rules as readonly RecordValue[])[1],
    ] }), authority)).toThrow(/signature|authority|verify/i);
    expect(() => createIncidentPolicy(policySource({ rules: [
      (policySource().rules as readonly unknown[])[0], (policySource().rules as readonly unknown[])[0],
    ] }), authority)).toThrow(/duplicate|rule/i);
    const policy = createIncidentPolicy(policySource(), authority);
    const signedIncident = incidentSource(policy);
    for (const changed of [
      { ...signedIncident, extra: true },
      { ...incidentSource(policy), acceptedAt: "2026-08-03T14:00:01+01:00" },
      { ...incidentSource(policy), endedAt: "2026-08-03T12:59:59.999Z" },
      { ...incidentSource(policy), ruleId: "unconfigured-rule" },
      { ...incidentSource(policy), schemaVersionId: "future-schema" },
      { ...signedIncident, affectedScopeId: "forged-other-scope" },
      { ...signedIncident, incidentVersionId: "forged-incident-version" },
    ]) expect(() => recordOperationalIncident(deepFreeze(changed), authority)).toThrow();
    const rejectingIncidentAuthority = Object.freeze({ ...authority, verifyIncident: () => false });
    expect(() => recordOperationalIncident(signedIncident, rejectingIncidentAuthority)).toThrow(/incident|attestation|authority|signature/i);
    const originalAttestation = signedIncident.attestation as RecordValue;
    const foreignUnsignedAttestation: RecordValue = { ...originalAttestation, authorityDomainId: "foreign-incident-domain" };
    delete foreignUnsignedAttestation.signatureId;
    const foreignAttestation = { ...foreignUnsignedAttestation, signatureId: signedIncidentClaim(foreignUnsignedAttestation) };
    const permissiveIncidentAuthority = Object.freeze({ ...authority, verifyIncident: () => true });
    expect(() => recordOperationalIncident(deepFreeze({ ...signedIncident, attestation: foreignAttestation }), permissiveIncidentAuthority))
      .toThrow(/domain|incident|attestation/i);
    const crossDomain = Object.freeze({ ...authority, trustDomainId: "other-authority-domain",
      verifyPolicy: () => true, verifyIncident: () => true });
    expect(() => createIncidentPolicy(policySource(), crossDomain)).toThrow(/domain|authority|signature/i);
  });
});
