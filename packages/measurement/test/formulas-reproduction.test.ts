import { describe, expect, it } from "vitest";
import { AUTHORITATIVE_EVENT_SCHEMA_VERSION, parseAuthoritativeEventBatch } from "../src/events/index.js";
import {
  calculateChanceAwareModeSummaries,
  calculateCoherenceMeasures,
  reproduceEntertainmentScore,
} from "../src/formulas/index.js";

type RecordValue = Record<string, unknown>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const versions = () => deepFreeze({
  formulaVersionId: "formulas-v1", eventSchemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
  eligibilityVersionId: "eligibility-v1", consentVersionId: "consent-v1", incidentVersionId: "incident-v1",
  correctionVersionId: "correction-v1", candidateSetRegistryVersionId: "candidate-registry-v1",
  modeVersionId: "mode-v1", dayVersionId: "day-v1", positionVersionId: "position-v1",
  cohortVersionId: "cohort-v1", instrumentRegistryVersionId: "instrument-registry-v1",
});

const emptyEvents = () => parseAuthoritativeEventBatch(Object.freeze([]));
const coherenceInput = () => deepFreeze({
  versions: versions(), events: emptyEvents(), analysisDispositions: [], voluntaryReturnOpportunities: [],
  comprehensionScoringKeys: [], observationBoundary: "2026-08-04T00:00:00.000Z",
});
const chanceInput = () => deepFreeze({ versions: versions(), events: emptyEvents(), analysisDispositions: [] });

const omit = (value: Readonly<Record<string, unknown>>, field: string) => {
  const copy = { ...value };
  delete copy[field];
  return deepFreeze(copy);
};

const assertNoNonFiniteNumber = (value: unknown): void => {
  if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
  if (typeof value === "object" && value !== null) for (const nested of Object.values(value)) assertNoNonFiniteNumber(nested);
};

describe("formula input and reproduction contract", () => {
  it.each(["versions", "events", "analysisDispositions", "voluntaryReturnOpportunities", "comprehensionScoringKeys", "observationBoundary"])("requires exact coherence root field %s without null/undefined placeholders", (field) => {
    const input = coherenceInput() as unknown as Readonly<Record<string, unknown>>;
    expect(() => calculateCoherenceMeasures(omit(input, field))).toThrow();
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, [field]: null }))).toThrow();
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, [field]: undefined }))).toThrow();
  });

  it.each(["versions", "events", "analysisDispositions"])("requires exact chance root field %s without null/undefined placeholders", (field) => {
    const input = chanceInput() as unknown as Readonly<Record<string, unknown>>;
    expect(() => calculateChanceAwareModeSummaries(omit(input, field))).toThrow();
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...input, [field]: null }))).toThrow();
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...input, [field]: undefined }))).toThrow();
  });

  it("rejects extra or mutable roots and recursively mutable nested arrays across formula families", () => {
    expect(() => calculateCoherenceMeasures({ ...coherenceInput() })).toThrow(/frozen|immutable|boundary/i);
    expect(() => calculateChanceAwareModeSummaries({ ...chanceInput() })).toThrow(/frozen|immutable|boundary/i);
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...coherenceInput(), extra: true }))).toThrow(/field|shape|extra|unknown/i);
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...chanceInput(), extra: true }))).toThrow(/field|shape|extra|unknown/i);
    expect(() => calculateCoherenceMeasures(Object.freeze({ ...coherenceInput(), analysisDispositions: [] }))).toThrow(/frozen|immutable|boundary/i);
    expect(() => calculateChanceAwareModeSummaries(Object.freeze({ ...chanceInput(), events: [] }))).toThrow(/frozen|immutable|boundary/i);
  });

  it.each(Object.keys(versions()))("requires nonblank exact version field %s and rejects schema drift", (field) => {
    const input = coherenceInput();
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, versions: omit(input.versions, field) }))).toThrow();
    for (const value of ["", " ", null, undefined]) {
      expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, versions: { ...input.versions, [field]: value } }))).toThrow();
    }
    if (field === "eventSchemaVersionId") {
      expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, versions: { ...input.versions, eventSchemaVersionId: "authoritative-events-v2" } }))).toThrow(/schema|version/i);
    }
  });

  it("accepts only exact typed analysis dispositions and never mixes missing with exclusions", () => {
    const input = coherenceInput();
    const included = Object.freeze({ participantLineageId: "included", state: "INCLUDED" });
    const pending = Object.freeze({ participantLineageId: "pending", state: "PENDING" });
    const excluded = Object.freeze({ participantLineageId: "excluded", state: "EXCLUDED", reasonClass: "DUPLICATE_LINEAGE", effectiveAt: "2026-08-03T10:00:00.000Z", approverId: "data-steward", formulaTreatment: "EXCLUDE_AT_FREEZE" });
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, analysisDispositions: [included, pending, excluded] }))).not.toThrow();
    for (const bad of [
      { participantLineageId: "p", state: "PENDING", reasonClass: "EXTRA" },
      { participantLineageId: "p", state: "INCLUDED", approverId: "extra" },
      { participantLineageId: "p", state: "EXCLUDED" },
      { participantLineageId: "p", state: "EXCLUDED", reasonClass: "DUPLICATE_LINEAGE", effectiveAt: "bad", approverId: "", formulaTreatment: "" },
      { participantLineageId: "p", state: "UNKNOWN" },
      { participantLineageId: "p", state: "EXCLUDED", reasonClass: "INVENTED_REASON", effectiveAt: "2026-08-03T10:00:00.000Z", approverId: "data", formulaTreatment: "EXCLUDE" },
      { participantLineageId: "p", state: "INCLUDED", extra: true },
    ]) expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, analysisDispositions: [bad] }))).toThrow(/analysis|state|field|exclusion|effective|approver|treatment/i);
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, analysisDispositions: [included, included] }))).toThrow(/duplicate|participant|disposition/i);
  });

  it("validates the only two permitted sidecars exactly and binds their versions", () => {
    const input = coherenceInput();
    const opportunity = Object.freeze({
      participantLineageId: "p", precedingDay: "2026-08-02", nextActiveDay: "2026-08-03", fullWindowObserved: true,
      consented: true, eligible: true, unrevoked: true, platformIncidentBlocked: false,
      dayVersionId: input.versions.dayVersionId, incidentVersionId: input.versions.incidentVersionId,
    });
    const key = deepFreeze({ instrumentVersionId: "survey-v1", understandingResponseIds: ["understands"], nonUnderstandingResponseIds: ["does-not"] });
    const precedingStart = deepFreeze({
      eventId: "start-p", eventFamilyId: "SESSION_STARTED", schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
      acceptedAt: "2026-08-02T10:00:00.000Z", participantLineageId: "p", betaDay: "2026-08-02",
      manifestLineageId: "lineage", manifestVersionId: "manifest", sessionId: "session", startedAt: "2026-08-02T10:00:00.000Z",
      eligibilityVersionId: "eligibility-v1", consentVersionId: "consent-v1",
    });
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, events: [precedingStart], voluntaryReturnOpportunities: [opportunity], comprehensionScoringKeys: [key] }))).not.toThrow();
    for (const bad of [
      { ...opportunity, dayVersionId: "wrong" }, { ...opportunity, incidentVersionId: "wrong" },
      { ...opportunity, extra: true }, { ...opportunity, consented: "yes" },
    ]) expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, voluntaryReturnOpportunities: [bad] }))).toThrow(/opportunity|version|field|boolean/i);
    for (const bad of [
      { ...key, extra: true }, { ...key, instrumentVersionId: "" },
      { ...key, understandingResponseIds: ["same"], nonUnderstandingResponseIds: ["same"] },
      { ...key, understandingResponseIds: ["duplicate", "duplicate"] },
      { ...key, nonUnderstandingResponseIds: [""] },
    ]) expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, comprehensionScoringKeys: [bad] }))).toThrow(/instrument|response|field|distinct|blank|overlap/i);
  });

  it("reparses frozen WP-028 events, rejects mutable/duplicate events, and never rewrites input", () => {
    const raw = deepFreeze({
      eventId: "start-1", eventFamilyId: "SESSION_STARTED", schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
      acceptedAt: "2026-08-03T10:00:00.000Z", participantLineageId: "p", betaDay: "2026-08-03",
      manifestLineageId: "lineage", manifestVersionId: "manifest", sessionId: "session", startedAt: "2026-08-03T10:00:00.000Z",
      eligibilityVersionId: "eligibility-v1", consentVersionId: "consent-v1",
    });
    const input = coherenceInput();
    const before = JSON.stringify(raw);
    const result = calculateCoherenceMeasures(deepFreeze({ ...input, events: [raw], analysisDispositions: [{ participantLineageId: "p", state: "INCLUDED" }] }));
    expect(result.mixedSessionCompletion.rawDenominator).toBe(1);
    expect(JSON.stringify(raw)).toBe(before);
    const mutableEvent = { ...raw };
    const shallowEventBoundary = Object.freeze({ ...input, events: Object.freeze([mutableEvent]) });
    expect(() => calculateCoherenceMeasures(shallowEventBoundary)).toThrow(/event|frozen|immutable|boundary/i);
    expect(() => calculateCoherenceMeasures(deepFreeze({ ...input, events: [raw, raw] }))).toThrow(/duplicate|event/i);
  });

  it("produces exact null rates at zero denominator and no NaN or Infinity", () => {
    const coherence = calculateCoherenceMeasures(coherenceInput());
    for (const result of [
      coherence.mixedSessionCompletion, coherence.voluntaryReturn, coherence.transitionContinuation,
      coherence.modeAbandonment.provenance, coherence.modeAbandonment.language,
      coherence.modeClueUse.provenance, coherence.modeClueUse.language,
      coherence.responseSufficiency, coherence.sharedPromiseComprehension,
    ]) {
      expect(result.rawDenominator).toBe(0);
      expect(Object.values(result.rates).every((rate) => rate === null)).toBe(true);
    }
    expect(coherence.criticalDefectStatus).not.toHaveProperty("rates");
    const chance = calculateChanceAwareModeSummaries(chanceInput());
    expect(chance.provenance.chanceBaselineMean).toBeNull();
    expect(chance.language.chanceBaselineMean).toBeNull();
    assertNoNonFiniteNumber(coherence);
    assertNoNonFiniteNumber(chance);
  });

  it("reproduces byte-for-value results under immutable input permutations", () => {
    const dispositions = [
      Object.freeze({ participantLineageId: "b", state: "INCLUDED" }),
      Object.freeze({ participantLineageId: "a", state: "PENDING" }),
      Object.freeze({ participantLineageId: "c", state: "EXCLUDED", reasonClass: "OPERATIONAL_TESTER", effectiveAt: "2026-08-03T10:00:00.000Z", approverId: "data-steward", formulaTreatment: "EXCLUDE" }),
    ];
    const firstInput = deepFreeze({ ...coherenceInput(), analysisDispositions: dispositions });
    const secondInput = deepFreeze({ ...coherenceInput(), analysisDispositions: [...dispositions].reverse() });
    expect(JSON.stringify(calculateCoherenceMeasures(secondInput))).toBe(JSON.stringify(calculateCoherenceMeasures(firstInput)));
  });

  it("exports all formula families without exporting thresholds, gates, reports, or cross-mode comparisons", () => {
    expect(typeof reproduceEntertainmentScore).toBe("function");
    expect(typeof calculateCoherenceMeasures).toBe("function");
    expect(typeof calculateChanceAwareModeSummaries).toBe("function");
    const all = {
      score: reproduceEntertainmentScore(deepFreeze({ formulaVersionId: "score-v1", scoringVersionId: "scoring-v1", correct: true, clueCount: 0 })),
      coherence: calculateCoherenceMeasures(coherenceInput()),
      chance: calculateChanceAwareModeSummaries(chanceInput()),
    };
    const serialized = JSON.stringify(all);
    expect(serialized).not.toMatch(/"(?:PASS|FAIL|INDETERMINATE|OPEN|PAUSE)"/u);
    expect(serialized).not.toMatch(/recommend|threshold|sampleFloor|day7|reportTemplate|combinedScore|crossMode|caus|equalDifficulty/i);
  });
});
