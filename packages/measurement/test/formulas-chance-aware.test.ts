import { describe, expect, it } from "vitest";
import { AUTHORITATIVE_EVENT_SCHEMA_VERSION, parseAuthoritativeEvent, parseAuthoritativeEventBatch } from "../src/events/index.js";
import { calculateChanceAwareModeSummaries } from "../src/formulas/chance-aware.js";

type Mode = "provenance" | "language";
type RecordValue = Record<string, unknown>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true
  : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);

const versions = () => deepFreeze({
  formulaVersionId: "chance-aware-v1",
  eventSchemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
  eligibilityVersionId: "eligibility-v1",
  consentVersionId: "consent-v1",
  incidentVersionId: "incident-policy-v1",
  correctionVersionId: "correction-policy-v1",
  candidateSetRegistryVersionId: "candidate-registry-v1",
  modeVersionId: "mode-v1",
  dayVersionId: "active-days-v1",
  positionVersionId: "positions-v1",
  cohortVersionId: "cohort-v1",
  instrumentRegistryVersionId: "instruments-v1",
});

const base = (eventFamilyId: string, eventId: string, acceptedAt = "2026-08-03T10:00:00.000Z") => ({
  eventId, eventFamilyId, schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION, acceptedAt,
});

const scope = (participantLineageId: string, sessionId: string, roundId: string) => ({
  participantLineageId, betaDay: "2026-08-03", manifestLineageId: "manifest-lineage-v1",
  manifestVersionId: "manifest-v1", sessionId, roundId,
});

const displayed = (participant: string, session: string, round: string, mode: Mode, ordinalPosition: number) => parseAuthoritativeEvent(deepFreeze({
  ...base("ROUND_DISPLAYED", `display-${round}`), ...scope(participant, session, round),
  contentId: `content-${round}`, mode, ordinalPosition, displayedAt: "2026-08-03T10:00:00.000Z", correctionStatus: "ACTIVE",
}));

const answered = (participant: string, session: string, round: string, mode: Mode, candidateCount: number, clueCount: number, candidateSetVersionId = `${mode}-candidates-${candidateCount}-v1`) => parseAuthoritativeEvent(deepFreeze({
  ...base("ANSWER_ACCEPTED", `answer-${round}`, "2026-08-03T10:01:00.000Z"), ...scope(participant, session, round),
  candidateSetVersionId, candidateId: `${mode}-candidate-1`, candidateCount, clueCount,
  mode, scoringVersionId: "scoring-v1",
}));

const revealed = (round: string, correctness: boolean) => parseAuthoritativeEvent(deepFreeze({
  ...base("REVEAL_AUTHORIZED", `reveal-${round}`, "2026-08-03T10:02:00.000Z"),
  acceptedAnswerId: `answer-${round}`, revealedAt: "2026-08-03T10:02:00.000Z", correctness,
  evidenceVersionId: "evidence-v1", revealVersionId: "reveal-v1", authorizationOutcome: "AUTHORIZED",
}));

const corrected = (round: string, status: "VOID" | "CONTENT_WITHDRAWN") => parseAuthoritativeEvent(deepFreeze({
  ...base("ROUND_CORRECTED", `correction-${round}`, "2026-08-03T10:03:00.000Z"), roundId: round,
  priorCorrectionStatus: "ACTIVE", newCorrectionStatus: status, correctionVersionId: "correction-policy-v1",
  effectiveAt: "2026-08-03T10:03:00.000Z", noticeClass: "ROUND_UNAVAILABLE", analyticalTreatment: "EXCLUDE_ROUND",
}));

const included = (participantLineageId: string) => Object.freeze({ participantLineageId, state: "INCLUDED" as const });
const pending = (participantLineageId: string) => Object.freeze({ participantLineageId, state: "PENDING" as const });
const excluded = (participantLineageId: string, reasonClass = "AUTHENTICATED_WITHDRAWAL") => Object.freeze({
  participantLineageId, state: "EXCLUDED" as const, reasonClass,
  effectiveAt: "2026-08-03T10:04:00.000Z", approverId: "privacy-operator", formulaTreatment: "EXCLUDE_PROSPECTIVELY_AND_AT_FREEZE",
});

const input = (events: readonly ReturnType<typeof parseAuthoritativeEvent>[], dispositions: readonly Readonly<Record<string, unknown>>[]) => deepFreeze({
  versions: versions(), events: parseAuthoritativeEventBatch(Object.freeze([...events])), analysisDispositions: Object.freeze([...dispositions]),
});

const eventSet = () => {
  const events = [
    displayed("p1", "s1", "p-round-1", "provenance", 1), answered("p1", "s1", "p-round-1", "provenance", 2, 0), revealed("p-round-1", true),
    displayed("p1", "s1", "p-round-2", "provenance", 2), answered("p1", "s1", "p-round-2", "provenance", 2, 1), revealed("p-round-2", false),
    displayed("p2", "s2", "p-round-3", "provenance", 1), answered("p2", "s2", "p-round-3", "provenance", 2, 2),
    displayed("l1", "s3", "l-round-1", "language", 1), answered("l1", "s3", "l-round-1", "language", 3, 0), revealed("l-round-1", true),
    displayed("l1", "s3", "l-round-2", "language", 2), answered("l1", "s3", "l-round-2", "language", 4, 2), revealed("l-round-2", false),
  ];
  return { events, dispositions: [included("p1"), included("p2"), included("l1")] };
};

describe("chance-aware mode formulas", () => {
  it("returns provenance and language as independent exact chance-aware summaries", () => {
    const data = eventSet();
    const result = calculateChanceAwareModeSummaries(input(data.events, data.dispositions));
    expect(result).toEqual({
      provenance: {
        measureId: "CHANCE_AWARE_PROVENANCE", versions: versions(),
        rawNumerators: { accepted: 3, revealed: 2, correct: 1 }, rawDenominator: 3,
        missingCount: 1, excludedCount: 0, excludedByReason: [],
        rates: { accepted: 1, revealed: 2 / 3, correct: 1 / 3 },
        candidateCountHistogram: [{ candidateCount: 2, count: 3 }],
        chanceBaselineSum: 1.5, chanceBaselineMean: 0.5,
        clueCountHistogram: [{ clueCount: 0, count: 1 }, { clueCount: 1, count: 1 }, { clueCount: 2, count: 1 }],
      },
      language: {
        measureId: "CHANCE_AWARE_LANGUAGE", versions: versions(),
        rawNumerators: { accepted: 2, revealed: 2, correct: 1 }, rawDenominator: 2,
        missingCount: 0, excludedCount: 0, excludedByReason: [],
        rates: { accepted: 1, revealed: 1, correct: 0.5 },
        candidateCountHistogram: [{ candidateCount: 3, count: 1 }, { candidateCount: 4, count: 1 }],
        chanceBaselineSum: 1 / 3 + 1 / 4, chanceBaselineMean: (1 / 3 + 1 / 4) / 2,
        clueCountHistogram: [{ clueCount: 0, count: 1 }, { clueCount: 1, count: 0 }, { clueCount: 2, count: 1 }],
      },
    });
    expect(result.provenance).not.toBe(result.language);
    expect(recursivelyFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/combined|delta|rank|equal|difficulty|skill|caus|entertainmentScore/i);
  });

  it("counts pending as missing, typed exclusions separately, and terminal corrections by round reason", () => {
    const events = [
      displayed("pending", "sp", "pending-round", "provenance", 1), answered("pending", "sp", "pending-round", "provenance", 2, 0), revealed("pending-round", true),
      displayed("excluded", "se", "excluded-round", "provenance", 1), answered("excluded", "se", "excluded-round", "provenance", 2, 0), revealed("excluded-round", true),
      displayed("included", "si", "void-round", "provenance", 1), answered("included", "si", "void-round", "provenance", 2, 0), revealed("void-round", true), corrected("void-round", "VOID"),
      displayed("included", "si", "withdrawn-round", "language", 2), answered("included", "si", "withdrawn-round", "language", 3, 1), revealed("withdrawn-round", false), corrected("withdrawn-round", "CONTENT_WITHDRAWN"),
    ];
    const result = calculateChanceAwareModeSummaries(input(events, [pending("pending"), excluded("excluded"), included("included")]));
    expect(result.provenance).toMatchObject({ rawDenominator: 0, missingCount: 1, excludedCount: 2,
      excludedByReason: [{ reasonClass: "AUTHENTICATED_WITHDRAWAL", count: 1 }, { reasonClass: "ROUND_VOID", count: 1 }],
      chanceBaselineMean: null });
    expect(result.language).toMatchObject({ rawDenominator: 0, missingCount: 0, excludedCount: 1,
      excludedByReason: [{ reasonClass: "ROUND_CONTENT_WITHDRAWN", count: 1 }], chanceBaselineMean: null });
  });

  it("treats zero clues as observed zero and an absent reveal as missing", () => {
    const events = [displayed("p1", "s1", "r1", "language", 1), answered("p1", "s1", "r1", "language", 3, 0)];
    const result = calculateChanceAwareModeSummaries(input(events, [included("p1")])).language;
    expect(result.rawDenominator).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.clueCountHistogram).toEqual([{ clueCount: 0, count: 1 }, { clueCount: 1, count: 0 }, { clueCount: 2, count: 0 }]);
  });

  it("is byte-stable under event and disposition permutation and detaches every result", () => {
    const data = eventSet();
    const first = calculateChanceAwareModeSummaries(input(data.events, data.dispositions));
    const second = calculateChanceAwareModeSummaries(input([...data.events].reverse(), [...data.dispositions].reverse()));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.provenance.versions).not.toBe(versions());
  });

  it.each(["versions", "events", "analysisDispositions"])("rejects missing, null, undefined, mutable, and extra root %s", (field) => {
    const data = eventSet();
    const valid = input(data.events, data.dispositions) as unknown as RecordValue;
    const missing = { ...valid }; delete missing[field];
    expect(() => calculateChanceAwareModeSummaries(deepFreeze(missing))).toThrow();
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, [field]: null }))).toThrow();
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, [field]: undefined }))).toThrow();
    expect(() => calculateChanceAwareModeSummaries({ ...valid })).toThrow(/frozen|immutable|boundary/i);
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, extra: true }))).toThrow(/field|shape|extra|unknown/i);
  });

  it.each(Object.keys(versions()))("rejects missing, blank, null, undefined, and drifted version %s", (field) => {
    const data = eventSet();
    const valid = input(data.events, data.dispositions);
    const versionValues = { ...valid.versions } as RecordValue;
    delete versionValues[field];
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, versions: versionValues }))).toThrow();
    for (const value of ["", " ", null, undefined]) expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, versions: { ...valid.versions, [field]: value } }))).toThrow();
    if (field === "eventSchemaVersionId") expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, versions: { ...valid.versions, [field]: "authoritative-events-v2" } }))).toThrow(/schema|version/i);
  });

  it("rejects unparsed or mutable events, duplicate IDs, ambiguous answer/reveal joins, invalid candidate counts, and invalid dispositions", () => {
    const data = eventSet();
    const valid = input(data.events, data.dispositions);
    const mutableEvent = { ...data.events[0] };
    const shallowEventBoundary = Object.freeze({ ...valid, events: Object.freeze([mutableEvent]) });
    expect(() => calculateChanceAwareModeSummaries(shallowEventBoundary)).toThrow(/event|frozen|immutable|boundary/i);
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, events: [...valid.events, valid.events[0]] }))).toThrow(/duplicate|event/i);
    const duplicateReveal = deepFreeze({ ...revealed("p-round-1", true), eventId: "different-reveal" });
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, events: [...valid.events, parseAuthoritativeEvent(duplicateReveal)] }))).toThrow(/ambiguous|answer|reveal|duplicate/i);
    const invalidAnswer = deepFreeze({ ...answered("p1", "s1", "bad", "provenance", 2, 0), candidateCount: 0 });
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, events: [displayed("p1", "s1", "bad", "provenance", 1), invalidAnswer] }))).toThrow(/candidate|count|event/i);
    expect(() => calculateChanceAwareModeSummaries(input([
      displayed("p1", "s1", "provenance-three", "provenance", 1),
      answered("p1", "s1", "provenance-three", "provenance", 3, 0),
    ], [included("p1")]))).toThrow(/provenance|candidate|count|two/i);
    expect(() => calculateChanceAwareModeSummaries(input([
      displayed("l1", "s1", "language-three", "language", 1), answered("l1", "s1", "language-three", "language", 3, 0, "language-shared-v1"),
      displayed("l1", "s1", "language-four", "language", 2), answered("l1", "s1", "language-four", "language", 4, 0, "language-shared-v1"),
    ], [included("l1")]))).toThrow(/candidate|set|version|count|drift/i);
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, analysisDispositions: [{ participantLineageId: "p1", state: "EXCLUDED" }] }))).toThrow(/field|exclusion|reason|effective|approver|treatment/i);
    expect(() => calculateChanceAwareModeSummaries(deepFreeze({ ...valid, analysisDispositions: [{ ...excluded("p1"), unexpected: true }] }))).toThrow(/field|shape|unknown/i);
  });

  it("binds immutable candidate sets to one mode and corrections to the input correction version", () => {
    const distinct = calculateChanceAwareModeSummaries(input([
      displayed("p1", "sp", "provenance-distinct", "provenance", 1), answered("p1", "sp", "provenance-distinct", "provenance", 2, 0, "provenance-distinct-v1"),
      displayed("l1", "sl", "language-distinct", "language", 1), answered("l1", "sl", "language-distinct", "language", 2, 0, "language-distinct-v1"),
    ], [included("p1"), included("l1")]));
    expect(distinct.provenance.rawDenominator).toBe(1);
    expect(distinct.language.rawDenominator).toBe(1);
    expect(() => calculateChanceAwareModeSummaries(input([
      displayed("p1", "sp", "provenance-shared", "provenance", 1), answered("p1", "sp", "provenance-shared", "provenance", 2, 0, "cross-mode-shared-v1"),
      displayed("l1", "sl", "language-shared", "language", 1), answered("l1", "sl", "language-shared", "language", 2, 0, "cross-mode-shared-v1"),
    ], [included("p1"), included("l1")]))).toThrow(/candidate|set|version|mode|drift/i);
  });

  it("rejects correction-version drift in chance-aware inputs", () => {
    const wrongCorrectionVersion = parseAuthoritativeEvent(deepFreeze({ ...corrected("p-round-1", "VOID"), correctionVersionId: "wrong-correction-policy" }));
    expect(() => calculateChanceAwareModeSummaries(input([
      displayed("p1", "s1", "p-round-1", "provenance", 1), answered("p1", "s1", "p-round-1", "provenance", 2, 0), wrongCorrectionVersion,
    ], [included("p1")]))).toThrow(/correction|version|drift/i);
  });

  it("rejects duplicate answers, full-scope drift, orphan reveals, and reversed answer/reveal chronology", () => {
    const display = displayed("p1", "s1", "scoped", "provenance", 1);
    const answer = answered("p1", "s1", "scoped", "provenance", 2, 0);
    const duplicate = parseAuthoritativeEvent(deepFreeze({ ...answer, eventId: "answer-scoped-duplicate", candidateId: "provenance-candidate-2" }));
    expect(() => calculateChanceAwareModeSummaries(input([display, answer, duplicate], [included("p1")]))).toThrow(/duplicate|multiple|answer|round/i);
    const crossManifest = parseAuthoritativeEvent(deepFreeze({ ...answer, eventId: "answer-scoped-cross-manifest", manifestVersionId: "manifest-v2" }));
    expect(() => calculateChanceAwareModeSummaries(input([display, crossManifest], [included("p1")]))).toThrow(/scope|manifest|display|orphan/i);
    expect(() => calculateChanceAwareModeSummaries(input([revealed("orphan", true)], [included("p1")]))).toThrow(/orphan|reveal|answer/i);
    const earlyAnswer = parseAuthoritativeEvent(deepFreeze({ ...answer, acceptedAt: "2026-08-03T09:59:00.000Z" }));
    expect(() => calculateChanceAwareModeSummaries(input([display, earlyAnswer], [included("p1")]))).toThrow(/chronology|time|display|answer/i);
    const earlyReveal = parseAuthoritativeEvent(deepFreeze({ ...revealed("scoped", true), acceptedAt: "2026-08-03T10:00:30.000Z", revealedAt: "2026-08-03T10:00:30.000Z" }));
    expect(() => calculateChanceAwareModeSummaries(input([display, answer, earlyReveal], [included("p1")]))).toThrow(/chronology|time|answer|reveal/i);
  });
});
