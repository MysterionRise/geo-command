import {
  AUTHORITATIVE_EVENT_SCHEMA_VERSION,
  parseAuthoritativeEventBatch,
  type AuthoritativeEvent,
} from "../events/index.js";

export class FormulaRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FormulaRuleError";
  }
}

export type RecordValue = Record<string, unknown>;

export const FORMULA_VERSION_FIELDS = Object.freeze([
  "formulaVersionId", "eventSchemaVersionId", "eligibilityVersionId", "consentVersionId",
  "incidentVersionId", "correctionVersionId", "candidateSetRegistryVersionId", "modeVersionId",
  "dayVersionId", "positionVersionId", "cohortVersionId", "instrumentRegistryVersionId",
] as const);

export interface FormulaVersions {
  readonly formulaVersionId: string;
  readonly eventSchemaVersionId: typeof AUTHORITATIVE_EVENT_SCHEMA_VERSION;
  readonly eligibilityVersionId: string;
  readonly consentVersionId: string;
  readonly incidentVersionId: string;
  readonly correctionVersionId: string;
  readonly candidateSetRegistryVersionId: string;
  readonly modeVersionId: string;
  readonly dayVersionId: string;
  readonly positionVersionId: string;
  readonly cohortVersionId: string;
  readonly instrumentRegistryVersionId: string;
}

export type AnalysisDisposition =
  | Readonly<{ participantLineageId: string; state: "PENDING" | "INCLUDED" }>
  | Readonly<{
      participantLineageId: string;
      state: "EXCLUDED";
      reasonClass: string;
      effectiveAt: string;
      approverId: string;
      formulaTreatment: string;
    }>;

export interface VoluntaryReturnOpportunity {
  readonly participantLineageId: string;
  readonly precedingDay: string;
  readonly nextActiveDay: string;
  readonly fullWindowObserved: boolean;
  readonly consented: boolean;
  readonly eligible: boolean;
  readonly unrevoked: boolean;
  readonly platformIncidentBlocked: boolean;
  readonly dayVersionId: string;
  readonly incidentVersionId: string;
}

export interface ComprehensionScoringKey {
  readonly instrumentVersionId: string;
  readonly understandingResponseIds: readonly string[];
  readonly nonUnderstandingResponseIds: readonly string[];
}

export interface ChanceFormulaInput {
  readonly versions: FormulaVersions;
  readonly events: readonly AuthoritativeEvent[];
  readonly analysisDispositions: readonly AnalysisDisposition[];
}

export interface CoherenceFormulaInput extends ChanceFormulaInput {
  readonly voluntaryReturnOpportunities: readonly VoluntaryReturnOpportunity[];
  readonly comprehensionScoringKeys: readonly ComprehensionScoringKey[];
  readonly observationBoundary: string;
}

export type ExcludedByReason = Readonly<{ reasonClass: string; count: number }>;

export type MetricResult<N extends Readonly<Record<string, number>>> = Readonly<{
  measureId: string;
  versions: FormulaVersions;
  rawNumerators: N;
  rawDenominator: number;
  missingCount: number;
  excludedCount: number;
  excludedByReason: readonly ExcludedByReason[];
  rates: Readonly<{ [K in keyof N]: number | null }>;
}>;

export function fail(message: string): never {
  throw new FormulaRuleError(message);
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
  if (!Object.isFrozen(value)) fail("Formula input must be recursively frozen at the boundary");
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
};

export const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${field} must be nonblank`);
  return value;
};

export const utc = (value: unknown, field: string): string => {
  const candidate = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate) || Number.isNaN(Date.parse(candidate)) || new Date(candidate).toISOString() !== candidate) {
    fail(`${field} must be a canonical UTC instant`);
  }
  return candidate;
};

export const day = (value: unknown, field: string): string => {
  const candidate = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate) || new Date(`${candidate}T00:00:00.000Z`).toISOString().slice(0, 10) !== candidate) fail(`${field} must be a valid UTC day`);
  return candidate;
};

const boolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") fail(`${field} must be boolean`);
  return value;
};

export const parseVersions = (value: unknown): FormulaVersions => {
  const raw = asRecord(value, "versions");
  exact(raw, FORMULA_VERSION_FIELDS, "versions");
  const parsed = Object.fromEntries(FORMULA_VERSION_FIELDS.map((field) => [field, text(raw[field], field)])) as unknown as FormulaVersions;
  if (parsed.eventSchemaVersionId !== AUTHORITATIVE_EVENT_SCHEMA_VERSION) fail("Event schema version does not match authoritative-events-v1");
  return Object.freeze({ ...parsed });
};

const parseDispositions = (value: unknown, observationBoundary?: string): readonly AnalysisDisposition[] => {
  if (!Array.isArray(value)) fail("analysisDispositions must be an array");
  const seen = new Set<string>();
  const parsed = value.map((entry) => {
    const raw = asRecord(entry, "analysis disposition");
    const state = text(raw.state, "analysis state");
    const fields = state === "EXCLUDED"
      ? ["participantLineageId", "state", "reasonClass", "effectiveAt", "approverId", "formulaTreatment"]
      : ["participantLineageId", "state"];
    exact(raw, fields, "analysis disposition");
    const participantLineageId = text(raw.participantLineageId, "participantLineageId");
    if (seen.has(participantLineageId)) fail("Duplicate participant analysis disposition");
    seen.add(participantLineageId);
    if (state === "PENDING" || state === "INCLUDED") return Object.freeze({ participantLineageId, state });
    if (state !== "EXCLUDED") fail("Unknown analysis state");
    const reasonClass = text(raw.reasonClass, "exclusion reason");
    if (!["AUTHENTICATED_WITHDRAWAL", "INVALID_ELIGIBILITY", "OPERATIONAL_TESTER", "DUPLICATE_LINEAGE", "SIGNED_INTEGRITY_EXCLUSION"].includes(reasonClass)) fail("Unknown exclusion reason class");
    const effectiveAt = utc(raw.effectiveAt, "exclusion effectiveAt");
    if (observationBoundary !== undefined && effectiveAt > observationBoundary) fail("Exclusion disposition effectiveAt exceeds the observation boundary");
    return Object.freeze({ participantLineageId, state, reasonClass,
      effectiveAt, approverId: text(raw.approverId, "exclusion approver"),
      formulaTreatment: text(raw.formulaTreatment, "exclusion formula treatment") });
  });
  return Object.freeze(parsed.sort((a, b) => a.participantLineageId.localeCompare(b.participantLineageId)));
};

const parseEvents = (value: unknown): readonly AuthoritativeEvent[] => {
  if (!Array.isArray(value)) fail("events must be an array");
  const reparsed = parseAuthoritativeEventBatch(value);
  return Object.freeze([...reparsed].sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt) || a.eventId.localeCompare(b.eventId)));
};

const validateEventVersionBindings = (events: readonly AuthoritativeEvent[], versions: FormulaVersions): void => {
  for (const event of events) {
    if (event.eventFamilyId === "SESSION_STARTED" &&
      (event.eligibilityVersionId !== versions.eligibilityVersionId || event.consentVersionId !== versions.consentVersionId)) {
      fail("Session start eligibility or consent version drift");
    }
    if ((event.eventFamilyId === "ROUND_CORRECTED" || event.eventFamilyId === "CORRECTION_NOTICE_ACKNOWLEDGED") &&
      event.correctionVersionId !== versions.correctionVersionId) fail("Correction version drift");
  }
};

const parseOpportunities = (value: unknown, versions: FormulaVersions): readonly VoluntaryReturnOpportunity[] => {
  if (!Array.isArray(value)) fail("voluntaryReturnOpportunities must be an array");
  const seen = new Set<string>();
  const fields = ["participantLineageId", "precedingDay", "nextActiveDay", "fullWindowObserved", "consented", "eligible", "unrevoked", "platformIncidentBlocked", "dayVersionId", "incidentVersionId"];
  const parsed = value.map((entry) => {
    const raw = asRecord(entry, "voluntary-return opportunity"); exact(raw, fields, "voluntary-return opportunity");
    const opportunity = Object.freeze({ participantLineageId: text(raw.participantLineageId, "opportunity participant"),
      precedingDay: day(raw.precedingDay, "precedingDay"), nextActiveDay: day(raw.nextActiveDay, "nextActiveDay"),
      fullWindowObserved: boolean(raw.fullWindowObserved, "fullWindowObserved"), consented: boolean(raw.consented, "consented"),
      eligible: boolean(raw.eligible, "eligible"), unrevoked: boolean(raw.unrevoked, "unrevoked"),
      platformIncidentBlocked: boolean(raw.platformIncidentBlocked, "platformIncidentBlocked"),
      dayVersionId: text(raw.dayVersionId, "opportunity day version"), incidentVersionId: text(raw.incidentVersionId, "opportunity incident version") });
    if (opportunity.dayVersionId !== versions.dayVersionId || opportunity.incidentVersionId !== versions.incidentVersionId) fail("Opportunity version binding is invalid");
    const identity = `${opportunity.participantLineageId}|${opportunity.precedingDay}|${opportunity.nextActiveDay}`;
    if (seen.has(identity)) fail("Duplicate voluntary-return opportunity"); seen.add(identity);
    return opportunity;
  });
  return Object.freeze(parsed.sort((a, b) => a.participantLineageId.localeCompare(b.participantLineageId) || a.precedingDay.localeCompare(b.precedingDay)));
};

const identifiers = (value: unknown, field: string): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must be a nonempty response array`);
  const parsed = value.map((entry) => text(entry, field));
  if (new Set(parsed).size !== parsed.length) fail(`${field} responses must be distinct`);
  return Object.freeze([...parsed].sort());
};

const parseKeys = (value: unknown): readonly ComprehensionScoringKey[] => {
  if (!Array.isArray(value)) fail("comprehensionScoringKeys must be an array");
  const seen = new Set<string>();
  const parsed = value.map((entry) => {
    const raw = asRecord(entry, "comprehension scoring key");
    exact(raw, ["instrumentVersionId", "understandingResponseIds", "nonUnderstandingResponseIds"], "comprehension scoring key");
    const instrumentVersionId = text(raw.instrumentVersionId, "instrumentVersionId");
    if (seen.has(instrumentVersionId)) fail("Duplicate instrument scoring key"); seen.add(instrumentVersionId);
    const understandingResponseIds = identifiers(raw.understandingResponseIds, "understandingResponseIds");
    const nonUnderstandingResponseIds = identifiers(raw.nonUnderstandingResponseIds, "nonUnderstandingResponseIds");
    if (understandingResponseIds.some((id) => nonUnderstandingResponseIds.includes(id))) fail("Comprehension response classes overlap");
    return Object.freeze({ instrumentVersionId, understandingResponseIds, nonUnderstandingResponseIds });
  });
  return Object.freeze(parsed.sort((a, b) => a.instrumentVersionId.localeCompare(b.instrumentVersionId)));
};

export const parseChanceInput = (value: unknown): ChanceFormulaInput => {
  assertDeepFrozen(value);
  const raw = asRecord(value, "chance formula input"); exact(raw, ["versions", "events", "analysisDispositions"], "chance formula input");
  const versions = parseVersions(raw.versions);
  const events = parseEvents(raw.events);
  validateEventVersionBindings(events, versions);
  return Object.freeze({ versions, events, analysisDispositions: parseDispositions(raw.analysisDispositions) });
};

export const parseCoherenceInput = (value: unknown): CoherenceFormulaInput => {
  assertDeepFrozen(value);
  const raw = asRecord(value, "coherence formula input");
  exact(raw, ["versions", "events", "analysisDispositions", "voluntaryReturnOpportunities", "comprehensionScoringKeys", "observationBoundary"], "coherence formula input");
  const versions = parseVersions(raw.versions);
  const observationBoundary = utc(raw.observationBoundary, "observationBoundary");
  const allEvents = parseEvents(raw.events);
  const events = Object.freeze(allEvents.filter((event) => event.acceptedAt <= observationBoundary &&
    (!("effectiveAt" in event) || event.effectiveAt <= observationBoundary)));
  validateEventVersionBindings(events, versions);
  return Object.freeze({ versions, events, analysisDispositions: parseDispositions(raw.analysisDispositions, observationBoundary),
    voluntaryReturnOpportunities: parseOpportunities(raw.voluntaryReturnOpportunities, versions), comprehensionScoringKeys: parseKeys(raw.comprehensionScoringKeys),
    observationBoundary });
};

export const dispositionsByParticipant = (input: ChanceFormulaInput): ReadonlyMap<string, AnalysisDisposition> =>
  new Map(input.analysisDispositions.map((entry) => [entry.participantLineageId, entry]));

export const addExclusion = (counts: Map<string, number>, reasonClass: string): void => {
  counts.set(reasonClass, (counts.get(reasonClass) ?? 0) + 1);
};

export const metric = <N extends Readonly<Record<string, number>>>(measureId: string, versions: FormulaVersions, rawNumerators: N,
  rawDenominator: number, missingCount: number, exclusions: ReadonlyMap<string, number>): MetricResult<N> => {
  const excludedByReason = Object.freeze([...exclusions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([reasonClass, count]) => Object.freeze({ reasonClass, count })));
  const frozenNumerators = Object.freeze({ ...rawNumerators });
  const rates = Object.freeze(Object.fromEntries(Object.entries(frozenNumerators).map(([key, numerator]) => [key, rawDenominator === 0 ? null : numerator / rawDenominator]))) as MetricResult<N>["rates"];
  return Object.freeze({ measureId, versions: Object.freeze({ ...versions }), rawNumerators: frozenNumerators, rawDenominator, missingCount,
    excludedCount: excludedByReason.reduce((sum, entry) => sum + entry.count, 0), excludedByReason, rates });
};

export const correctionReasons = (events: readonly AuthoritativeEvent[]): ReadonlyMap<string, "ROUND_VOID" | "ROUND_CONTENT_WITHDRAWN"> => {
  const map = new Map<string, "ROUND_VOID" | "ROUND_CONTENT_WITHDRAWN">();
  for (const event of events) if (event.eventFamilyId === "ROUND_CORRECTED") {
    const reason = event.newCorrectionStatus === "VOID" ? "ROUND_VOID" : "ROUND_CONTENT_WITHDRAWN";
    const prior = map.get(event.roundId);
    if (prior !== undefined && prior !== reason) fail("Ambiguous terminal correction state");
    map.set(event.roundId, reason);
  }
  return map;
};
