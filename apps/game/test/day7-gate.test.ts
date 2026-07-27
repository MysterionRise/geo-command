import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as releaseOperations from "../src/server/operations/release/index.js";
import {
  authorizeDay8 as authorizeDay8WithServices,
  evaluateDay7Gate as evaluateDay7GateWithAuthority,
} from "../src/server/operations/release/day7-gate.js";
import {
  createUtcBetaLifecycle as createUtcBetaLifecycleWithAuthority,
  evaluateReleaseWindow as evaluateReleaseWindowWithAuthority,
} from "../src/server/operations/release/utc-lifecycle.js";

type RecordValue = Record<string, unknown>;
type Outcome = "PASS" | "FAIL" | "INDETERMINATE";
type Recommendation = "OPEN" | "DO_NOT_OPEN" | "PAUSE";

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true
  : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);

const TEST_AUTHORITY_SECRET = "test-only-release-authority-secret";
const TEST_AUDIT_SECRET = "test-only-release-audit-integrity-secret";
const TEST_TRUST_DOMAIN = Object.freeze({ id: "test-release-trust-domain" });

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, canonicalValue(nested)]));
};

const digest = (value: unknown): string => JSON.stringify(canonicalValue(value));

const signatureFor = (purpose: string, signerName: string, signerRole: string, signedAt: string, payloadDigest: string): string =>
  createHmac("sha256", TEST_AUTHORITY_SECRET)
    .update([purpose, signerName, signerRole, signedAt, payloadDigest].join("\n"))
    .digest("hex");

const auditSealFor = (payloadDigest: string): string => createHmac("sha256", TEST_AUDIT_SECRET)
  .update(payloadDigest)
  .digest("hex");

const auditIntegrity = Object.freeze({
  seal: (payloadDigest: string) => auditSealFor(payloadDigest),
  verify: (payloadDigest: string, seal: string) => seal === auditSealFor(payloadDigest),
});

const unsigned = (value: Readonly<Record<string, unknown>>): RecordValue => {
  const copy = { ...value };
  delete copy.signatureId;
  return copy;
};

const normalizedApprovalPayload = (value: Readonly<Record<string, unknown>>, purpose: string): RecordValue => {
  const payload = unsigned(value);
  if (purpose === "DAY7_GATE_CONFIGURATION" && Array.isArray(payload.criteria)) {
    payload.criteria = [...payload.criteria].sort((left, right) =>
      String((left as RecordValue).criterionId).localeCompare(String((right as RecordValue).criterionId)));
  }
  if (purpose === "DAY7_REPORT") {
    if (Array.isArray(payload.observations)) payload.observations = payload.observations.map((entry) => {
      const observation = { ...(entry as RecordValue) };
      if (Array.isArray(observation.rawNumerators)) observation.rawNumerators = [...observation.rawNumerators].sort((left, right) =>
        String((left as RecordValue).key).localeCompare(String((right as RecordValue).key)));
      if (Array.isArray(observation.excludedByReason)) observation.excludedByReason = [...observation.excludedByReason].sort((left, right) =>
        String((left as RecordValue).reasonClass).localeCompare(String((right as RecordValue).reasonClass)));
      return observation;
    }).sort((left, right) => String((left as RecordValue).criterionId).localeCompare(String((right as RecordValue).criterionId)));
    if (Array.isArray(payload.criterionOutcomes)) payload.criterionOutcomes = [...payload.criterionOutcomes].sort((left, right) =>
      String((left as RecordValue).criterionId).localeCompare(String((right as RecordValue).criterionId)));
    if (Array.isArray(payload.incidentTreatmentReferenceIds)) payload.incidentTreatmentReferenceIds = [...payload.incidentTreatmentReferenceIds].sort();
  }
  return payload;
};

const sign = (value: RecordValue, purpose: string, signerRole: string, explicitSignature: boolean): RecordValue => {
  if (!explicitSignature) value.signatureId = signatureFor(
    purpose, String(value.signedBy), signerRole, String(value.signedAt), digest(normalizedApprovalPayload(value, purpose)),
  );
  return value;
};

const authorityFor = (authenticatedOperator = "Release Operator") => Object.freeze({
  trustDomain: TEST_TRUST_DOMAIN,
  verifyApproval: (claim: Readonly<Record<string, unknown>>): boolean =>
    typeof claim.purpose === "string" && typeof claim.signerName === "string" && typeof claim.signerRole === "string" &&
    typeof claim.signedAt === "string" && typeof claim.signatureId === "string" && typeof claim.payloadDigest === "string" &&
    claim.signatureId === signatureFor(claim.purpose, claim.signerName, claim.signerRole, claim.signedAt, claim.payloadDigest),
  isAuthenticatedOperator: (claim: Readonly<Record<string, unknown>>): boolean =>
    claim.name === authenticatedOperator && claim.role === "RELEASE_OPERATOR",
});

class SerializedAuthorizationStore {
  private serialized: string | null = null;
  public commits = 0;

  public constructor(initial: unknown | null = null) {
    this.serialized = initial === null ? null : JSON.stringify(initial);
  }

  public transact(_scopeKey: string, transition: (prior: unknown | null) => unknown): unknown {
    const prior = this.serialized === null ? null : deepFreeze(JSON.parse(this.serialized) as unknown);
    const next = transition(prior);
    this.serialized = JSON.stringify(next);
    this.commits += 1;
    return deepFreeze(JSON.parse(this.serialized) as unknown);
  }

  public snapshot(): unknown | null {
    return this.serialized === null ? null : deepFreeze(JSON.parse(this.serialized) as unknown);
  }

  public raw(): string | null {
    return this.serialized;
  }
}

interface AuthorizationOptions {
  readonly store?: SerializedAuthorizationStore;
  readonly now?: string;
  readonly authenticatedOperator?: string;
}

const createUtcBetaLifecycle = (value: unknown) => createUtcBetaLifecycleWithAuthority(value, authorityFor());
const evaluateDay7Gate = (value: unknown) => evaluateDay7GateWithAuthority(value, authorityFor());
const evaluateReleaseWindow = (value: unknown) => evaluateReleaseWindowWithAuthority(value, authorityFor());
const authorizeDay8 = (value: unknown, options: AuthorizationOptions = {}) => authorizeDay8WithServices(value, Object.freeze({
  authority: authorityFor(options.authenticatedOperator),
  auditIntegrity,
  clock: Object.freeze({ now: () => options.now ?? "2026-08-08T12:05:00.000Z" }),
  store: options.store ?? new SerializedAuthorizationStore(),
}));

const lifecycleSource = (overrides: RecordValue = {}) => deepFreeze(sign({
  lifecycleVersionId: "utc-lifecycle-v1",
  dayCalendarVersionId: "active-day-calendar-v1",
  day1StartDate: "2026-08-01",
  activeDayIds: Array.from({ length: 14 }, (_, index) => `active-day-${String(index + 1)}`),
  graceMinutes: 60,
  signedBy: "Don",
  signedAt: "2026-07-31T12:00:00.000Z",
  ...overrides,
}, "UTC_LIFECYCLE", "DON", Object.hasOwn(overrides, "signatureId")));

const lifecycle = (source = lifecycleSource()) => createUtcBetaLifecycle(source);

const criterion = (overrides: RecordValue = {}) => ({
  criterionId: "completion-floor",
  metricId: "MIXED_SESSION_COMPLETION",
  formulaVersionId: "coherence-formulas-v1",
  numeratorKey: "completed",
  valueSource: "RATE",
  comparator: "AT_LEAST",
  threshold: 0.6,
  minimumDenominator: 10,
  minimumResponses: 0,
  maximumMissingCount: 2,
  ...overrides,
});

const mandatoryCriteria = (): readonly RecordValue[] => [
  criterion(),
  criterion({ criterionId: "voluntary-return", metricId: "VOLUNTARY_RETURN", numeratorKey: "returned" }),
  criterion({ criterionId: "transition-continuation", metricId: "TRANSITION_CONTINUATION", numeratorKey: "continued" }),
  criterion({ criterionId: "abandonment-provenance", metricId: "MODE_ABANDONMENT_PROVENANCE", numeratorKey: "abandoned", comparator: "AT_MOST", threshold: 0.5 }),
  criterion({ criterionId: "abandonment-language", metricId: "MODE_ABANDONMENT_LANGUAGE", numeratorKey: "abandoned", comparator: "AT_MOST", threshold: 0.5 }),
  criterion({ criterionId: "clue-use-provenance", metricId: "MODE_CLUE_USE_PROVENANCE", numeratorKey: "atLeastOne", comparator: "AT_MOST", threshold: 0.8 }),
  criterion({ criterionId: "clue-use-language", metricId: "MODE_CLUE_USE_LANGUAGE", numeratorKey: "atLeastOne", comparator: "AT_MOST", threshold: 0.8 }),
  criterion({ criterionId: "response-sufficiency", metricId: "RESPONSE_SUFFICIENCY", numeratorKey: "submitted", minimumResponses: 5 }),
  criterion({ criterionId: "shared-promise-comprehension", metricId: "SHARED_PROMISE_COMPREHENSION", numeratorKey: "understands", minimumResponses: 5 }),
  criterion({
    criterionId: "critical-defect-status", metricId: "CRITICAL_DEFECT_STATUS", numeratorKey: "releaseBlocking",
    valueSource: "RAW_NUMERATOR", comparator: "AT_MOST", threshold: 0, minimumDenominator: 0, maximumMissingCount: 0,
  }),
];

const gateConfiguration = (criteria: readonly RecordValue[] = mandatoryCriteria(), overrides: RecordValue = {}) => deepFreeze(sign({
  gateConfigurationVersionId: "day7-gate-config-v1",
  lifecycleVersionId: "utc-lifecycle-v1",
  dayCalendarVersionId: "active-day-calendar-v1",
  reportTemplateVersionId: "day7-report-template-v1",
  criteria,
  signedBy: "Don",
  signedAt: "2026-07-31T13:00:00.000Z",
  ...overrides,
}, "DAY7_GATE_CONFIGURATION", "DON", Object.hasOwn(overrides, "signatureId")));

const availableObservation = (overrides: RecordValue = {}) => ({
  criterionId: "completion-floor",
  metricId: "MIXED_SESSION_COMPLETION",
  formulaVersionId: "coherence-formulas-v1",
  availability: "AVAILABLE",
  rawNumerators: [{ key: "completed", value: 8 }],
  rawDenominator: 10,
  missingCount: 1,
  excludedByReason: [],
  responseCount: 10,
  ...overrides,
});

const unavailableObservation = (overrides: RecordValue = {}) => ({
  criterionId: "completion-floor",
  metricId: "MIXED_SESSION_COMPLETION",
  formulaVersionId: "coherence-formulas-v1",
  availability: "UNAVAILABLE",
  unavailableReason: "UNRESOLVED_REQUIRED_TREATMENT",
  ...overrides,
});

const observationFor = (entry: RecordValue, overrides: RecordValue = {}): RecordValue => {
  const rawNumerator = entry.valueSource === "RAW_NUMERATOR" ? 0 : entry.comparator === "AT_MOST" ? 2 : 8;
  return availableObservation({
    criterionId: entry.criterionId,
    metricId: entry.metricId,
    formulaVersionId: entry.formulaVersionId,
    rawNumerators: [{ key: entry.numeratorKey, value: rawNumerator }],
    rawDenominator: entry.valueSource === "RAW_NUMERATOR" ? 0 : 10,
    missingCount: 0,
    responseCount: entry.minimumResponses === 0 ? 0 : 10,
    ...overrides,
  });
};

const configurationWith = (criterionId: string, overrides: RecordValue): ReturnType<typeof gateConfiguration> =>
  gateConfiguration(mandatoryCriteria().map((entry) => entry.criterionId === criterionId ? { ...entry, ...overrides } : entry));

const report = (
  observations: readonly RecordValue[],
  criterionOutcomes: readonly Readonly<{ criterionId: string; outcome: Outcome }>[],
  overallOutcome: Outcome,
  recommendation: Recommendation,
  overrides: RecordValue = {},
) => deepFreeze(sign({
  reportId: "day7-report-1",
  reportVersionId: "day7-report-v1",
  reportTemplateVersionId: "day7-report-template-v1",
  gateConfigurationVersionId: "day7-gate-config-v1",
  lifecycleVersionId: "utc-lifecycle-v1",
  dayCalendarVersionId: "active-day-calendar-v1",
  freezeAt: "2026-08-08T01:00:00.000Z",
  observations,
  criterionOutcomes,
  overallOutcome,
  recommendation,
  viewReferenceIds: {
    mode: "views-mode-v1",
    day: "views-day-v1",
    position: "views-position-v1",
    cohort: "views-cohort-v1",
  },
  incidentTreatmentReferenceIds: ["incident-treatment-v1"],
  inventoryReadinessReferenceId: "inventory-readiness-v1",
  missingDataTreatmentReferenceId: "missing-treatment-v1",
  signedBy: "Gate Report Approver",
  signerRole: "GATE_REPORT_APPROVER",
  signedAt: "2026-08-08T02:00:00.000Z",
  ...overrides,
}, "DAY7_REPORT", String(overrides.signerRole ?? "GATE_REPORT_APPROVER"), Object.hasOwn(overrides, "signatureId")));

const passingParts = (configuration: ReturnType<typeof gateConfiguration>) => {
  const criteria = configuration.criteria as readonly RecordValue[];
  return {
    observations: criteria.map((entry) => observationFor(entry)),
    outcomes: criteria.map((entry) => ({ criterionId: String(entry.criterionId), outcome: "PASS" as const })),
  };
};

const passingReport = (configuration: ReturnType<typeof gateConfiguration> = gateConfiguration(), overrides: RecordValue = {}) => {
  const parts = passingParts(configuration);
  return report(parts.observations, parts.outcomes, "PASS", "OPEN", overrides);
};

const reportWithCriterion = (
  configuration: ReturnType<typeof gateConfiguration>,
  criterionId: string,
  replacement: RecordValue | null,
  outcome: Outcome,
  overallOutcome: Outcome = outcome,
  overrides: RecordValue = {},
) => {
  const parts = passingParts(configuration);
  const observations = parts.observations.filter((entry) => entry.criterionId !== criterionId);
  if (replacement !== null) observations.push(replacement);
  const outcomes = parts.outcomes.map((entry) => entry.criterionId === criterionId ? { criterionId, outcome } : entry);
  const recommendation = overallOutcome === "PASS" ? "OPEN" : overallOutcome === "FAIL" ? "DO_NOT_OPEN" : "PAUSE";
  return report(observations, outcomes, overallOutcome, recommendation, overrides);
};

const evaluate = (
  configuration: ReturnType<typeof gateConfiguration>,
  signedReport: ReturnType<typeof report>,
) => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: signedReport }));

const decision = (overrides: RecordValue = {}) => deepFreeze(sign({
  decisionId: "day8-decision-1",
  idempotencyKey: "day8-open-idempotency-1",
  decision: "OPEN",
  reportId: "day7-report-1",
  reportVersionId: "day7-report-v1",
  signedBy: "Don",
  signedAt: "2026-08-08T12:00:00.000Z",
  operator: { name: "Release Operator", role: "RELEASE_OPERATOR" },
  ...overrides,
}, "DAY8_OPEN_DECISION", "DON", Object.hasOwn(overrides, "signatureId")));

const departureRationale = (overrides: RecordValue = {}) => deepFreeze(sign({
  referenceId: "departure-rationale-v1",
  reportId: "day7-report-1",
  signedBy: "Don",
  signedAt: "2026-08-08T11:00:00.000Z",
  ...overrides,
}, "DAY8_DEPARTURE_RATIONALE", "DON", Object.hasOwn(overrides, "signatureId")));

const expectAuthorizationFailsClosed = (input: unknown, store?: SerializedAuthorizationStore): void => {
  let result: ReturnType<typeof authorizeDay8>;
  try {
    result = authorizeDay8(input, store === undefined ? {} : { store });
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return;
  }
  expect(result).toMatchObject({ allowed: false });
};

const expectCorruptStorePreserved = (input: unknown, corruptState: unknown): void => {
  const store = new SerializedAuthorizationStore(corruptState);
  const before = store.raw();
  const beforeCommits = store.commits;
  expect(() => authorizeDay8(input, { store })).toThrow(/audit|corrupt|persist|prior|stored|state/i);
  expect(store.raw()).toBe(before);
  expect(store.commits).toBe(beforeCommits);
};

describe("Day 7 signed gate evaluation", () => {
  it("publishes only the intended release runtime API and no provenance-minting helpers", () => {
    expect(Object.keys(releaseOperations).sort()).toEqual([
      "ReleaseRuleError", "authorizeDay8", "createUtcBetaLifecycle", "evaluateDay7Gate", "evaluateReleaseWindow",
    ]);
  });

  it("reproduces all mandatory coherence views, including non-rate critical-defect evidence", () => {
    const configuration = gateConfiguration();
    const result = evaluate(configuration, passingReport(configuration));
    expect(result).toMatchObject({ reportId: "day7-report-1", reportVersionId: "day7-report-v1",
      freezeAt: "2026-08-08T01:00:00.000Z", overallOutcome: "PASS", recommendation: "OPEN",
      reportSignerName: "Gate Report Approver", reportSignerRole: "GATE_REPORT_APPROVER",
      viewReferenceIds: { mode: "views-mode-v1", day: "views-day-v1", position: "views-position-v1", cohort: "views-cohort-v1" },
      incidentTreatmentReferenceIds: ["incident-treatment-v1"],
      inventoryReadinessReferenceId: "inventory-readiness-v1",
      missingDataTreatmentReferenceId: "missing-treatment-v1",
    });
    expect(result.criterionResults).toHaveLength(10);
    expect(result.criterionResults).toContainEqual(expect.objectContaining({
      criterionId: "completion-floor", outcome: "PASS", calculatedValue: 0.8, excludedCount: 0,
    }));
    expect(result.criterionResults).toContainEqual(expect.objectContaining({
      criterionId: "critical-defect-status", outcome: "PASS", calculatedValue: 0, rawDenominator: 0,
      valueSource: "RAW_NUMERATOR",
    }));
    expect(recursivelyFrozen(result)).toBe(true);
    expect(result).not.toBe(configuration);
  });

  it("requires trusted signatures for the gate configuration and signed report", () => {
    const forgedConfiguration = gateConfiguration(mandatoryCriteria(), { signatureId: "plausible-forged-gate-signature" });
    expect(() => evaluate(forgedConfiguration, passingReport(forgedConfiguration)))
      .toThrow(/authority|signature|approval|verify/i);
    const configuration = gateConfiguration();
    expect(() => evaluate(configuration, passingReport(configuration, { signatureId: "plausible-forged-report-signature" })))
      .toThrow(/authority|signature|approval|verify/i);
  });

  it.each([
    ["AT_LEAST met", "AT_LEAST", 0.8, 8, "PASS"],
    ["AT_LEAST missed", "AT_LEAST", 0.9, 8, "FAIL"],
    ["AT_MOST met", "AT_MOST", 0.8, 8, "PASS"],
    ["AT_MOST missed", "AT_MOST", 0.7, 8, "FAIL"],
    ["EQUAL met", "EQUAL", 0.8, 8, "PASS"],
    ["EQUAL missed", "EQUAL", 0.7, 8, "FAIL"],
  ] as const)("reproduces comparator semantics: %s", (_label, comparator, threshold, numerator, outcome) => {
    const configuration = configurationWith("completion-floor", { comparator, threshold });
    const target = (configuration.criteria as readonly RecordValue[]).find((entry) => entry.criterionId === "completion-floor")!;
    const result = evaluate(configuration, reportWithCriterion(
      configuration, "completion-floor", observationFor(target, { rawNumerators: [{ key: "completed", value: numerator }] }), outcome,
    ));
    expect(result).toMatchObject({ overallOutcome: outcome, recommendation: outcome === "PASS" ? "OPEN" : "DO_NOT_OPEN" });
  });

  it.each([
    ["zero rate denominator", { rawDenominator: 0, rawNumerators: [{ key: "completed", value: 0 }] }],
    ["sample floor", { rawDenominator: 9, rawNumerators: [{ key: "completed", value: 8 }] }],
    ["response floor", { responseCount: 4 }],
    ["missing ceiling", { missingCount: 3 }],
  ])("keeps insufficient numeric evidence INDETERMINATE rather than converting it to failure: %s", (_label, observationOverrides) => {
    const configuration = configurationWith("completion-floor", { minimumResponses: 5 });
    const target = (configuration.criteria as readonly RecordValue[]).find((entry) => entry.criterionId === "completion-floor")!;
    const result = evaluate(configuration, reportWithCriterion(
      configuration, "completion-floor", observationFor(target, observationOverrides as RecordValue), "INDETERMINATE",
    ));
    expect(result).toMatchObject({ overallOutcome: "INDETERMINATE", recommendation: "PAUSE" });
  });

  it("represents unavailable mandatory evidence explicitly and rejects an omitted measure", () => {
    const configuration = gateConfiguration();
    const unavailable = unavailableObservation({ unavailableReason: "MISSING_REQUIRED_OBSERVATION" });
    expect(evaluate(configuration, reportWithCriterion(
      configuration, "completion-floor", unavailable, "INDETERMINATE",
    ))).toMatchObject({ overallOutcome: "INDETERMINATE", recommendation: "PAUSE" });
    const parts = passingParts(configuration);
    expect(() => evaluate(configuration, report(
      parts.observations.filter((entry) => entry.criterionId !== "completion-floor"), parts.outcomes,
      "INDETERMINATE", "PAUSE",
    ))).toThrow(/mandatory|measure|observation|completion/i);
  });

  it("gives measured misses precedence over indeterminate criteria and never infers an override", () => {
    const configuration = configurationWith("completion-floor", { threshold: 0.9 });
    const parts = passingParts(configuration);
    const observations = parts.observations
      .filter((entry) => entry.criterionId !== "response-sufficiency")
      .map((entry) => entry.criterionId === "completion-floor" ? { ...entry, rawNumerators: [{ key: "completed", value: 8 }] } : entry);
    observations.push(unavailableObservation({ criterionId: "response-sufficiency", metricId: "RESPONSE_SUFFICIENCY", formulaVersionId: "coherence-formulas-v1" }));
    const outcomes = parts.outcomes.map((entry) => entry.criterionId === "completion-floor"
      ? { criterionId: entry.criterionId, outcome: "FAIL" as const }
      : entry.criterionId === "response-sufficiency" ? { criterionId: entry.criterionId, outcome: "INDETERMINATE" as const } : entry);
    const signedReport = report(observations, outcomes, "FAIL", "DO_NOT_OPEN");
    expect(evaluate(configuration, signedReport)).toMatchObject({ overallOutcome: "FAIL", recommendation: "DO_NOT_OPEN" });
  });

  it("keeps raw exclusions separate from denominator, missing evidence, and the measured result", () => {
    const configuration = gateConfiguration();
    const target = (configuration.criteria as readonly RecordValue[])[0]!;
    const result = evaluate(configuration, reportWithCriterion(configuration, "completion-floor", observationFor(target, {
      missingCount: 1, excludedByReason: [{ reasonClass: "OPERATIONAL_TESTER", count: 3 }],
    }), "PASS", "PASS"));
    expect(result.criterionResults).toContainEqual(expect.objectContaining({ criterionId: "completion-floor",
      calculatedValue: 0.8,
      rawDenominator: 10,
      missingCount: 1,
      excludedCount: 3,
      excludedByReason: [{ reasonClass: "OPERATIONAL_TESTER", count: 3 }],
    }));
  });

  it("rejects claimed outcomes or recommendations that do not reproduce", () => {
    const configuration = gateConfiguration();
    const target = (configuration.criteria as readonly RecordValue[])[0]!;
    expect(() => evaluate(configuration, reportWithCriterion(configuration, "completion-floor", observationFor(target, {
      rawNumerators: [{ key: "completed", value: 5 }],
    }), "PASS"))).toThrow(/criterion|outcome|reproduce|claim/i);
    expect(() => evaluate(configuration, passingReport(configuration, { recommendation: "PAUSE" }))).toThrow(/recommendation|outcome|reproduce/i);
  });

  it.each([
    ["freeze before grace end", { freezeAt: "2026-08-08T00:59:59.999Z" }],
    ["freeze after grace end", { freezeAt: "2026-08-08T01:00:00.001Z" }],
    ["report before freeze", { signedAt: "2026-08-08T00:59:59.999Z" }],
    ["wrong template", { reportTemplateVersionId: "wrong-template" }],
    ["wrong gate config", { gateConfigurationVersionId: "wrong-gate-config" }],
    ["wrong lifecycle", { lifecycleVersionId: "wrong-lifecycle" }],
    ["wrong calendar", { dayCalendarVersionId: "wrong-calendar" }],
    ["blank report signer", { signedBy: " " }],
    ["blank report signature", { signatureId: " " }],
  ])("rejects signed report boundary/reference drift: %s", (_label, overrides) => {
    const configuration = gateConfiguration();
    expect(() => evaluate(configuration, passingReport(configuration, overrides))).toThrow();
  });

  it("rejects a vacuous or incomplete gate and ambiguous criterion outcomes", () => {
    const configuration = gateConfiguration();
    const parts = passingParts(configuration);
    expect(() => evaluate(gateConfiguration([]), report([], [], "PASS", "OPEN"))).toThrow(/criteria|empty|mandatory/i);
    expect(() => evaluate(gateConfiguration([...mandatoryCriteria(), mandatoryCriteria()[0]!]), passingReport(configuration))).toThrow(/duplicate|criterion/i);
    expect(() => evaluate(gateConfiguration(mandatoryCriteria().slice(1)), passingReport(configuration))).toThrow(/mandatory|completion|measure/i);
    expect(() => evaluate(configuration, report(parts.observations, parts.outcomes.slice(1), "PASS", "OPEN"))).toThrow(/outcome|missing|criterion/i);
    expect(() => evaluate(configuration, report(parts.observations, [...parts.outcomes, parts.outcomes[0]!], "PASS", "OPEN"))).toThrow(/duplicate|outcome|criterion/i);
    expect(() => evaluate(configuration, report(parts.observations, [...parts.outcomes, { criterionId: "unknown", outcome: "PASS" }], "PASS", "OPEN"))).toThrow(/unknown|outcome|criterion/i);
  });

  it("binds every mandatory criterion identity to its exact metric, numerator, and value source", () => {
    const valid = gateConfiguration();
    const signedReport = passingReport(valid);
    const replacements = [
      { criterionId: "voluntary-return", metricId: "MIXED_SESSION_COMPLETION", numeratorKey: "completed" },
      { criterionId: "abandonment-language", metricId: "MODE_ABANDONMENT_PROVENANCE" },
      { criterionId: "clue-use-language", numeratorKey: "both" },
      { criterionId: "critical-defect-status", numeratorKey: "unresolved" },
      { criterionId: "critical-defect-status", valueSource: "RATE", minimumDenominator: 1 },
      { criterionId: "critical-defect-status", metricId: "RESPONSE_SUFFICIENCY", numeratorKey: "submitted" },
    ];
    for (const replacement of replacements) {
      const changed = mandatoryCriteria().map((entry) => entry.criterionId === replacement.criterionId ? { ...entry, ...replacement } : entry);
      expect(() => evaluate(gateConfiguration(changed), signedReport)).toThrow(/mandatory|metric|numerator|source|identity|critical/i);
    }
  });

  it("rejects formula/metric drift, duplicate or unknown observations, and unsigned gate configuration", () => {
    const configuration = gateConfiguration();
    const parts = passingParts(configuration);
    const target = parts.observations[0]!;
    for (const changed of [
      { ...target, formulaVersionId: "wrong-formula" },
      { ...target, metricId: "WRONG_METRIC" },
      { ...target, criterionId: "unknown" },
    ]) expect(() => evaluate(configuration, report([changed, ...parts.observations.slice(1)], parts.outcomes, "PASS", "OPEN"))).toThrow();
    expect(() => evaluate(configuration, report([...parts.observations, target], parts.outcomes, "PASS", "OPEN"))).toThrow(/duplicate|observation|criterion/i);
    for (const overrides of [
      { signedBy: "Release Operator" }, { signatureId: " " }, { signedAt: "2026-08-01T00:00:00.001Z" },
      { lifecycleVersionId: "wrong" }, { dayCalendarVersionId: "wrong" },
    ]) expect(() => evaluate(gateConfiguration(mandatoryCriteria(), overrides), passingReport(configuration))).toThrow();
  });

  it("rejects nonfinite, negative, fractional-count and internally inconsistent numeric evidence", () => {
    const configuration = gateConfiguration();
    const target = (configuration.criteria as readonly RecordValue[])[0]!;
    for (const invalid of [
      { rawDenominator: -1 }, { rawDenominator: 1.5 }, { missingCount: -1 }, { missingCount: 1.5 },
      { responseCount: -1 }, { responseCount: 1.5 }, { rawNumerators: [{ key: "completed", value: Number.NaN }] },
      { rawNumerators: [{ key: "completed", value: Number.POSITIVE_INFINITY }] },
      { rawNumerators: [{ key: "completed", value: 11 }] },
      { rawNumerators: [{ key: "completed", value: 8 }, { key: "completed", value: 1 }] },
      { excludedByReason: [{ reasonClass: "X", count: -1 }] },
      { excludedByReason: [{ reasonClass: "X", count: 1.5 }] },
      { excludedByReason: [{ reasonClass: "X", count: 1 }, { reasonClass: "X", count: 2 }] },
    ]) expect(() => evaluate(configuration, reportWithCriterion(
      configuration, "completion-floor", observationFor(target, invalid), "PASS", "PASS",
    ))).toThrow();

    for (const overrides of [
      { threshold: -1 }, { threshold: Number.NaN }, { threshold: Number.POSITIVE_INFINITY },
      { minimumDenominator: -1 }, { minimumDenominator: 1.5 }, { minimumResponses: -1 }, { minimumResponses: 1.5 },
      { maximumMissingCount: -1 }, { maximumMissingCount: 1.5 },
    ]) expect(() => evaluate(configurationWith("completion-floor", overrides), passingReport(configuration))).toThrow();
  });

  it("requires exact recursively frozen configuration, criterion, observation, outcome and report-reference shapes", () => {
    const configuration = gateConfiguration();
    const signedReport = passingReport(configuration);
    expect(() => evaluateDay7Gate({ lifecycle: lifecycle(), configuration, report: signedReport })).toThrow(/frozen|immutable|boundary/i);
    expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: signedReport, extra: true }))).toThrow(/field|shape|extra/i);
    const configurationFields = ["gateConfigurationVersionId", "lifecycleVersionId", "dayCalendarVersionId", "reportTemplateVersionId", "criteria", "signedBy", "signatureId", "signedAt"];
    const rawConfiguration = configuration as unknown as RecordValue;
    for (const field of configurationFields) {
      const missing = { ...rawConfiguration }; delete missing[field];
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration: missing, report: signedReport }))).toThrow();
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration: { ...rawConfiguration, [field]: null }, report: signedReport }))).toThrow();
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration: { ...rawConfiguration, [field]: undefined }, report: signedReport }))).toThrow();
    }
    expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration: { ...rawConfiguration, extra: true }, report: signedReport }))).toThrow(/field|shape|extra/i);
    const criterionFields = ["criterionId", "metricId", "formulaVersionId", "numeratorKey", "valueSource", "comparator", "threshold", "minimumDenominator", "minimumResponses", "maximumMissingCount"];
    const validCriterion = mandatoryCriteria()[0]!;
    for (const field of criterionFields) for (const kind of ["missing", "null", "undefined"] as const) {
      const changed = { ...validCriterion } as RecordValue;
      if (kind === "missing") delete changed[field]; else changed[field] = kind === "null" ? null : undefined;
      expect(() => evaluate(gateConfiguration([changed, ...mandatoryCriteria().slice(1)]), signedReport)).toThrow();
    }
    expect(() => evaluate(gateConfiguration([{ ...validCriterion, extra: true }, ...mandatoryCriteria().slice(1)]), signedReport)).toThrow(/field|shape|extra/i);

    const parts = passingParts(configuration);
    const validObservation = parts.observations[0]!;
    for (const field of ["criterionId", "metricId", "formulaVersionId", "availability", "rawNumerators", "rawDenominator", "missingCount", "excludedByReason", "responseCount"]) {
      const changed = { ...validObservation } as RecordValue; delete changed[field];
      expect(() => evaluate(configuration, report([changed, ...parts.observations.slice(1)], parts.outcomes, "PASS", "OPEN"))).toThrow();
      expect(() => evaluate(configuration, report([{ ...validObservation, [field]: null }, ...parts.observations.slice(1)], parts.outcomes, "PASS", "OPEN"))).toThrow();
      expect(() => evaluate(configuration, report([{ ...validObservation, [field]: undefined }, ...parts.observations.slice(1)], parts.outcomes, "PASS", "OPEN"))).toThrow();
    }
    expect(() => evaluate(configuration, report([{ ...validObservation, extra: true }, ...parts.observations.slice(1)], parts.outcomes, "PASS", "OPEN"))).toThrow(/field|shape|extra/i);

    const unavailable = unavailableObservation();
    for (const field of ["criterionId", "metricId", "formulaVersionId", "availability", "unavailableReason"]) {
      const changed = { ...unavailable } as RecordValue; delete changed[field];
      expect(() => evaluate(configuration, reportWithCriterion(configuration, "completion-floor", changed, "INDETERMINATE"))).toThrow();
      expect(() => evaluate(configuration, reportWithCriterion(configuration, "completion-floor", { ...unavailable, [field]: null }, "INDETERMINATE"))).toThrow();
      expect(() => evaluate(configuration, reportWithCriterion(configuration, "completion-floor", { ...unavailable, [field]: undefined }, "INDETERMINATE"))).toThrow();
    }
    expect(() => evaluate(configuration, reportWithCriterion(configuration, "completion-floor", { ...unavailable, rawDenominator: 0 }, "INDETERMINATE"))).toThrow(/field|shape|extra/i);

    const validOutcome = parts.outcomes[0]!;
    for (const field of ["criterionId", "outcome"]) for (const kind of ["missing", "null", "undefined"] as const) {
      const changed = { ...validOutcome } as RecordValue;
      if (kind === "missing") delete changed[field]; else changed[field] = kind === "null" ? null : undefined;
      expect(() => evaluate(configuration, report(parts.observations, [changed as never, ...parts.outcomes.slice(1)], "PASS", "OPEN"))).toThrow();
    }
    expect(() => evaluate(configuration, report(parts.observations, [{ ...validOutcome, extra: true } as never, ...parts.outcomes.slice(1)], "PASS", "OPEN"))).toThrow(/field|shape|extra/i);

    const validReport = passingReport(configuration) as unknown as RecordValue;
    for (const field of ["reportId", "reportVersionId", "reportTemplateVersionId", "gateConfigurationVersionId", "lifecycleVersionId", "dayCalendarVersionId", "freezeAt", "observations", "criterionOutcomes", "overallOutcome", "recommendation", "viewReferenceIds", "incidentTreatmentReferenceIds", "inventoryReadinessReferenceId", "missingDataTreatmentReferenceId", "signedBy", "signerRole", "signatureId", "signedAt"]) {
      const changed = { ...validReport }; delete changed[field];
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: changed }))).toThrow();
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, [field]: null } }))).toThrow();
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, [field]: undefined } }))).toThrow();
    }
    expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, extra: true } }))).toThrow(/field|shape|extra/i);

    const views = validReport.viewReferenceIds as RecordValue;
    for (const field of ["mode", "day", "position", "cohort"]) {
      const missing = { ...views }; delete missing[field];
      for (const changed of [missing, { ...views, [field]: null }, { ...views, [field]: undefined }]) {
        expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, viewReferenceIds: changed } }))).toThrow();
      }
    }
    expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, viewReferenceIds: { ...views, extra: true } } }))).toThrow(/field|shape|extra/i);
    for (const incidentTreatmentReferenceIds of [null, undefined, "incident", [], [""], ["same", "same"]]) {
      expect(() => evaluateDay7Gate(deepFreeze({ lifecycle: lifecycle(), configuration, report: { ...validReport, incidentTreatmentReferenceIds } }))).toThrow();
    }
  });

  it("is byte-stable under criterion, observation, outcome, numerator and exclusion permutation", () => {
    const criteria = mandatoryCriteria();
    const configuration = gateConfiguration(criteria);
    const parts = passingParts(configuration);
    const observations = parts.observations.map((entry) => entry.criterionId === "completion-floor"
      ? { ...entry, rawNumerators: [{ key: "unused", value: 2 }, { key: "completed", value: 8 }], excludedByReason: [{ reasonClass: "Z", count: 1 }, { reasonClass: "A", count: 2 }] }
      : entry);
    const first = evaluate(configuration, report(observations, parts.outcomes, "PASS", "OPEN"));
    const second = evaluate(gateConfiguration([...criteria].reverse()), report(
      [...observations].reverse().map((entry) => ({ ...entry,
        rawNumerators: [...entry.rawNumerators as readonly RecordValue[]].reverse(),
        excludedByReason: [...entry.excludedByReason as readonly RecordValue[]].reverse(),
      })), [...parts.outcomes].reverse(), "PASS", "OPEN",
    ));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("strict Don-signed Day 8 authorization", () => {
  const passEvaluation = () => {
    const configuration = gateConfiguration();
    return evaluate(configuration, passingReport(configuration));
  };
  const failEvaluation = () => {
    const configuration = configurationWith("completion-floor", { threshold: 0.9 });
    const target = (configuration.criteria as readonly RecordValue[])[0]!;
    return evaluate(configuration, reportWithCriterion(configuration, "completion-floor", observationFor(target), "FAIL"));
  };
  const indeterminateEvaluation = () => {
    const configuration = gateConfiguration();
    return evaluate(configuration, reportWithCriterion(
      configuration, "completion-floor", unavailableObservation({ unavailableReason: "MISSING_REQUIRED_OBSERVATION" }), "INDETERMINATE",
    ));
  };

  it("opens Day 8 only at the first UTC midnight strictly after the signed OPEN decision", () => {
    const state = authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision() }));
    expect(state).toMatchObject({
      allowed: true,
      reason: "AUTHORIZED",
      day8Start: "2026-08-09T00:00:00.000Z",
      decisionId: "day8-decision-1",
      idempotencyKey: "day8-open-idempotency-1",
      reportId: "day7-report-1",
      reportVersionId: "day7-report-v1",
      departureRationaleReferenceId: null,
      departureRationaleSignatureId: null,
      stateIntegritySeal: expect.any(String),
      lastAttempt: { outcome: "ALLOWED", reason: "AUTHORIZED", occurredAt: "2026-08-08T12:05:00.000Z" },
      signedDecision: expect.objectContaining({ decisionId: "day8-decision-1", signedBy: "Don" }),
      auditRecords: [{ sequence: 1, action: "AUTHORIZE_DAY8", outcome: "ALLOWED", occurredAt: "2026-08-08T12:05:00.000Z",
        operatorName: "Release Operator", operatorRole: "RELEASE_OPERATOR", decisionId: "day8-decision-1",
        reportId: "day7-report-1", reportVersionId: "day7-report-v1", decisionSignatureId: expect.any(String),
        departureRationaleReferenceId: null, departureRationaleSignatureId: null, reason: null,
        signedDecision: expect.objectContaining({ decisionId: "day8-decision-1", signedBy: "Don" }),
        integritySeal: expect.any(String) }],
    });
    expect(Object.keys(state).sort()).toEqual([
      "allowed", "auditRecords", "day8Start", "decisionDigest", "decisionId", "departureRationaleReferenceId",
      "departureRationaleSignatureId", "idempotencyKey", "lastAttempt", "lifecycleVersionId", "reason", "reportId",
      "reportVersionId", "signedDecision", "stateIntegritySeal",
    ]);
    expect(Object.keys(state.auditRecords[0]!).sort()).toEqual([
      "action", "decisionDigest", "decisionId", "decisionSignatureId", "departureRationaleReferenceId",
      "departureRationaleSignatureId", "integritySeal", "occurredAt", "operatorName", "operatorRole", "outcome", "reason",
      "reportId", "reportVersionId", "sequence", "signedDecision",
    ]);
    expect(recursivelyFrozen(state)).toBe(true);

    const exactMidnight = authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision({ signedAt: "2026-08-09T00:00:00.000Z" }) }));
    expect(exactMidnight).toMatchObject({ allowed: true, day8Start: "2026-08-10T00:00:00.000Z" });
  });

  it("rejects plausible forged approvals and caller-asserted operator labels through the trusted boundary", () => {
    expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(),
      decision: decision({ signatureId: "plausible-forged-open-signature" }) })))
      .toMatchObject({ allowed: false, reason: "DECISION_SIGNATURE_INVALID" });
    expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision() }),
      { authenticatedOperator: "Different Authenticated Principal" }))
      .toMatchObject({ allowed: false, reason: "AUTHENTICATED_RELEASE_OPERATOR_REQUIRED" });
    expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: failEvaluation(),
      decision: decision({ departureRationale: departureRationale({ signatureId: "plausible-forged-rationale-signature" }) }) })))
      .toMatchObject({ allowed: false, reason: "SIGNED_DEPARTURE_RATIONALE_REQUIRED" });
  });

  it("uses an independent canonical server action time and rejects an invalid authoritative clock before storage", () => {
    const store = new SerializedAuthorizationStore();
    expect(() => authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision() }),
      { store, now: "2026-08-08T13:05:00+01:00" })).toThrow(/authoritative|server|UTC|instant|clock/i);
    expect(store.snapshot()).toBeNull();
    const accepted = authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision() }),
      { store, now: "2026-08-08T13:05:00.000Z" });
    expect(accepted.auditRecords[0]).toMatchObject({ occurredAt: "2026-08-08T13:05:00.000Z" });
    expect(accepted).toMatchObject({ day8Start: "2026-08-09T00:00:00.000Z" });
  });

  it("re-derives signed sources after restart and replays through a shared serialized atomic store", () => {
    const sourceLifecycle = lifecycleSource();
    const configuration = gateConfiguration();
    const signedReport = passingReport(configuration);
    const signedDecision = decision();
    const firstLifecycle = lifecycle(sourceLifecycle);
    const firstEvaluation = evaluateDay7Gate(deepFreeze({ lifecycle: firstLifecycle, configuration, report: signedReport }));
    const store = new SerializedAuthorizationStore();
    const first = authorizeDay8(deepFreeze({ lifecycle: firstLifecycle, evaluation: firstEvaluation, decision: signedDecision }), { store });
    expect(store.snapshot()).not.toBeNull();

    const persisted = <T>(entry: T): T => deepFreeze(JSON.parse(JSON.stringify(entry)) as T);
    const restartedLifecycle = lifecycle(persisted(sourceLifecycle));
    const restartedEvaluation = evaluateDay7Gate(deepFreeze({ lifecycle: restartedLifecycle,
      configuration: persisted(configuration), report: persisted(signedReport) }));
    const replay = authorizeDay8(deepFreeze({ lifecycle: restartedLifecycle, evaluation: restartedEvaluation,
      decision: persisted(signedDecision) }), { store, now: "2026-08-08T13:00:00.000Z" });
    expect(replay).toEqual(first);
    expect(replay.auditRecords).toHaveLength(1);
    expect(evaluateReleaseWindow(deepFreeze({ lifecycle: restartedLifecycle, day8Authorization: replay,
      activeDayId: "active-day-8", action: "ISSUE", occurredAt: "2026-08-09T00:00:00.000Z",
      sessionStatus: "NOT_STARTED", credentialIssued: false }))).toMatchObject({ allowed: true, phase: "ACTIVE" });
  });

  it("derives Days 8 through 14 without consuming the pause and preserves per-day grace", () => {
    const beta = lifecycle();
    const authorization = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation: passEvaluation(), decision: decision() }));
    const input = (activeDayId: string, action: string, occurredAt: string, extra: RecordValue = {}) => deepFreeze({
      lifecycle: beta, day8Authorization: authorization, activeDayId, action, occurredAt,
      sessionStatus: action === "ISSUE" ? "NOT_STARTED" : "IN_PROGRESS", credentialIssued: action !== "ISSUE", ...extra,
    });
    expect(evaluateReleaseWindow(input("active-day-8", "ISSUE", "2026-08-08T23:59:59.999Z")))
      .toMatchObject({ allowed: false, reason: "DAY8_NOT_STARTED", phase: "PAUSED" });
    expect(evaluateReleaseWindow(input("active-day-8", "ISSUE", "2026-08-09T00:00:00.000Z")))
      .toMatchObject({ allowed: true, phase: "ACTIVE" });
    expect(evaluateReleaseWindow(input("active-day-8", "RESUME", "2026-08-10T00:30:00.000Z")))
      .toMatchObject({ allowed: true, phase: "GRACE", attributedActiveDayId: "active-day-8" });
    expect(evaluateReleaseWindow(input("active-day-9", "ISSUE", "2026-08-10T00:30:00.000Z")))
      .toMatchObject({ allowed: true, phase: "ACTIVE", attributedActiveDayId: "active-day-9" });
    expect(evaluateReleaseWindow(input("active-day-14", "ISSUE", "2026-08-15T23:59:59.999Z")))
      .toMatchObject({ allowed: true, phase: "ACTIVE", attributedActiveDayId: "active-day-14" });
    expect(evaluateReleaseWindow(input("active-day-14", "ISSUE", "2026-08-16T00:00:00.000Z")))
      .toMatchObject({ allowed: false, reason: "ISSUANCE_CLOSED" });
    expect(evaluateReleaseWindow(input("active-day-14", "RESUME", "2026-08-16T00:59:59.999Z")))
      .toMatchObject({ allowed: true, phase: "GRACE" });
    expect(evaluateReleaseWindow(input("active-day-14", "WRITE_EVENT", "2026-08-16T01:00:00.000Z")))
      .toMatchObject({ allowed: false, reason: "SESSION_EXPIRED", resultingSessionStatus: "EXPIRED" });
    expect(evaluateReleaseWindow(input("active-day-14", "ISSUE", "2026-08-17T00:00:00.000Z")))
      .toMatchObject({ allowed: false, reason: "BETA_ENDED", phase: "AFTER_BETA" });
  });

  it("rejects fabricated, altered, or denied Day 8 authorization provenance", () => {
    const beta = lifecycle();
    const genuine = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation: passEvaluation(), decision: decision() }));
    const envelope = (day8Authorization: unknown) => deepFreeze({
      lifecycle: beta, day8Authorization, activeDayId: "active-day-8", action: "ISSUE",
      occurredAt: "2026-08-09T00:00:00.000Z", sessionStatus: "NOT_STARTED", credentialIssued: false,
    });
    for (const forged of [
      { allowed: true, reason: "AUTHORIZED", day8Start: "2026-08-09T00:00:00.000Z" },
      { ...genuine, day8Start: "2026-08-08T00:00:00.000Z" },
      { ...genuine, reportId: "forged-report" },
      { ...genuine, auditRecords: [{ ...genuine.auditRecords[0]!, outcome: "DENIED" }] },
    ]) expect(() => evaluateReleaseWindow(envelope(deepFreeze(forged)))).toThrow(/authorization|provenance|forged|invalid/i);
    const denied = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation: passEvaluation(), decision: decision({ decision: "PAUSE" }) }));
    expect(evaluateReleaseWindow(envelope(denied))).toMatchObject({ allowed: false, reason: "DAY8_OPEN_DECISION_REQUIRED" });
  });

  it("requires an exact typed post-Day-8 release-request envelope", () => {
    const beta = lifecycle();
    const day8Authorization = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation: passEvaluation(), decision: decision() }));
    const valid = deepFreeze({
      lifecycle: beta, day8Authorization, activeDayId: "active-day-8", action: "WRITE_EVENT",
      occurredAt: "2026-08-09T12:00:00.000Z", sessionStatus: "IN_PROGRESS", credentialIssued: true,
    }) as unknown as RecordValue;
    for (const field of ["lifecycle", "day8Authorization", "activeDayId", "action", "occurredAt", "sessionStatus", "credentialIssued"]) {
      const missing = { ...valid }; delete missing[field];
      expect(() => evaluateReleaseWindow(deepFreeze(missing))).toThrow();
      expect(() => evaluateReleaseWindow(deepFreeze({ ...valid, [field]: null }))).toThrow();
      expect(() => evaluateReleaseWindow(deepFreeze({ ...valid, [field]: undefined }))).toThrow();
    }
    expect(() => evaluateReleaseWindow(deepFreeze({ ...valid, extra: true }))).toThrow(/field|shape|extra/i);
    for (const changed of [
      { ...valid, action: "DELETE" }, { ...valid, sessionStatus: "ANSWERED" },
      { ...valid, credentialIssued: 1 }, { ...valid, occurredAt: "2026-08-09T12:00:00+01:00" },
    ]) expect(() => evaluateReleaseWindow(deepFreeze(changed))).toThrow(/field|action|status|boolean|UTC|instant|request/i);
  });

  it("keeps non-OPEN decisions blocked and audits the named operator denial", () => {
    for (const nonOpen of ["DO_NOT_OPEN", "PAUSE"] as const) {
      const result = authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision({ decision: nonOpen }) }));
      expect(result).toMatchObject({
        allowed: false,
        reason: "OPEN_DECISION_REQUIRED",
        auditRecords: [{ sequence: 1, action: "AUTHORIZE_DAY8", outcome: "DENIED", operatorName: "Release Operator", reason: "OPEN_DECISION_REQUIRED" }],
      });
      expect(result).not.toHaveProperty("day8Start");
    }
  });

  it("requires a separately Don-signed rationale reference for departure from FAIL or INDETERMINATE", () => {
    const signedRationale = departureRationale();
    for (const evaluation of [failEvaluation(), indeterminateEvaluation()]) {
      expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation, decision: decision() })))
        .toMatchObject({ allowed: false, reason: "SIGNED_DEPARTURE_RATIONALE_REQUIRED" });
      expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation, decision: decision({ departureRationale: signedRationale }) })))
        .toMatchObject({ allowed: true, reason: "AUTHORIZED", day8Start: "2026-08-09T00:00:00.000Z" });
    }
    for (const invalid of [
      { ...signedRationale, referenceId: " " },
      { ...signedRationale, reportId: "other-report" },
      { ...signedRationale, signedBy: "Release Operator" },
      { ...signedRationale, signatureId: " " },
      { ...signedRationale, signedAt: "2026-08-08T01:59:59.999Z" },
      { ...signedRationale, signedAt: "2026-08-08T12:00:00.001Z" },
    ]) for (const evaluation of [failEvaluation(), indeterminateEvaluation()]) {
      expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation, decision: decision({ departureRationale: invalid }) })))
        .toMatchObject({ allowed: false, reason: "SIGNED_DEPARTURE_RATIONALE_REQUIRED" });
    }
  });

  it.each([
    ["wrong report", { reportId: "other-report" }, "REPORT_REFERENCE_MISMATCH"],
    ["wrong report version", { reportVersionId: "other-version" }, "REPORT_REFERENCE_MISMATCH"],
    ["wrong signer", { signedBy: "Release Operator" }, "DON_SIGNATURE_REQUIRED"],
    ["blank signature", { signatureId: " " }, "DON_SIGNATURE_REQUIRED"],
    ["decision before report", { signedAt: "2026-08-08T01:59:59.999Z" }, "DECISION_CHRONOLOGY_INVALID"],
    ["blank idempotency", { idempotencyKey: " " }, "IDEMPOTENCY_KEY_REQUIRED"],
    ["wrong operator", { operator: { name: "Release Operator", role: "CONTENT_OPERATOR" } }, "RELEASE_OPERATOR_REQUIRED"],
  ])("fails closed and audits Day 8 authorization: %s", (_label, overrides, reason) => {
    expect(authorizeDay8(deepFreeze({ lifecycle: lifecycle(), evaluation: passEvaluation(), decision: decision(overrides) })))
      .toMatchObject({ allowed: false, reason, auditRecords: [{ outcome: "DENIED", operatorName: "Release Operator", reason }] });
  });

  it("uses canonical durable replay and keeps the first accepted transition terminal through later denials", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    const signedDecision = decision();
    const store = new SerializedAuthorizationStore();
    const first = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: signedDecision }), { store });
    const reorderedDecision = deepFreeze(Object.fromEntries(Object.entries(signedDecision).reverse()));
    const replay = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: reorderedDecision }), { store, now: "2026-08-08T13:00:00.000Z" });
    expect(replay).toEqual(first);
    expect(replay).not.toBe(first);
    expect(replay.auditRecords).not.toBe(first.auditRecords);
    expect(replay.auditRecords[0]).not.toBe(first.auditRecords[0]);
    expect(replay.auditRecords).toHaveLength(1);
    expect(store.snapshot()).not.toBeNull();

    const drift = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision({ decisionId: "changed-under-same-key" }) }),
      { store, now: "2026-08-08T13:05:00.000Z" });
    expect(drift).toMatchObject({
      allowed: true,
      reason: "AUTHORIZED",
      lastAttempt: { outcome: "DENIED", reason: "IDEMPOTENCY_REPLAY_DRIFT", occurredAt: "2026-08-08T13:05:00.000Z" },
    });
    expect(drift.auditRecords).toHaveLength(2);
    expect(drift.auditRecords[0]).toMatchObject({ outcome: "ALLOWED",
      signedDecision: expect.objectContaining({ decisionId: "day8-decision-1" }) });
    expect(drift.auditRecords[1]).toMatchObject({ outcome: "DENIED", reason: "IDEMPOTENCY_REPLAY_DRIFT",
      signedDecision: expect.objectContaining({ decisionId: "changed-under-same-key" }) });
    const second = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation,
      decision: decision({ decisionId: "decision-2", idempotencyKey: "key-2" }) }),
    { store, now: "2026-08-08T13:10:00.000Z" });
    expect(second).toMatchObject({
      allowed: true,
      reason: "AUTHORIZED",
      lastAttempt: { outcome: "DENIED", reason: "DAY8_ALREADY_AUTHORIZED", occurredAt: "2026-08-08T13:10:00.000Z" },
    });
    expect(second.auditRecords).toHaveLength(3);
    expect(second.auditRecords.filter((entry) => entry.outcome === "ALLOWED")).toHaveLength(1);
    expect(second.auditRecords[2]).toMatchObject({ outcome: "DENIED", reason: "DAY8_ALREADY_AUTHORIZED",
      signedDecision: expect.objectContaining({ decisionId: "decision-2", idempotencyKey: "key-2" }) });
  });

  it("rejects tampered prior authorization state and audit lineage", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    const first = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }));
    const audit = first.auditRecords[0]!;
    for (const priorState of [
      { ...first, reportId: "tampered-report" },
      { ...first, auditRecords: [{ ...audit, sequence: 2 }] },
      { ...first, auditRecords: [{ ...audit, operatorName: "Other Operator" }] },
      { ...first, auditRecords: [{ ...audit, outcome: "DENIED" }] },
    ]) expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), deepFreeze(priorState));
  });

  it("binds denied audit rows to their signed decision envelope and preserves corrupt history", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    const denied = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision({ decision: "PAUSE" }) }));
    expect(denied.auditRecords[0]).toMatchObject({
      outcome: "DENIED",
      reason: "OPEN_DECISION_REQUIRED",
      signedDecision: expect.objectContaining({ decision: "PAUSE", signedBy: "Don" }),
    });
    const corrupt = deepFreeze({ ...denied,
      auditRecords: [{ ...denied.auditRecords[0]!, operatorName: "Structurally Plausible Other Operator" }] });
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), corrupt);
    const changedReason = "REPORT_REFERENCE_MISMATCH";
    const reasonCorrupt = deepFreeze({ ...denied, reason: changedReason,
      lastAttempt: { ...denied.lastAttempt, reason: changedReason },
      auditRecords: [{ ...denied.auditRecords[0]!, reason: changedReason }] });
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), reasonCorrupt);
  });

  it("rejects valid-seal tail truncation from both accepted and denied audit histories", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    const allowedStore = new SerializedAuthorizationStore();
    const accepted = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), { store: allowedStore });
    const acceptedWithDenial = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation,
      decision: decision({ decisionId: "changed-under-same-key" }) }),
    { store: allowedStore, now: "2026-08-08T13:05:00.000Z" });
    expect(acceptedWithDenial.auditRecords).toHaveLength(2);
    const truncatedAccepted = deepFreeze({ ...acceptedWithDenial, lastAttempt: accepted.lastAttempt,
      auditRecords: [acceptedWithDenial.auditRecords[0]!] });
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), truncatedAccepted);

    const deniedStore = new SerializedAuthorizationStore();
    const firstDenied = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision({ decision: "PAUSE" }) }),
      { store: deniedStore });
    const deniedWithTail = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation,
      decision: decision({ reportId: "other-report" }) }), { store: deniedStore, now: "2026-08-08T13:10:00.000Z" });
    expect(deniedWithTail.auditRecords).toHaveLength(2);
    const truncatedDenied = deepFreeze({ ...deniedWithTail, reason: firstDenied.reason, lastAttempt: firstDenied.lastAttempt,
      auditRecords: [deniedWithTail.auditRecords[0]!] });
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), truncatedDenied);
  });

  it("fails closed on missing, null, undefined or extra decision, operator, rationale, stored-state and audit fields", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    const rawDecision = decision() as unknown as RecordValue;
    for (const field of ["decisionId", "idempotencyKey", "decision", "reportId", "reportVersionId", "signedBy", "signatureId", "signedAt", "operator"]) {
      const missing = { ...rawDecision }; delete missing[field];
      for (const changed of [missing, { ...rawDecision, [field]: null }, { ...rawDecision, [field]: undefined }]) {
        expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation, decision: changed }));
      }
    }
    expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation, decision: { ...rawDecision, extra: true } }));

    const operator = rawDecision.operator as RecordValue;
    for (const field of ["name", "role"]) {
      const missing = { ...operator }; delete missing[field];
      for (const changed of [missing, { ...operator, [field]: null }, { ...operator, [field]: undefined }]) {
        expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation, decision: { ...rawDecision, operator: changed } }));
      }
    }
    expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation, decision: { ...rawDecision, operator: { ...operator, extra: true } } }));

    const rationale = departureRationale();
    for (const field of ["referenceId", "reportId", "signedBy", "signatureId", "signedAt"]) {
      const missing = { ...rationale } as RecordValue; delete missing[field];
      for (const changed of [missing, { ...rationale, [field]: null }, { ...rationale, [field]: undefined }]) {
        expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation: failEvaluation(), decision: decision({ departureRationale: changed }) }));
      }
    }
    expectAuthorizationFailsClosed(deepFreeze({ lifecycle: beta, evaluation: failEvaluation(), decision: decision({ departureRationale: { ...rationale, extra: true } }) }));

    const first = authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }));
    const rawPrior = first as unknown as RecordValue;
    for (const field of ["allowed", "reason", "day8Start", "decisionId", "idempotencyKey", "reportId", "reportVersionId",
      "lifecycleVersionId", "decisionDigest", "signedDecision", "lastAttempt", "auditRecords", "stateIntegritySeal"]) {
      const missing = { ...rawPrior }; delete missing[field];
      for (const changed of [missing, { ...rawPrior, [field]: null }, { ...rawPrior, [field]: undefined }]) {
        expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), deepFreeze(changed));
      }
    }
    for (const field of ["departureRationaleReferenceId", "departureRationaleSignatureId"]) {
      const missing = { ...rawPrior }; delete missing[field];
      for (const changed of [missing, { ...rawPrior, [field]: undefined }, { ...rawPrior, [field]: "unexpected-rationale-lineage" }]) {
        expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), deepFreeze(changed));
      }
    }
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }), deepFreeze({ ...rawPrior, extra: true }));

    const audit = first.auditRecords[0] as unknown as RecordValue;
    for (const field of ["sequence", "action", "outcome", "occurredAt", "operatorName", "operatorRole", "decisionId",
      "decisionDigest", "reportId", "reportVersionId", "decisionSignatureId", "signedDecision", "integritySeal"]) {
      const missing = { ...audit }; delete missing[field];
      for (const changed of [missing, { ...audit, [field]: null }, { ...audit, [field]: undefined }]) {
        expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }),
          deepFreeze({ ...rawPrior, auditRecords: [changed] }));
      }
    }
    for (const field of ["departureRationaleReferenceId", "departureRationaleSignatureId", "reason"]) {
      const missing = { ...audit }; delete missing[field];
      for (const changed of [missing, { ...audit, [field]: undefined }, { ...audit, [field]: "unexpected-audit-lineage" }]) {
        expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }),
          deepFreeze({ ...rawPrior, auditRecords: [changed] }));
      }
    }
    expectCorruptStorePreserved(deepFreeze({ lifecycle: beta, evaluation, decision: decision() }),
      deepFreeze({ ...rawPrior, auditRecords: [{ ...audit, extra: true }] }));
  });

  it("rejects mutable/extra authorization envelopes and never accepts an altered evaluation", () => {
    const beta = lifecycle();
    const evaluation = passEvaluation();
    expect(() => authorizeDay8({ lifecycle: beta, evaluation, decision: decision() })).toThrow(/frozen|immutable|boundary/i);
    expect(() => authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision(), extra: true }))).toThrow(/field|shape|extra/i);
    expect(() => authorizeDay8(deepFreeze({ lifecycle: beta, evaluation, decision: decision(), priorState: null }))).toThrow(/field|shape|extra/i);
    const altered = deepFreeze({ ...evaluation, recommendation: "PAUSE" });
    expect(authorizeDay8(deepFreeze({ lifecycle: beta, evaluation: altered, decision: decision() })))
      .toMatchObject({ allowed: false, reason: "REPORT_EVALUATION_INVALID" });
  });
});
