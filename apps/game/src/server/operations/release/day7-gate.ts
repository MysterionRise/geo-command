import {
  asRecord,
  assertDeepFrozen,
  authenticatedOperator,
  canonicalInstant,
  canonicalJson,
  deepDetach,
  exact,
  fail,
  finiteNonnegative,
  freezeAuditRecords,
  isGateEvaluation,
  nonnegativeInteger,
  registerAuthorization,
  registerGateEvaluation,
  requireAuthority,
  requireLifecycle,
  text,
  verifyApproval,
  type AuthorizationAttempt,
  type AuthorizationAuditRecord,
  type AuditIntegrity,
  type AuthorityVerifier,
  type Day7GateEvaluation,
  type Day8Authorization,
  type Day8AuthorizationServices,
  type RecordValue,
  type UtcBetaLifecycle,
} from "./types.js";

type Outcome = "PASS" | "FAIL" | "INDETERMINATE";
type Recommendation = "OPEN" | "DO_NOT_OPEN" | "PAUSE";
type Comparator = "AT_LEAST" | "AT_MOST" | "EQUAL";
type ValueSource = "RATE" | "RAW_NUMERATOR";

interface Criterion {
  readonly criterionId: string;
  readonly metricId: string;
  readonly formulaVersionId: string;
  readonly numeratorKey: string;
  readonly valueSource: ValueSource;
  readonly comparator: Comparator;
  readonly threshold: number;
  readonly minimumDenominator: number;
  readonly minimumResponses: number;
  readonly maximumMissingCount: number;
}

interface GateConfiguration {
  readonly gateConfigurationVersionId: string;
  readonly lifecycleVersionId: string;
  readonly dayCalendarVersionId: string;
  readonly reportTemplateVersionId: string;
  readonly criteria: readonly Criterion[];
  readonly signatureId: string;
  readonly signedAt: string;
}

interface CountEntry { readonly key: string; readonly value: number }
interface ExclusionEntry { readonly reasonClass: string; readonly count: number }
interface AvailableObservation {
  readonly criterionId: string;
  readonly metricId: string;
  readonly formulaVersionId: string;
  readonly availability: "AVAILABLE";
  readonly rawNumerators: readonly CountEntry[];
  readonly rawDenominator: number;
  readonly missingCount: number;
  readonly excludedByReason: readonly ExclusionEntry[];
  readonly responseCount: number;
}
interface UnavailableObservation {
  readonly criterionId: string;
  readonly metricId: string;
  readonly formulaVersionId: string;
  readonly availability: "UNAVAILABLE";
  readonly unavailableReason: string;
}
type Observation = AvailableObservation | UnavailableObservation;

interface ParsedDecision {
  readonly decisionId: string;
  readonly idempotencyKey: string;
  readonly decision: unknown;
  readonly reportId: string;
  readonly reportVersionId: string;
  readonly signedBy: unknown;
  readonly signatureId: unknown;
  readonly signedAt: string;
  readonly operatorName: string;
  readonly operatorRole: unknown;
  readonly departureRationale: unknown;
  readonly normalized: Readonly<Record<string, unknown>>;
  readonly digest: string;
}

interface RationaleReferences {
  readonly referenceId: string;
  readonly signatureId: string;
}

const MANDATORY = Object.freeze({
  "completion-floor": Object.freeze({ metricId: "MIXED_SESSION_COMPLETION", numeratorKey: "completed", valueSource: "RATE" }),
  "voluntary-return": Object.freeze({ metricId: "VOLUNTARY_RETURN", numeratorKey: "returned", valueSource: "RATE" }),
  "transition-continuation": Object.freeze({ metricId: "TRANSITION_CONTINUATION", numeratorKey: "continued", valueSource: "RATE" }),
  "abandonment-provenance": Object.freeze({ metricId: "MODE_ABANDONMENT_PROVENANCE", numeratorKey: "abandoned", valueSource: "RATE" }),
  "abandonment-language": Object.freeze({ metricId: "MODE_ABANDONMENT_LANGUAGE", numeratorKey: "abandoned", valueSource: "RATE" }),
  "clue-use-provenance": Object.freeze({ metricId: "MODE_CLUE_USE_PROVENANCE", numeratorKey: "atLeastOne", valueSource: "RATE" }),
  "clue-use-language": Object.freeze({ metricId: "MODE_CLUE_USE_LANGUAGE", numeratorKey: "atLeastOne", valueSource: "RATE" }),
  "response-sufficiency": Object.freeze({ metricId: "RESPONSE_SUFFICIENCY", numeratorKey: "submitted", valueSource: "RATE" }),
  "shared-promise-comprehension": Object.freeze({ metricId: "SHARED_PROMISE_COMPREHENSION", numeratorKey: "understands", valueSource: "RATE" }),
  "critical-defect-status": Object.freeze({ metricId: "CRITICAL_DEFECT_STATUS", numeratorKey: "releaseBlocking", valueSource: "RAW_NUMERATOR" }),
} as const);

const criterionFields = ["criterionId", "metricId", "formulaVersionId", "numeratorKey", "valueSource", "comparator", "threshold", "minimumDenominator", "minimumResponses", "maximumMissingCount"] as const;

const parseCriterion = (value: unknown): Criterion => {
  const raw = asRecord(value, "gate criterion"); exact(raw, criterionFields, "gate criterion");
  const criterionId = text(raw.criterionId, "Criterion identity");
  const metricId = text(raw.metricId, "Criterion metric");
  const formulaVersionId = text(raw.formulaVersionId, "Criterion formula version");
  const numeratorKey = text(raw.numeratorKey, "Criterion numerator key");
  if (raw.valueSource !== "RATE" && raw.valueSource !== "RAW_NUMERATOR") fail("Criterion value source is invalid");
  if (raw.comparator !== "AT_LEAST" && raw.comparator !== "AT_MOST" && raw.comparator !== "EQUAL") fail("Criterion comparator is invalid");
  return Object.freeze({ criterionId, metricId, formulaVersionId, numeratorKey, valueSource: raw.valueSource, comparator: raw.comparator,
    threshold: finiteNonnegative(raw.threshold, "Criterion threshold"),
    minimumDenominator: nonnegativeInteger(raw.minimumDenominator, "Minimum denominator"),
    minimumResponses: nonnegativeInteger(raw.minimumResponses, "Minimum responses"),
    maximumMissingCount: nonnegativeInteger(raw.maximumMissingCount, "Maximum missing count") });
};

const parseConfiguration = (value: unknown, lifecycle: UtcBetaLifecycle, authority: AuthorityVerifier): GateConfiguration => {
  const raw = asRecord(value, "signed gate configuration");
  exact(raw, ["gateConfigurationVersionId", "lifecycleVersionId", "dayCalendarVersionId", "reportTemplateVersionId", "criteria", "signedBy", "signatureId", "signedAt"], "signed gate configuration");
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) fail("Gate criteria cannot be empty");
  const criteria = raw.criteria.map(parseCriterion);
  const byId = new Map(criteria.map((entry) => [entry.criterionId, entry]));
  if (byId.size !== criteria.length) fail("Duplicate gate criterion identity");
  if (byId.size !== Object.keys(MANDATORY).length) fail("Every mandatory coherence measure must occur exactly once");
  for (const [criterionId, required] of Object.entries(MANDATORY)) {
    const actual = byId.get(criterionId);
    if (!actual || actual.metricId !== required.metricId || actual.numeratorKey !== required.numeratorKey || actual.valueSource !== required.valueSource) {
      fail(`Mandatory metric identity is invalid for ${criterionId}`);
    }
  }
  const lifecycleVersionId = text(raw.lifecycleVersionId, "Gate lifecycle version");
  const dayCalendarVersionId = text(raw.dayCalendarVersionId, "Gate day-calendar version");
  if (lifecycleVersionId !== lifecycle.lifecycleVersionId || dayCalendarVersionId !== lifecycle.dayCalendarVersionId) fail("Gate lifecycle version binding is invalid");
  if (raw.signedBy !== "Don") fail("Gate configuration requires Don signature");
  const signatureId = text(raw.signatureId, "Gate configuration signature");
  const signedAt = canonicalInstant(raw.signedAt, "Gate configuration signature time");
  if (Date.parse(signedAt) > Date.parse(`${lifecycle.day1StartDate}T00:00:00.000Z`)) fail("Gate configuration must be signed before Day 1");
  const sortedCriteria = Object.freeze([...criteria].sort((a, b) => a.criterionId.localeCompare(b.criterionId)));
  const unsignedConfiguration = Object.freeze({ gateConfigurationVersionId: text(raw.gateConfigurationVersionId, "Gate configuration version"),
    lifecycleVersionId, dayCalendarVersionId, reportTemplateVersionId: text(raw.reportTemplateVersionId, "Report template version"),
    criteria: sortedCriteria, signedBy: "Don", signedAt });
  if (!verifyApproval(authority, "DAY7_GATE_CONFIGURATION", "Don", "DON", signedAt, signatureId, unsignedConfiguration)) {
    fail("Gate configuration signature authority verification failed");
  }
  return Object.freeze({ gateConfigurationVersionId: unsignedConfiguration.gateConfigurationVersionId, lifecycleVersionId,
    dayCalendarVersionId, reportTemplateVersionId: unsignedConfiguration.reportTemplateVersionId, criteria: sortedCriteria, signatureId, signedAt });
};

const parseCounts = (value: unknown, label: string): readonly CountEntry[] => {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a nonempty array`);
  const entries = value.map((entry) => {
    const raw = asRecord(entry, label); exact(raw, ["key", "value"], label);
    return Object.freeze({ key: text(raw.key, `${label} key`), value: nonnegativeInteger(raw.value, `${label} value`) });
  });
  if (new Set(entries.map((entry) => entry.key)).size !== entries.length) fail(`Duplicate ${label} key`);
  return Object.freeze(entries.sort((a, b) => a.key.localeCompare(b.key)));
};

const parseExclusions = (value: unknown): readonly ExclusionEntry[] => {
  if (!Array.isArray(value)) fail("Exclusions must be an array");
  const entries = value.map((entry) => {
    const raw = asRecord(entry, "exclusion count"); exact(raw, ["reasonClass", "count"], "exclusion count");
    return Object.freeze({ reasonClass: text(raw.reasonClass, "Exclusion reason"), count: nonnegativeInteger(raw.count, "Exclusion count") });
  });
  if (new Set(entries.map((entry) => entry.reasonClass)).size !== entries.length) fail("Duplicate exclusion reason");
  return Object.freeze(entries.sort((a, b) => a.reasonClass.localeCompare(b.reasonClass)));
};

const parseObservation = (value: unknown, criterion: Criterion): Observation => {
  const raw = asRecord(value, "gate observation");
  if (raw.availability === "AVAILABLE") {
    exact(raw, ["criterionId", "metricId", "formulaVersionId", "availability", "rawNumerators", "rawDenominator", "missingCount", "excludedByReason", "responseCount"], "available gate observation");
    const rawNumerators = parseCounts(raw.rawNumerators, "raw numerator");
    const rawDenominator = nonnegativeInteger(raw.rawDenominator, "Raw denominator");
    if (criterion.valueSource === "RATE" && rawNumerators.some((entry) => entry.value > rawDenominator)) fail("Rate numerator exceeds denominator");
    const observation = Object.freeze({ criterionId: text(raw.criterionId, "Observation criterion"), metricId: text(raw.metricId, "Observation metric"),
      formulaVersionId: text(raw.formulaVersionId, "Observation formula version"), availability: "AVAILABLE" as const, rawNumerators, rawDenominator,
      missingCount: nonnegativeInteger(raw.missingCount, "Observation missing count"), excludedByReason: parseExclusions(raw.excludedByReason),
      responseCount: nonnegativeInteger(raw.responseCount, "Observation response count") });
    if (!rawNumerators.some((entry) => entry.key === criterion.numeratorKey)) fail("Required numerator is missing from the observation");
    return observation;
  }
  if (raw.availability === "UNAVAILABLE") {
    exact(raw, ["criterionId", "metricId", "formulaVersionId", "availability", "unavailableReason"], "unavailable gate observation");
    const unavailableReason = text(raw.unavailableReason, "Unavailable evidence reason");
    if (!["MISSING_REQUIRED_OBSERVATION", "UNRESOLVED_REQUIRED_TREATMENT", "VALUE_UNAVAILABLE"].includes(unavailableReason)) fail("Unavailable evidence reason is invalid");
    return Object.freeze({ criterionId: text(raw.criterionId, "Observation criterion"), metricId: text(raw.metricId, "Observation metric"),
      formulaVersionId: text(raw.formulaVersionId, "Observation formula version"), availability: "UNAVAILABLE" as const, unavailableReason });
  }
  fail("Observation availability is invalid");
};

const outcome = (value: unknown, label: string): Outcome => {
  if (value !== "PASS" && value !== "FAIL" && value !== "INDETERMINATE") fail(`${label} is invalid`);
  return value;
};

const recommendation = (value: unknown): Recommendation => {
  if (value !== "OPEN" && value !== "DO_NOT_OPEN" && value !== "PAUSE") fail("Gate recommendation is invalid");
  return value;
};

const referenceArray = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a nonempty reference array`);
  const entries = value.map((entry) => text(entry, label));
  if (new Set(entries).size !== entries.length) fail(`${label} references must be distinct`);
  return Object.freeze([...entries].sort());
};

const compare = (value: number, comparator: Comparator, threshold: number): boolean =>
  comparator === "AT_LEAST" ? value >= threshold : comparator === "AT_MOST" ? value <= threshold : value === threshold;

const recommendationFor = (value: Outcome): Recommendation => value === "PASS" ? "OPEN" : value === "FAIL" ? "DO_NOT_OPEN" : "PAUSE";

export const evaluateDay7Gate = (value: unknown, authorityInput: unknown): Day7GateEvaluation => {
  const authority = requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const root = asRecord(value, "Day 7 gate input"); exact(root, ["lifecycle", "configuration", "report"], "Day 7 gate input");
  const lifecycle = requireLifecycle(root.lifecycle, authority);
  const configuration = parseConfiguration(root.configuration, lifecycle, authority);
  const report = asRecord(root.report, "signed Day 7 report");
  exact(report, ["reportId", "reportVersionId", "reportTemplateVersionId", "gateConfigurationVersionId", "lifecycleVersionId", "dayCalendarVersionId", "freezeAt", "observations", "criterionOutcomes", "overallOutcome", "recommendation", "viewReferenceIds", "incidentTreatmentReferenceIds", "inventoryReadinessReferenceId", "missingDataTreatmentReferenceId", "signedBy", "signerRole", "signatureId", "signedAt"], "signed Day 7 report");
  if (report.reportTemplateVersionId !== configuration.reportTemplateVersionId || report.gateConfigurationVersionId !== configuration.gateConfigurationVersionId ||
    report.lifecycleVersionId !== lifecycle.lifecycleVersionId || report.dayCalendarVersionId !== lifecycle.dayCalendarVersionId) fail("Signed report version references do not match the frozen gate");
  const freezeAt = canonicalInstant(report.freezeAt, "Day 7 freeze time");
  if (freezeAt !== lifecycle.day7FreezeAt) fail("Day 7 report must use the exact grace-end freeze");
  const signedAt = canonicalInstant(report.signedAt, "Report signature time");
  if (Date.parse(signedAt) < Date.parse(freezeAt)) fail("Day 7 report cannot be signed before freeze");
  const reportSignerName = text(report.signedBy, "Report signer");
  if (report.signerRole !== "GATE_REPORT_APPROVER") fail("Gate report approver role is required");
  const reportSignatureId = text(report.signatureId, "Report signature");
  const views = asRecord(report.viewReferenceIds, "report view references"); exact(views, ["mode", "day", "position", "cohort"], "report view references");
  const viewReferenceIds = Object.freeze({ mode: text(views.mode, "mode view reference"), day: text(views.day, "day view reference"),
    position: text(views.position, "position view reference"), cohort: text(views.cohort, "cohort view reference") });
  const incidentTreatmentReferenceIds = referenceArray(report.incidentTreatmentReferenceIds, "Incident treatment");
  const inventoryReadinessReferenceId = text(report.inventoryReadinessReferenceId, "Inventory readiness reference");
  const missingDataTreatmentReferenceId = text(report.missingDataTreatmentReferenceId, "Missing-data treatment reference");

  if (!Array.isArray(report.observations)) fail("Report observations must be an array");
  const rawObservations = new Map<string, unknown>();
  for (const entry of report.observations) {
    const raw = asRecord(entry, "gate observation");
    const criterionId = text(raw.criterionId, "Observation criterion");
    if (rawObservations.has(criterionId)) fail("Duplicate gate observation");
    rawObservations.set(criterionId, entry);
  }
  if (rawObservations.size !== configuration.criteria.length) fail("Every mandatory measure requires one report observation");

  if (!Array.isArray(report.criterionOutcomes)) fail("Criterion outcomes must be an array");
  const claimedOutcomes = new Map<string, Outcome>();
  for (const entry of report.criterionOutcomes) {
    const raw = asRecord(entry, "criterion outcome"); exact(raw, ["criterionId", "outcome"], "criterion outcome");
    const criterionId = text(raw.criterionId, "Outcome criterion");
    if (claimedOutcomes.has(criterionId)) fail("Duplicate criterion outcome");
    claimedOutcomes.set(criterionId, outcome(raw.outcome, "Criterion outcome"));
  }
  if (claimedOutcomes.size !== configuration.criteria.length) fail("Every criterion requires one claimed outcome");

  const criterionResults: Readonly<Record<string, unknown>>[] = [];
  const normalizedObservations: Observation[] = [];
  for (const criterion of configuration.criteria) {
    const rawObservation = rawObservations.get(criterion.criterionId);
    if (rawObservation === undefined) fail(`Mandatory observation is missing for ${criterion.criterionId}`);
    const observation = parseObservation(rawObservation, criterion);
    if (observation.criterionId !== criterion.criterionId || observation.metricId !== criterion.metricId || observation.formulaVersionId !== criterion.formulaVersionId) {
      fail("Observation metric or formula version drift");
    }
    normalizedObservations.push(observation);
    let calculatedOutcome: Outcome;
    let calculatedValue: number | null = null;
    if (observation.availability === "UNAVAILABLE") {
      calculatedOutcome = "INDETERMINATE";
      criterionResults.push(Object.freeze({ criterionId: criterion.criterionId, metricId: criterion.metricId, formulaVersionId: criterion.formulaVersionId,
        valueSource: criterion.valueSource, outcome: calculatedOutcome, calculatedValue, unavailableReason: observation.unavailableReason }));
    } else {
      const numerator = observation.rawNumerators.find((entry) => entry.key === criterion.numeratorKey)!.value;
      const insufficient = (criterion.valueSource === "RATE" && observation.rawDenominator === 0) ||
        observation.rawDenominator < criterion.minimumDenominator || observation.responseCount < criterion.minimumResponses ||
        observation.missingCount > criterion.maximumMissingCount;
      calculatedValue = criterion.valueSource === "RATE" && observation.rawDenominator !== 0 ? numerator / observation.rawDenominator : numerator;
      calculatedOutcome = insufficient ? "INDETERMINATE" : compare(calculatedValue, criterion.comparator, criterion.threshold) ? "PASS" : "FAIL";
      criterionResults.push(Object.freeze({ criterionId: criterion.criterionId, metricId: criterion.metricId, formulaVersionId: criterion.formulaVersionId,
        valueSource: criterion.valueSource, outcome: calculatedOutcome, calculatedValue, rawNumerators: observation.rawNumerators,
        rawDenominator: observation.rawDenominator, missingCount: observation.missingCount,
        excludedCount: observation.excludedByReason.reduce((sum, entry) => sum + entry.count, 0), excludedByReason: observation.excludedByReason,
        responseCount: observation.responseCount }));
    }
    if (claimedOutcomes.get(criterion.criterionId) !== calculatedOutcome) fail("Claimed criterion outcome does not reproduce");
  }
  for (const criterionId of rawObservations.keys()) if (!configuration.criteria.some((entry) => entry.criterionId === criterionId)) fail("Unknown gate observation criterion");
  for (const criterionId of claimedOutcomes.keys()) if (!configuration.criteria.some((entry) => entry.criterionId === criterionId)) fail("Unknown gate outcome criterion");
  criterionResults.sort((a, b) => String(a.criterionId).localeCompare(String(b.criterionId)));
  normalizedObservations.sort((a, b) => a.criterionId.localeCompare(b.criterionId));
  const outcomes = criterionResults.map((entry) => entry.outcome as Outcome);
  const overallOutcome: Outcome = outcomes.includes("FAIL") ? "FAIL" : outcomes.includes("INDETERMINATE") ? "INDETERMINATE" : "PASS";
  const expectedRecommendation = recommendationFor(overallOutcome);
  const claimedOverallOutcome = outcome(report.overallOutcome, "Report overall outcome");
  if (claimedOverallOutcome !== overallOutcome) fail("Report overall outcome does not reproduce");
  const claimedRecommendation = recommendation(report.recommendation);
  if (claimedRecommendation !== expectedRecommendation) fail("Report recommendation does not reproduce");

  const normalizedOutcomes = Object.freeze([...claimedOutcomes.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([criterionId, criterionOutcome]) => Object.freeze({ criterionId, outcome: criterionOutcome })));
  const unsignedReport = Object.freeze({ reportId: text(report.reportId, "Report identity"), reportVersionId: text(report.reportVersionId, "Report version"),
    reportTemplateVersionId: configuration.reportTemplateVersionId, gateConfigurationVersionId: configuration.gateConfigurationVersionId,
    lifecycleVersionId: lifecycle.lifecycleVersionId, dayCalendarVersionId: lifecycle.dayCalendarVersionId, freezeAt,
    observations: Object.freeze(normalizedObservations), criterionOutcomes: normalizedOutcomes, overallOutcome: claimedOverallOutcome,
    recommendation: claimedRecommendation, viewReferenceIds, incidentTreatmentReferenceIds, inventoryReadinessReferenceId,
    missingDataTreatmentReferenceId, signedBy: reportSignerName, signerRole: "GATE_REPORT_APPROVER", signedAt });
  if (!verifyApproval(authority, "DAY7_REPORT", reportSignerName, "GATE_REPORT_APPROVER", signedAt, reportSignatureId, unsignedReport)) {
    fail("Day 7 report signature authority verification failed");
  }
  const evaluation = Object.freeze({ reportId: unsignedReport.reportId, reportVersionId: unsignedReport.reportVersionId,
    reportTemplateVersionId: configuration.reportTemplateVersionId, gateConfigurationVersionId: configuration.gateConfigurationVersionId,
    lifecycleVersionId: lifecycle.lifecycleVersionId, dayCalendarVersionId: lifecycle.dayCalendarVersionId, freezeAt, reportSignedAt: signedAt,
    reportSignerName, reportSignerRole: "GATE_REPORT_APPROVER" as const, reportSignatureId,
    gateConfigurationSignedAt: configuration.signedAt, gateConfigurationSignatureId: configuration.signatureId,
    viewReferenceIds, incidentTreatmentReferenceIds, inventoryReadinessReferenceId, missingDataTreatmentReferenceId,
    criterionResults: Object.freeze(criterionResults), overallOutcome, recommendation: expectedRecommendation });
  return registerGateEvaluation(evaluation, authority);
};

const parseDecision = (value: unknown): ParsedDecision => {
  const raw = asRecord(value, "continuation decision");
  const hasRationale = Object.hasOwn(raw, "departureRationale");
  exact(raw, hasRationale
    ? ["decisionId", "idempotencyKey", "decision", "reportId", "reportVersionId", "signedBy", "signatureId", "signedAt", "operator", "departureRationale"]
    : ["decisionId", "idempotencyKey", "decision", "reportId", "reportVersionId", "signedBy", "signatureId", "signedAt", "operator"], "continuation decision");
  const operator = asRecord(raw.operator, "release operator"); exact(operator, ["name", "role"], "release operator");
  const signedAt = canonicalInstant(raw.signedAt, "Continuation decision time");
  const rawIdempotencyKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : "";
  const normalized = Object.freeze({ decisionId: text(raw.decisionId, "Continuation decision identity"),
    idempotencyKey: rawIdempotencyKey, decision: raw.decision,
    reportId: text(raw.reportId, "Decision report identity"), reportVersionId: text(raw.reportVersionId, "Decision report version"),
    signedBy: raw.signedBy, signedAt, operator: Object.freeze({ name: text(operator.name, "Release operator name"), role: operator.role }),
    ...(hasRationale ? { departureRationale: deepDetach(raw.departureRationale) } : {}), signatureId: raw.signatureId });
  return Object.freeze({ decisionId: normalized.decisionId, idempotencyKey: rawIdempotencyKey.trim(), decision: normalized.decision,
    reportId: normalized.reportId, reportVersionId: normalized.reportVersionId, signedBy: normalized.signedBy,
    signatureId: normalized.signatureId, signedAt, operatorName: normalized.operator.name, operatorRole: normalized.operator.role,
    departureRationale: hasRationale ? normalized.departureRationale : undefined, normalized, digest: canonicalJson(normalized) });
};

const unsignedDecision = (decision: ParsedDecision): Readonly<Record<string, unknown>> => {
  const payload: RecordValue = { ...decision.normalized };
  delete payload.signatureId;
  return Object.freeze(payload);
};

const decisionSignatureValid = (decision: ParsedDecision, authority: AuthorityVerifier): boolean =>
  decision.signedBy === "Don" && typeof decision.signatureId === "string" && decision.signatureId.trim().length > 0 &&
  verifyApproval(authority, "DAY8_OPEN_DECISION", "Don", "DON", decision.signedAt, decision.signatureId, unsignedDecision(decision));

const validateRationale = (value: unknown, evaluation: Day7GateEvaluation, decisionAt: string, authority: AuthorityVerifier): RationaleReferences | null => {
  if (value === undefined) return null;
  try {
    const raw = asRecord(value, "departure rationale");
    exact(raw, ["referenceId", "reportId", "signedBy", "signatureId", "signedAt"], "departure rationale");
    const referenceId = text(raw.referenceId, "Departure rationale reference");
    if (raw.reportId !== evaluation.reportId || raw.signedBy !== "Don") return null;
    const signatureId = text(raw.signatureId, "Departure rationale signature");
    const signedAt = canonicalInstant(raw.signedAt, "Departure rationale signature time");
    if (Date.parse(signedAt) < Date.parse(evaluation.reportSignedAt) || Date.parse(signedAt) > Date.parse(decisionAt)) return null;
    const unsignedRationale = Object.freeze({ referenceId, reportId: evaluation.reportId, signedBy: "Don", signedAt });
    if (!verifyApproval(authority, "DAY8_DEPARTURE_RATIONALE", "Don", "DON", signedAt, signatureId, unsignedRationale)) return null;
    return Object.freeze({ referenceId, signatureId });
  } catch { return null; }
};

const nextMidnight = (instant: string): string => {
  const parsed = new Date(instant);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate() + 1)).toISOString();
};

const attempt = (outcomeValue: "ALLOWED" | "DENIED", reason: string, occurredAt: string): AuthorizationAttempt =>
  Object.freeze({ outcome: outcomeValue, reason, occurredAt });

const sealAuthorizationState = <T extends Readonly<Record<string, unknown>>>(state: T,
  auditIntegrity: AuditIntegrity): T & { readonly stateIntegritySeal: string } => {
  let rawSeal: unknown;
  try { rawSeal = auditIntegrity.seal(canonicalJson(state)); }
  catch { fail("Authorization state integrity seal generation failed"); }
  return Object.freeze({ ...state, stateIntegritySeal: text(rawSeal, "Authorization state integrity seal") });
};

const audit = (sequence: number, outcomeValue: "ALLOWED" | "DENIED", occurredAt: string, operatorName: string,
  decision: ParsedDecision, rationale: RationaleReferences | null, reason: string | null,
  auditIntegrity: AuditIntegrity): AuthorizationAuditRecord => {
  const unsignedRecord = Object.freeze({
    sequence, action: "AUTHORIZE_DAY8" as const, outcome: outcomeValue, occurredAt, operatorName,
    operatorRole: typeof decision.operatorRole === "string" && decision.operatorRole.trim().length > 0 ? decision.operatorRole : "INVALID",
    decisionId: decision.decisionId, decisionDigest: decision.digest, reportId: decision.reportId, reportVersionId: decision.reportVersionId,
    decisionSignatureId: typeof decision.signatureId === "string" && decision.signatureId.trim().length > 0 ? decision.signatureId : "INVALID",
    departureRationaleReferenceId: rationale?.referenceId ?? null, departureRationaleSignatureId: rationale?.signatureId ?? null, reason,
    signedDecision: deepDetach(decision.normalized),
  });
  let rawSeal: unknown;
  try { rawSeal = auditIntegrity.seal(canonicalJson(unsignedRecord)); }
  catch { fail("Authorization audit integrity seal generation failed"); }
  return Object.freeze({ ...unsignedRecord, integritySeal: text(rawSeal, "Authorization audit integrity seal") });
};

const denial = (reason: string, prior: Day8Authorization | null, occurredAt: string, decision: ParsedDecision,
  rationale: RationaleReferences | null, auditIntegrity: AuditIntegrity): Day8Authorization => {
  const records = freezeAuditRecords([...(prior?.auditRecords ?? []),
    audit((prior?.auditRecords.length ?? 0) + 1, "DENIED", occurredAt, decision.operatorName, decision, rationale, reason, auditIntegrity)]);
  const lastAttempt = attempt("DENIED", reason, occurredAt);
  if (prior?.allowed === true) {
    return sealAuthorizationState(Object.freeze({ allowed: true as const, reason: "AUTHORIZED" as const, day8Start: prior.day8Start,
      decisionId: prior.decisionId, idempotencyKey: prior.idempotencyKey, reportId: prior.reportId, reportVersionId: prior.reportVersionId,
      lifecycleVersionId: prior.lifecycleVersionId, decisionDigest: prior.decisionDigest, signedDecision: deepDetach(prior.signedDecision),
      departureRationaleReferenceId: prior.departureRationaleReferenceId,
      departureRationaleSignatureId: prior.departureRationaleSignatureId, lastAttempt, auditRecords: records }), auditIntegrity);
  }
  return sealAuthorizationState(Object.freeze({ allowed: false as const, reason, lastAttempt, auditRecords: records }), auditIntegrity);
};

const parseAttempt = (value: unknown): AuthorizationAttempt => {
  const raw = asRecord(value, "authorization attempt"); exact(raw, ["outcome", "reason", "occurredAt"], "authorization attempt");
  if (raw.outcome !== "ALLOWED" && raw.outcome !== "DENIED") fail("Authorization attempt outcome is invalid");
  return Object.freeze({ outcome: raw.outcome, reason: text(raw.reason, "Authorization attempt reason"),
    occurredAt: canonicalInstant(raw.occurredAt, "Authorization attempt time") });
};

const nullableText = (value: unknown, label: string): string | null => value === null ? null : text(value, label);

const parseAudits = (value: unknown, authority: AuthorityVerifier, auditIntegrity: AuditIntegrity): readonly AuthorizationAuditRecord[] => {
  if (!Array.isArray(value) || value.length === 0) fail("Authorization audit lineage must be nonempty");
  const records = value.map((entry, index) => {
    const raw = asRecord(entry, "authorization audit record");
    exact(raw, ["sequence", "action", "outcome", "occurredAt", "operatorName", "operatorRole", "decisionId", "decisionDigest", "reportId", "reportVersionId", "decisionSignatureId", "departureRationaleReferenceId", "departureRationaleSignatureId", "reason", "signedDecision", "integritySeal"], "authorization audit record");
    if (raw.sequence !== index + 1 || raw.action !== "AUTHORIZE_DAY8" || (raw.outcome !== "ALLOWED" && raw.outcome !== "DENIED")) {
      fail("Authorization audit lineage is invalid");
    }
    const reason = nullableText(raw.reason, "Authorization audit reason");
    if ((raw.outcome === "ALLOWED") !== (reason === null)) fail("Authorization audit outcome/reason is inconsistent");
    const rationaleReferenceId = nullableText(raw.departureRationaleReferenceId, "Audit rationale reference");
    const rationaleSignatureId = nullableText(raw.departureRationaleSignatureId, "Audit rationale signature");
    if ((rationaleReferenceId === null) !== (rationaleSignatureId === null)) fail("Authorization audit rationale lineage is incomplete");
    const signedDecision = parseDecision(raw.signedDecision);
    const signatureValid = decisionSignatureValid(signedDecision, authority);
    if ((raw.outcome === "ALLOWED" || (reason !== "DON_SIGNATURE_REQUIRED" && reason !== "DECISION_SIGNATURE_INVALID")) && !signatureValid) {
      fail("Authorization audit signed decision is not verified");
    }
    if (reason === "DON_SIGNATURE_REQUIRED" && signedDecision.signedBy === "Don" &&
      typeof signedDecision.signatureId === "string" && signedDecision.signatureId.trim().length > 0) fail("Authorization audit denial reason is invalid");
    if (reason === "DECISION_SIGNATURE_INVALID" && signatureValid) fail("Authorization audit denial reason is invalid");
    const operatorRole = text(raw.operatorRole, "Audit operator role");
    const decisionSignatureId = text(raw.decisionSignatureId, "Audit decision signature");
    const expectedSignatureId = typeof signedDecision.signatureId === "string" && signedDecision.signatureId.trim().length > 0
      ? signedDecision.signatureId : "INVALID";
    if (raw.operatorName !== signedDecision.operatorName || operatorRole !== signedDecision.operatorRole ||
      raw.decisionId !== signedDecision.decisionId || raw.decisionDigest !== signedDecision.digest || raw.reportId !== signedDecision.reportId ||
      raw.reportVersionId !== signedDecision.reportVersionId || decisionSignatureId !== expectedSignatureId) {
      fail("Authorization audit is not bound to its signed decision envelope");
    }
    const unsignedRecord = Object.freeze({ sequence: index + 1, action: "AUTHORIZE_DAY8" as const, outcome: raw.outcome,
      occurredAt: canonicalInstant(raw.occurredAt, "Authorization audit time"), operatorName: text(raw.operatorName, "Audit operator name"),
      operatorRole, decisionId: text(raw.decisionId, "Audit decision identity"),
      decisionDigest: text(raw.decisionDigest, "Audit decision digest"), reportId: text(raw.reportId, "Audit report identity"),
      reportVersionId: text(raw.reportVersionId, "Audit report version"), decisionSignatureId,
      departureRationaleReferenceId: rationaleReferenceId, departureRationaleSignatureId: rationaleSignatureId, reason,
      signedDecision: deepDetach(signedDecision.normalized) });
    const integritySeal = text(raw.integritySeal, "Authorization audit integrity seal");
    let integrityValid = false;
    try { integrityValid = auditIntegrity.verify(canonicalJson(unsignedRecord), integritySeal); }
    catch { integrityValid = false; }
    if (!integrityValid) fail("Authorization audit integrity seal is invalid");
    return Object.freeze({ ...unsignedRecord, integritySeal });
  });
  return Object.freeze(records);
};

const parseStoredAuthorization = (value: unknown, lifecycle: UtcBetaLifecycle, evaluation: Day7GateEvaluation | null,
  authority: AuthorityVerifier, auditIntegrity: AuditIntegrity): Day8Authorization => {
  assertDeepFrozen(value);
  const raw = asRecord(value, "stored Day 8 authorization");
  const stateIntegritySeal = text(raw.stateIntegritySeal, "Stored authorization state integrity seal");
  const unsignedStored: RecordValue = { ...raw };
  delete unsignedStored.stateIntegritySeal;
  let stateIntegrityValid = false;
  try { stateIntegrityValid = auditIntegrity.verify(canonicalJson(unsignedStored), stateIntegritySeal); }
  catch { stateIntegrityValid = false; }
  if (!stateIntegrityValid) fail("Stored authorization state integrity seal is invalid");
  if (raw.allowed === false) {
    exact(raw, ["allowed", "reason", "lastAttempt", "auditRecords", "stateIntegritySeal"], "stored denied Day 8 authorization");
    const reason = text(raw.reason, "Stored authorization reason");
    const lastAttempt = parseAttempt(raw.lastAttempt);
    const auditRecords = parseAudits(raw.auditRecords, authority, auditIntegrity);
    if (lastAttempt.outcome !== "DENIED" || lastAttempt.reason !== reason ||
      auditRecords.some((entry) => entry.outcome === "ALLOWED")) fail("Denied authorization state is not terminally consistent");
    const last = auditRecords[auditRecords.length - 1]!;
    if (last.outcome !== lastAttempt.outcome || last.reason !== lastAttempt.reason || last.occurredAt !== lastAttempt.occurredAt) fail("Stored authorization attempt does not match audit tail");
    return registerAuthorization(Object.freeze({ allowed: false as const, reason, lastAttempt, auditRecords, stateIntegritySeal }), authority);
  }
  if (raw.allowed !== true) fail("Stored authorization allowed state is invalid");
  exact(raw, ["allowed", "reason", "day8Start", "decisionId", "idempotencyKey", "reportId", "reportVersionId", "lifecycleVersionId",
    "decisionDigest", "signedDecision", "departureRationaleReferenceId", "departureRationaleSignatureId", "lastAttempt", "auditRecords",
    "stateIntegritySeal"],
  "stored allowed Day 8 authorization");
  if (raw.reason !== "AUTHORIZED" || evaluation === null) fail("Stored allowed authorization provenance is invalid");
  const decision = parseDecision(raw.signedDecision);
  if (!decisionSignatureValid(decision, authority)) fail("Stored decision signature is invalid");
  const rationale = validateRationale(decision.departureRationale, evaluation, decision.signedAt, authority);
  if (evaluation.recommendation !== "OPEN" && rationale === null) fail("Stored departure rationale is invalid");
  const departureRationaleReferenceId = nullableText(raw.departureRationaleReferenceId, "Stored rationale reference");
  const departureRationaleSignatureId = nullableText(raw.departureRationaleSignatureId, "Stored rationale signature");
  if (departureRationaleReferenceId !== (rationale?.referenceId ?? null) || departureRationaleSignatureId !== (rationale?.signatureId ?? null)) {
    fail("Stored rationale lineage is invalid");
  }
  const day8Start = canonicalInstant(raw.day8Start, "Stored Day 8 start");
  const decisionId = text(raw.decisionId, "Stored decision identity");
  const idempotencyKey = text(raw.idempotencyKey, "Stored idempotency key");
  const reportId = text(raw.reportId, "Stored report identity");
  const reportVersionId = text(raw.reportVersionId, "Stored report version");
  const lifecycleVersionId = text(raw.lifecycleVersionId, "Stored lifecycle version");
  const decisionDigest = text(raw.decisionDigest, "Stored decision digest");
  if (day8Start !== nextMidnight(decision.signedAt) || decisionId !== decision.decisionId || idempotencyKey !== decision.idempotencyKey ||
    reportId !== decision.reportId || reportVersionId !== decision.reportVersionId || lifecycleVersionId !== lifecycle.lifecycleVersionId ||
    reportId !== evaluation.reportId || reportVersionId !== evaluation.reportVersionId || decisionDigest !== decision.digest) {
    fail("Stored allowed authorization binding is invalid");
  }
  const lastAttempt = parseAttempt(raw.lastAttempt);
  const auditRecords = parseAudits(raw.auditRecords, authority, auditIntegrity);
  const allowedRecords = auditRecords.filter((entry) => entry.outcome === "ALLOWED");
  if (allowedRecords.length !== 1) fail("Stored authorization must contain exactly one accepted transition");
  const accepted = allowedRecords[0]!;
  if (accepted.decisionId !== decisionId || accepted.decisionDigest !== decisionDigest || accepted.reportId !== reportId ||
    accepted.reportVersionId !== reportVersionId || accepted.decisionSignatureId !== decision.signatureId ||
    accepted.operatorName !== decision.operatorName || accepted.operatorRole !== "RELEASE_OPERATOR" ||
    accepted.departureRationaleReferenceId !== departureRationaleReferenceId || accepted.departureRationaleSignatureId !== departureRationaleSignatureId) {
    fail("Stored accepted audit does not match authorization");
  }
  const tail = auditRecords[auditRecords.length - 1]!;
  if (tail.outcome !== lastAttempt.outcome || (tail.reason ?? "AUTHORIZED") !== lastAttempt.reason || tail.occurredAt !== lastAttempt.occurredAt) {
    fail("Stored authorization attempt does not match audit tail");
  }
  return registerAuthorization(Object.freeze({ allowed: true as const, reason: "AUTHORIZED" as const, day8Start, decisionId, idempotencyKey,
    reportId, reportVersionId, lifecycleVersionId, decisionDigest, signedDecision: deepDetach(decision.normalized),
    departureRationaleReferenceId, departureRationaleSignatureId, lastAttempt, auditRecords, stateIntegritySeal }), authority);
};

const authorizationReason = (decision: ParsedDecision, lifecycle: UtcBetaLifecycle, evaluation: Day7GateEvaluation | null,
  authority: AuthorityVerifier): { readonly reason: string | null; readonly rationale: RationaleReferences | null } => {
  if (decision.operatorRole !== "RELEASE_OPERATOR") return { reason: "RELEASE_OPERATOR_REQUIRED", rationale: null };
  if (!authenticatedOperator(authority, decision.operatorName)) return { reason: "AUTHENTICATED_RELEASE_OPERATOR_REQUIRED", rationale: null };
  if (decision.idempotencyKey.length === 0) return { reason: "IDEMPOTENCY_KEY_REQUIRED", rationale: null };
  if (decision.signedBy !== "Don" || typeof decision.signatureId !== "string" || decision.signatureId.trim().length === 0) {
    return { reason: "DON_SIGNATURE_REQUIRED", rationale: null };
  }
  if (!decisionSignatureValid(decision, authority)) return { reason: "DECISION_SIGNATURE_INVALID", rationale: null };
  if (evaluation === null || evaluation.lifecycleVersionId !== lifecycle.lifecycleVersionId || evaluation.freezeAt !== lifecycle.day7FreezeAt) {
    return { reason: "REPORT_EVALUATION_INVALID", rationale: null };
  }
  if (decision.decision !== "OPEN") return { reason: "OPEN_DECISION_REQUIRED", rationale: null };
  if (decision.reportId !== evaluation.reportId || decision.reportVersionId !== evaluation.reportVersionId) {
    return { reason: "REPORT_REFERENCE_MISMATCH", rationale: null };
  }
  if (Date.parse(decision.signedAt) < Date.parse(evaluation.reportSignedAt)) return { reason: "DECISION_CHRONOLOGY_INVALID", rationale: null };
  const rationale = validateRationale(decision.departureRationale, evaluation, decision.signedAt, authority);
  if (evaluation.recommendation !== "OPEN" && rationale === null) return { reason: "SIGNED_DEPARTURE_RATIONALE_REQUIRED", rationale: null };
  return { reason: null, rationale };
};

const requireServices = (value: unknown): Day8AuthorizationServices => {
  const raw = asRecord(value, "Day 8 authorization services");
  const authority = requireAuthority(raw.authority);
  const auditIntegrity = asRecord(raw.auditIntegrity, "authorization audit integrity service");
  const clock = asRecord(raw.clock, "authoritative server clock");
  const store = asRecord(raw.store, "Day 8 authorization store");
  if (typeof auditIntegrity.seal !== "function" || typeof auditIntegrity.verify !== "function" ||
    typeof clock.now !== "function" || typeof store.transact !== "function") fail("Day 8 authorization services are invalid");
  return { authority, auditIntegrity: raw.auditIntegrity as AuditIntegrity,
    clock: raw.clock as Day8AuthorizationServices["clock"], store: raw.store as Day8AuthorizationServices["store"] };
};

export const authorizeDay8 = (value: unknown, servicesInput: unknown): Day8Authorization => {
  const services = requireServices(servicesInput);
  assertDeepFrozen(value);
  const root = asRecord(value, "Day 8 authorization input");
  exact(root, ["lifecycle", "evaluation", "decision"], "Day 8 authorization input");
  const lifecycle = requireLifecycle(root.lifecycle, services.authority);
  const decision = parseDecision(root.decision);
  const occurredAt = canonicalInstant(services.clock.now(), "Authoritative server UTC action time");
  const evaluation = isGateEvaluation(root.evaluation, services.authority) ? root.evaluation : null;
  const authorization = authorizationReason(decision, lifecycle, evaluation, services.authority);
  const scopeKey = `day8:${lifecycle.lifecycleVersionId}`;
  const stored = services.store.transact(scopeKey, (priorValue) => {
    let prior: Day8Authorization | null = null;
    if (priorValue !== null) {
      try { prior = parseStoredAuthorization(priorValue, lifecycle, evaluation, services.authority, services.auditIntegrity); }
      catch { fail("Stored Day 8 authorization state is corrupt; transaction aborted without overwrite"); }
    }
    if (prior?.allowed === true) {
      if (decision.idempotencyKey === prior.idempotencyKey && decision.digest === prior.decisionDigest && authorization.reason === null) {
        return deepDetach(prior);
      }
      if (decision.idempotencyKey === prior.idempotencyKey && authorization.reason === null) {
        return denial("IDEMPOTENCY_REPLAY_DRIFT", prior, occurredAt, decision, authorization.rationale, services.auditIntegrity);
      }
      return denial(authorization.reason ?? "DAY8_ALREADY_AUTHORIZED", prior, occurredAt, decision, authorization.rationale, services.auditIntegrity);
    }
    if (authorization.reason !== null || evaluation === null) {
      return denial(authorization.reason ?? "REPORT_EVALUATION_INVALID", prior, occurredAt, decision, authorization.rationale, services.auditIntegrity);
    }
    const auditRecords = freezeAuditRecords([...(prior?.auditRecords ?? []),
      audit((prior?.auditRecords.length ?? 0) + 1, "ALLOWED", occurredAt, decision.operatorName, decision, authorization.rationale, null, services.auditIntegrity)]);
    return sealAuthorizationState(Object.freeze({ allowed: true as const, reason: "AUTHORIZED" as const, day8Start: nextMidnight(decision.signedAt),
      decisionId: decision.decisionId, idempotencyKey: decision.idempotencyKey, reportId: evaluation.reportId,
      reportVersionId: evaluation.reportVersionId, lifecycleVersionId: lifecycle.lifecycleVersionId, decisionDigest: decision.digest,
      signedDecision: deepDetach(decision.normalized), departureRationaleReferenceId: authorization.rationale?.referenceId ?? null,
      departureRationaleSignatureId: authorization.rationale?.signatureId ?? null, lastAttempt: attempt("ALLOWED", "AUTHORIZED", occurredAt),
      auditRecords }), services.auditIntegrity);
  });
  return parseStoredAuthorization(stored, lifecycle, evaluation, services.authority, services.auditIntegrity);
};

export type { Day7GateEvaluation, Day8Authorization } from "./types.js";
