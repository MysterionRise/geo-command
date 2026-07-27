import { describe, expect, it } from "vitest";
import { AUTHORITATIVE_EVENT_SCHEMA_VERSION, parseAuthoritativeEvent, parseAuthoritativeEventBatch } from "../src/events/index.js";
import { calculateCoherenceMeasures } from "../src/formulas/coherence.js";

type Event = ReturnType<typeof parseAuthoritativeEvent>;
type Mode = "provenance" | "language";

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true
  : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);

const VERSIONS = deepFreeze({
  formulaVersionId: "coherence-formulas-v1", eventSchemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION,
  eligibilityVersionId: "eligibility-v1", consentVersionId: "consent-v1", incidentVersionId: "incident-policy-v1",
  correctionVersionId: "correction-policy-v1", candidateSetRegistryVersionId: "candidate-registry-v1",
  modeVersionId: "modes-v1", dayVersionId: "active-days-v1", positionVersionId: "positions-v1",
  cohortVersionId: "cohort-v1", instrumentRegistryVersionId: "instrument-registry-v1",
});

const base = (eventFamilyId: string, eventId: string, acceptedAt: string) => ({
  eventId, eventFamilyId, schemaVersionId: AUTHORITATIVE_EVENT_SCHEMA_VERSION, acceptedAt,
});
const sessionScope = (participantLineageId: string, betaDay: string, sessionId: string) => ({
  participantLineageId, betaDay, manifestLineageId: "lineage-v1", manifestVersionId: `manifest-${betaDay}`,
  sessionId,
});

const started = (p: string, day: string, s: string, time = `${day}T09:00:00.000Z`) => parseAuthoritativeEvent(deepFreeze({
  ...base("SESSION_STARTED", `start-${s}`, time), ...sessionScope(p, day, s), startedAt: time,
  eligibilityVersionId: VERSIONS.eligibilityVersionId, consentVersionId: VERSIONS.consentVersionId,
}));
const displayed = (p: string, day: string, s: string, roundId: string, mode: Mode, ordinalPosition: number, displayedAt = `${day}T09:01:00.000Z`) => parseAuthoritativeEvent(deepFreeze({
  ...base("ROUND_DISPLAYED", `display-${roundId}`, displayedAt), ...sessionScope(p, day, s),
  roundId, contentId: `content-${roundId}`, mode, ordinalPosition, displayedAt, correctionStatus: "ACTIVE",
}));
const answered = (p: string, day: string, s: string, roundId: string, mode: Mode, clueCount = 0) => parseAuthoritativeEvent(deepFreeze({
  ...base("ANSWER_ACCEPTED", `answer-${roundId}`, `${day}T09:02:00.000Z`), ...sessionScope(p, day, s), roundId,
  candidateSetVersionId: `${mode}-candidates-v1`, candidateId: `${mode}-candidate-1`, candidateCount: mode === "provenance" ? 2 : 3,
  clueCount, mode, scoringVersionId: "scoring-v1",
}));
const clue = (p: string, day: string, s: string, roundId: string, clueNumber: 1 | 2) => parseAuthoritativeEvent(deepFreeze({
  ...base("CLUE_REVEALED", `clue-${roundId}-${clueNumber}`, `${day}T09:01:0${clueNumber}.000Z`), ...sessionScope(p, day, s), roundId,
  clueNumber, scoringVersionId: "scoring-v1", interactionStatus: "OPEN", correctionStatus: "ACTIVE",
}));
const revealed = (day: string, roundId: string, correctness = true) => parseAuthoritativeEvent(deepFreeze({
  ...base("REVEAL_AUTHORIZED", `reveal-${roundId}`, `${day}T09:03:00.000Z`), acceptedAnswerId: `answer-${roundId}`,
  revealedAt: `${day}T09:03:00.000Z`, correctness, evidenceVersionId: "evidence-v1", revealVersionId: "reveal-v1", authorizationOutcome: "AUTHORIZED",
}));
const completed = (p: string, day: string, s: string, active = 1, acknowledged = true) => parseAuthoritativeEvent(deepFreeze({
  ...base("SESSION_COMPLETED", `complete-${s}`, `${day}T09:10:00.000Z`), ...sessionScope(p, day, s), completedAt: `${day}T09:10:00.000Z`,
  roundCounts: { ACTIVE: active, VOID: 5 - active, CONTENT_WITHDRAWN: 0 }, acknowledgementCompleteness: acknowledged,
  entertainmentScoreVersionId: "entertainment-score-v1",
}));
const expired = (p: string, day: string, s: string, completedRoundCount = 0) => parseAuthoritativeEvent(deepFreeze({
  ...base("SESSION_EXPIRED", `expired-${s}`, `${day}T23:59:00.000Z`), ...sessionScope(p, day, s), expiredAt: `${day}T23:59:00.000Z`,
  lastInteractionStatus: "OPEN", completedRoundCount, denominatorTreatment: "RETAIN_STARTED_INCOMPLETE",
}));
const corrected = (roundId: string, status: "VOID" | "CONTENT_WITHDRAWN") => parseAuthoritativeEvent(deepFreeze({
  ...base("ROUND_CORRECTED", `correction-${roundId}`, "2026-08-03T09:04:00.000Z"), roundId,
  priorCorrectionStatus: "ACTIVE", newCorrectionStatus: status, correctionVersionId: VERSIONS.correctionVersionId,
  effectiveAt: "2026-08-03T09:04:00.000Z", noticeClass: "ROUND_UNAVAILABLE", analyticalTreatment: "EXCLUDE_ROUND",
}));
const acknowledged = (p: string, s: string, roundId: string, acknowledgedAt: string, acceptedAt = acknowledgedAt) => parseAuthoritativeEvent(deepFreeze({
  ...base("CORRECTION_NOTICE_ACKNOWLEDGED", `ack-${p}-${roundId}`, acceptedAt), participantLineageId: p,
  sessionId: s, roundId, correctionVersionId: VERSIONS.correctionVersionId, noticeVersionId: "notice-v1", acknowledgedAt,
}));
const offered = (p: string, instrumentVersionId = "survey-v1") => parseAuthoritativeEvent(deepFreeze({
  ...base("SURVEY_OFFERED", `offer-${p}`, "2026-08-03T11:00:00.000Z"), participantLineageId: p, instrumentVersionId,
  offeredAt: "2026-08-03T11:00:00.000Z", signedTriggerClass: "DAY7_COMPLETION", responseWindowEndsAt: "2026-08-04T11:00:00.000Z",
}));
const submitted = (p: string, responseIds: readonly string[], submittedAt = "2026-08-03T12:00:00.000Z") => parseAuthoritativeEvent(deepFreeze({
  ...base("SURVEY_SUBMITTED", `submit-${p}`, submittedAt), participantLineageId: p, instrumentVersionId: "survey-v1",
  submittedAt, closedResponseIds: [...responseIds], analyticalInclusionState: "INCLUDED",
}));
const defect = (defectId: string, status: "OPENED" | "RESOLVED", acceptedAt: string, releaseBlockingDecision: string) => parseAuthoritativeEvent(deepFreeze({
  ...base("CRITICAL_DEFECT_CHANGED", `${defectId}-${status}-${acceptedAt}`, acceptedAt), defectId, defectStatus: status,
  severity: "CRITICAL", affectedScopeId: "beta", affectedRequirementId: "FR-030", effectiveAt: acceptedAt,
  releaseBlockingDecision, ownerId: "release-operator",
}));
const withdrawal = (participantLineageId: string, effectiveAt = "2026-08-03T09:05:00.000Z") => parseAuthoritativeEvent(deepFreeze({
  ...base("CONSENT_OR_WITHDRAWAL_CHANGED", `withdrawal-${participantLineageId}`, effectiveAt), participantLineageId,
  priorConsentState: "CONSENTED", newConsentState: "WITHDRAWN", effectiveAt, policyVersionId: VERSIONS.consentVersionId,
  analyticalInclusionTransition: { from: "INCLUDED", to: "EXCLUDED" }, deletionCaseReference: `deletion-${participantLineageId}`,
}));

const included = (participantLineageId: string) => Object.freeze({ participantLineageId, state: "INCLUDED" as const });
const pending = (participantLineageId: string) => Object.freeze({ participantLineageId, state: "PENDING" as const });
const excluded = (participantLineageId: string, reasonClass = "OPERATIONAL_TESTER", effectiveAt = "2026-08-03T08:00:00.000Z") => Object.freeze({
  participantLineageId, state: "EXCLUDED" as const, reasonClass, effectiveAt,
  approverId: "data-steward", formulaTreatment: "EXCLUDE_PROSPECTIVELY_AND_AT_FREEZE",
});

const opportunity = (participantLineageId: string, precedingDay: string, nextActiveDay: string, overrides: Record<string, unknown> = {}) => Object.freeze({
  participantLineageId, precedingDay, nextActiveDay, fullWindowObserved: true, consented: true, eligible: true,
  unrevoked: true, platformIncidentBlocked: false, dayVersionId: VERSIONS.dayVersionId,
  incidentVersionId: VERSIONS.incidentVersionId, ...overrides,
});

const scoringKey = () => deepFreeze({
  instrumentVersionId: "survey-v1", understandingResponseIds: ["promise-understood"],
  nonUnderstandingResponseIds: ["promise-not-understood"],
});

const runInput = (events: readonly Event[], dispositions: readonly Readonly<Record<string, unknown>>[], opportunities: readonly Readonly<Record<string, unknown>>[] = [], keys = [scoringKey()]) => deepFreeze({
  versions: VERSIONS,
  events: parseAuthoritativeEventBatch(Object.freeze([...events])),
  analysisDispositions: Object.freeze([...dispositions]),
  voluntaryReturnOpportunities: Object.freeze([...opportunities]),
  comprehensionScoringKeys: Object.freeze([...keys]),
  observationBoundary: "2026-08-04T00:00:00.000Z",
});

const common = (measureId: string, rawNumerators: Record<string, number>, rawDenominator: number, missingCount = 0, excludedByReason: readonly Readonly<{reasonClass: string; count: number}>[] = []) => ({
  measureId, versions: VERSIONS, rawNumerators, rawDenominator, missingCount,
  excludedCount: excludedByReason.reduce((sum, entry) => sum + entry.count, 0), excludedByReason,
  rates: Object.fromEntries(Object.entries(rawNumerators).map(([key, value]) => [key, rawDenominator === 0 ? null : value / rawDenominator])),
});

describe("coherence denominator formulas", () => {
  it("reproduces mixed-session completion from included starts, active reveals, acknowledgements, and terminal state", () => {
    const events = [
      started("complete", "2026-08-03", "s-complete"), displayed("complete", "2026-08-03", "s-complete", "r-complete", "provenance", 1),
      answered("complete", "2026-08-03", "s-complete", "r-complete", "provenance"), revealed("2026-08-03", "r-complete"), completed("complete", "2026-08-03", "s-complete"),
      started("expired", "2026-08-03", "s-expired"), expired("expired", "2026-08-03", "s-expired"),
      started("pending", "2026-08-03", "s-pending"), started("tester", "2026-08-03", "s-tester"),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("complete"), included("expired"), pending("pending"), excluded("tester")])).mixedSessionCompletion;
    expect(result).toEqual(common("MIXED_SESSION_COMPLETION", { completed: 1 }, 2, 1, [{ reasonClass: "OPERATIONAL_TESTER", count: 1 }]));
    expect(recursivelyFrozen(result)).toBe(true);
  });

  it("requires completion acknowledgement and exact reveal coverage for every ACTIVE round without excluding unaffected corrected rounds", () => {
    const baseEvents = [started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1), answered("p", "2026-08-03", "s", "active", "provenance")];
    const noReveal = calculateCoherenceMeasures(runInput([...baseEvents, completed("p", "2026-08-03", "s")], [included("p")])).mixedSessionCompletion;
    expect(noReveal).toMatchObject({ rawNumerators: { completed: 0 }, rawDenominator: 1, missingCount: 1 });
    const noAcknowledgement = calculateCoherenceMeasures(runInput([...baseEvents, revealed("2026-08-03", "active"), completed("p", "2026-08-03", "s", 1, false)], [included("p")])).mixedSessionCompletion;
    expect(noAcknowledgement).toMatchObject({ rawNumerators: { completed: 0 }, rawDenominator: 1, missingCount: 1 });
    const withVoid = calculateCoherenceMeasures(runInput([
      ...baseEvents, revealed("2026-08-03", "active"), displayed("p", "2026-08-03", "s", "void", "language", 2),
      corrected("void", "VOID"), acknowledged("p", "s", "void", "2026-08-03T09:05:00.000Z"), completed("p", "2026-08-03", "s"),
    ], [included("p")])).mixedSessionCompletion;
    expect(withVoid).toMatchObject({ rawNumerators: { completed: 1 }, rawDenominator: 1, missingCount: 0 });
    const earlyCompletion = parseAuthoritativeEvent(deepFreeze({ ...completed("p", "2026-08-03", "s"), acceptedAt: "2026-08-03T09:02:30.000Z", completedAt: "2026-08-03T09:02:30.000Z" }));
    expect(() => calculateCoherenceMeasures(runInput([...baseEvents, revealed("2026-08-03", "active"), earlyCompletion], [included("p")]))).toThrow(/completion|chronology|reveal|time/i);
  });

  it.each([
    ["acceptance", "2026-08-03T08:59:00.000Z", "2026-08-03T09:10:00.000Z"],
    ["domain", "2026-08-03T09:10:00.000Z", "2026-08-03T08:59:00.000Z"],
  ])("rejects completion %s chronology before its session start", (_kind, acceptedAt, completedAt) => {
    const terminal = parseAuthoritativeEvent(deepFreeze({ ...completed("p", "2026-08-03", "s", 0), acceptedAt, completedAt }));
    expect(() => calculateCoherenceMeasures(runInput([started("p", "2026-08-03", "s"), terminal], [included("p")]))).toThrow(/start|completion|chronology|time/i);
  });

  it.each([
    ["acceptance", "2026-08-03T08:59:00.000Z", "2026-08-03T23:59:00.000Z"],
    ["domain", "2026-08-03T23:59:00.000Z", "2026-08-03T08:59:00.000Z"],
  ])("rejects expiry %s chronology before its session start", (_kind, acceptedAt, expiredAt) => {
    const terminal = parseAuthoritativeEvent(deepFreeze({ ...expired("p", "2026-08-03", "s"), acceptedAt, expiredAt }));
    expect(() => calculateCoherenceMeasures(runInput([started("p", "2026-08-03", "s"), terminal], [included("p")]))).toThrow(/start|expiry|chronology|time/i);
  });

  it("rejects orphan and contradictory session terminal events", () => {
    expect(() => calculateCoherenceMeasures(runInput([completed("p", "2026-08-03", "s", 0)], [included("p")]))).toThrow(/orphan|completion|start|session/i);
    expect(() => calculateCoherenceMeasures(runInput([expired("p", "2026-08-03", "s")], [included("p")]))).toThrow(/orphan|expiry|start|session/i);
    expect(() => calculateCoherenceMeasures(runInput([
      started("p", "2026-08-03", "s"), completed("p", "2026-08-03", "s", 0), expired("p", "2026-08-03", "s"),
    ], [included("p")]))).toThrow(/both|completed|expired|terminal/i);
  });

  it("rejects correction acknowledgement chronology after completion", () => {
    const events = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"),
      displayed("p", "2026-08-03", "s", "void", "language", 2), corrected("void", "VOID"),
      completed("p", "2026-08-03", "s"), acknowledged("p", "s", "void", "2026-08-03T09:11:00.000Z"),
    ];
    expect(() => calculateCoherenceMeasures(runInput(events, [included("p")]))).toThrow(/acknowledg|completion|chronology|time/i);
  });

  it("requires an exact correction acknowledgement before corrected completion", () => {
    const prefix = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"),
      displayed("p", "2026-08-03", "s", "void", "language", 2), corrected("void", "VOID"),
    ];
    expect(calculateCoherenceMeasures(runInput([...prefix, completed("p", "2026-08-03", "s")], [included("p")])).mixedSessionCompletion)
      .toMatchObject({ rawNumerators: { completed: 0 }, rawDenominator: 1, missingCount: 1 });
    expect(calculateCoherenceMeasures(runInput([
      ...prefix, acknowledged("p", "s", "void", "2026-08-03T09:05:00.000Z"), completed("p", "2026-08-03", "s"),
    ], [included("p")])).mixedSessionCompletion).toMatchObject({ rawNumerators: { completed: 1 }, rawDenominator: 1, missingCount: 0 });

    const wrongParticipant = acknowledged("other", "s", "void", "2026-08-03T09:05:00.000Z");
    const wrongSession = acknowledged("p", "other-session", "void", "2026-08-03T09:05:00.000Z");
    const wrongRound = acknowledged("p", "s", "other-round", "2026-08-03T09:05:00.000Z");
    const wrongVersion = parseAuthoritativeEvent(deepFreeze({
      ...acknowledged("p", "s", "void", "2026-08-03T09:05:00.000Z"), eventId: "ack-wrong-version", correctionVersionId: "wrong-correction-policy",
    }));
    for (const invalid of [wrongParticipant, wrongSession, wrongRound, wrongVersion]) {
      expect(() => calculateCoherenceMeasures(runInput([...prefix, invalid, completed("p", "2026-08-03", "s")], [included("p")]))).toThrow(/acknowledg|orphan|scope|correction|version|join/i);
    }
    expect(() => calculateCoherenceMeasures(runInput([
      acknowledged("p", "s", "orphan", "2026-08-03T09:05:00.000Z"),
    ], [included("p")]))).toThrow(/acknowledg|orphan|correction|join/i);
    expect(() => calculateCoherenceMeasures(runInput([
      ...prefix, acknowledged("p", "s", "void", "2026-08-03T09:03:00.000Z"), completed("p", "2026-08-03", "s"),
    ], [included("p")]))).toThrow(/acknowledg|correction|chronology|time/i);
  });

  it.each([
    ["acceptance", "2026-08-03T09:05:00.000Z", "2026-08-03T09:03:00.000Z"],
    ["domain", "2026-08-03T09:03:00.000Z", "2026-08-03T09:05:00.000Z"],
  ])("rejects pre-correction acknowledgement %s chronology independently", (_kind, acknowledgedAt, acceptedAt) => {
    const events = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"),
      displayed("p", "2026-08-03", "s", "void", "language", 2), corrected("void", "VOID"),
      acknowledged("p", "s", "void", acknowledgedAt, acceptedAt), completed("p", "2026-08-03", "s"),
    ];
    expect(() => calculateCoherenceMeasures(runInput(events, [included("p")]))).toThrow(/acknowledg|correction|chronology|time/i);
  });

  it.each([
    ["accepted after completion", "2026-08-03T09:05:00.000Z", "2026-08-03T09:11:00.000Z"],
    ["acknowledged after completion", "2026-08-03T09:11:00.000Z", "2026-08-03T09:05:00.000Z"],
  ])("rejects correction acknowledgement %s", (_kind, acknowledgedAt, acceptedAt) => {
    const events = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"),
      displayed("p", "2026-08-03", "s", "void", "language", 2), corrected("void", "VOID"),
      acknowledged("p", "s", "void", acknowledgedAt, acceptedAt), completed("p", "2026-08-03", "s"),
    ];
    expect(() => calculateCoherenceMeasures(runInput(events, [included("p")]))).toThrow(/acknowledg|completion|chronology|time/i);
  });

  it("freezes corrections by effective time as well as acceptance time", () => {
    const futureCorrection = parseAuthoritativeEvent(deepFreeze({
      ...corrected("active", "VOID"), acceptedAt: "2026-08-03T09:04:00.000Z", effectiveAt: "2026-08-05T09:04:00.000Z",
    }));
    const events = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"),
      futureCorrection, completed("p", "2026-08-03", "s"),
    ];
    expect(calculateCoherenceMeasures(runInput(events, [included("p")])).mixedSessionCompletion)
      .toEqual(common("MIXED_SESSION_COMPLETION", { completed: 1 }, 1));

    const lateAcceptedCorrection = parseAuthoritativeEvent(deepFreeze({
      ...corrected("active", "VOID"), acceptedAt: "2026-08-05T09:04:00.000Z", effectiveAt: "2026-08-03T09:04:00.000Z", eventId: "correction-active-late-accepted",
    }));
    expect(calculateCoherenceMeasures(runInput([...events.filter((event) => event !== futureCorrection), lateAcceptedCorrection], [included("p")])).mixedSessionCompletion)
      .toEqual(common("MIXED_SESSION_COMPLETION", { completed: 1 }, 1));

    for (const instant of ["2026-08-03T09:04:00.000Z", "2026-08-04T00:00:00.000Z"]) {
      const applied = parseAuthoritativeEvent(deepFreeze({
        ...corrected("active", "VOID"), acceptedAt: instant, effectiveAt: instant, eventId: `correction-active-${instant}`,
      }));
      expect(calculateCoherenceMeasures(runInput([
        started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1), applied,
      ], [included("p")])).modeAbandonment.provenance).toEqual(common(
        "MODE_ABANDONMENT_PROVENANCE", { abandoned: 0 }, 0, 0, [{ reasonClass: "ROUND_VOID", count: 1 }],
      ));
    }
  });

  it("fails closed on participant dispositions effective after the observation boundary and accepts equality", () => {
    const events = [
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1),
      answered("p", "2026-08-03", "s", "active", "provenance"), revealed("2026-08-03", "active"), completed("p", "2026-08-03", "s"),
    ];
    expect(() => calculateCoherenceMeasures(runInput(events, [
      excluded("p", "AUTHENTICATED_WITHDRAWAL", "2026-08-05T09:04:00.000Z"),
    ]))).toThrow(/disposition|effective|observation|boundary|freeze/i);
    expect(calculateCoherenceMeasures(deepFreeze({
      ...runInput(events, [excluded("p", "AUTHENTICATED_WITHDRAWAL", "2026-08-04T00:00:00.000Z")]),
      observationBoundary: "2026-08-04T00:00:00.000Z",
    })).mixedSessionCompletion).toEqual(common(
      "MIXED_SESSION_COMPLETION", { completed: 0 }, 0, 0, [{ reasonClass: "AUTHENTICATED_WITHDRAWAL", count: 1 }],
    ));
  });

  it.each([
    ["reveal acceptance", "2026-08-03T09:03:00.000Z", "2026-08-03T09:11:00.000Z", "2026-08-03T09:10:00.000Z"],
    ["reveal domain", "2026-08-03T09:11:00.000Z", "2026-08-03T09:03:00.000Z", "2026-08-03T09:10:00.000Z"],
    ["expiry acceptance", "2026-08-03T09:03:00.000Z", "2026-08-04T00:00:00.000Z", "2026-08-03T23:59:00.000Z"],
    ["expiry reveal domain", "2026-08-04T00:00:00.000Z", "2026-08-03T09:03:00.000Z", "2026-08-03T23:59:00.000Z"],
  ])("rejects terminal interaction chronology for %s", (kind, revealedAt, acceptedAt, terminalAt) => {
    const answer = answered("p", "2026-08-03", "s", "active", "provenance");
    const reveal = parseAuthoritativeEvent(deepFreeze({ ...revealed("2026-08-03", "active"), revealedAt, acceptedAt }));
    const terminal = kind.startsWith("expiry")
      ? parseAuthoritativeEvent(deepFreeze({ ...expired("p", "2026-08-03", "s", 1), expiredAt: terminalAt, acceptedAt: terminalAt }))
      : parseAuthoritativeEvent(deepFreeze({ ...completed("p", "2026-08-03", "s"), completedAt: terminalAt, acceptedAt: terminalAt }));
    expect(() => calculateCoherenceMeasures(runInput([
      started("p", "2026-08-03", "s"), displayed("p", "2026-08-03", "s", "active", "provenance", 1), answer, reveal, terminal,
    ], [included("p")]))).toThrow(/reveal|completion|expiry|terminal|chronology|time/i);
  });

  it("reproduces voluntary return only after a full equal next-active-day observation window", () => {
    const events = [
      started("returned", "2026-08-02", "s-r1"), started("returned", "2026-08-03", "s-r2"),
      started("absent", "2026-08-02", "s-a1"), started("short", "2026-08-02", "s-short"),
      started("incident", "2026-08-02", "s-incident"), started("revoked", "2026-08-02", "s-revoked"),
    ];
    const opportunities = [
      opportunity("returned", "2026-08-02", "2026-08-03"), opportunity("absent", "2026-08-02", "2026-08-03"),
      opportunity("short", "2026-08-02", "2026-08-03", { fullWindowObserved: false }),
      opportunity("incident", "2026-08-02", "2026-08-03", { platformIncidentBlocked: true }),
      opportunity("revoked", "2026-08-02", "2026-08-03", { unrevoked: false }),
    ];
    const dispositions = [included("returned"), included("absent"), pending("short"), included("incident"), excluded("revoked", "AUTHENTICATED_WITHDRAWAL")];
    const result = calculateCoherenceMeasures(runInput(events, dispositions, opportunities)).voluntaryReturn;
    expect(result).toEqual(common("VOLUNTARY_RETURN", { returned: 1 }, 2, 1, [
      { reasonClass: "AUTHENTICATED_WITHDRAWAL", count: 1 }, { reasonClass: "PLATFORM_INCIDENT", count: 1 },
    ]));
    expect(() => calculateCoherenceMeasures(runInput([], [included("fabricated")], [opportunity("fabricated", "2026-08-02", "2026-08-03")]))).toThrow(/opportunity|preceding|start/i);
  });

  it("reproduces immediate transition continuation only for terminal positions one through four", () => {
    const events = [
      started("continued", "2026-08-03", "s1"), displayed("continued", "2026-08-03", "s1", "r1", "provenance", 1), answered("continued", "2026-08-03", "s1", "r1", "provenance"), revealed("2026-08-03", "r1"), displayed("continued", "2026-08-03", "s1", "r2", "language", 2, "2026-08-03T09:04:00.000Z"),
      started("stopped", "2026-08-03", "s2"), displayed("stopped", "2026-08-03", "s2", "r3", "provenance", 1), answered("stopped", "2026-08-03", "s2", "r3", "provenance"), revealed("2026-08-03", "r3"), expired("stopped", "2026-08-03", "s2", 1),
      started("open", "2026-08-03", "s3"), displayed("open", "2026-08-03", "s3", "r4", "provenance", 1),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("continued"), included("stopped"), included("open")])).transitionContinuation;
    expect(result).toEqual(common("TRANSITION_CONTINUATION", { continued: 1 }, 2, 1));
  });

  it("does not skip an absent ACTIVE ordinal and preserves pending/excluded terminal observations", () => {
    const events = [
      displayed("included", "2026-08-03", "si", "i1", "provenance", 1), answered("included", "2026-08-03", "si", "i1", "provenance"), revealed("2026-08-03", "i1"), displayed("included", "2026-08-03", "si", "i3", "language", 3),
      displayed("pending", "2026-08-03", "sp", "p1", "provenance", 1), answered("pending", "2026-08-03", "sp", "p1", "provenance"), revealed("2026-08-03", "p1"),
      displayed("excluded", "2026-08-03", "se", "e1", "provenance", 1), answered("excluded", "2026-08-03", "se", "e1", "provenance"), revealed("2026-08-03", "e1"),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("included"), pending("pending"), excluded("excluded")])).transitionContinuation;
    expect(result).toMatchObject({ rawNumerators: { continued: 0 }, rawDenominator: 1, missingCount: 2, excludedCount: 1,
      excludedByReason: [{ reasonClass: "OPERATIONAL_TESTER", count: 1 }] });
  });

  it("continues from a terminal ACTIVE position across a corrected position to the immediately following ACTIVE position", () => {
    const events = [
      started("p", "2026-08-03", "s"),
      displayed("p", "2026-08-03", "s", "active-one", "provenance", 1), answered("p", "2026-08-03", "s", "active-one", "provenance"), revealed("2026-08-03", "active-one"),
      displayed("p", "2026-08-03", "s", "void-two", "language", 2, "2026-08-03T09:04:00.000Z"), corrected("void-two", "VOID"),
      displayed("p", "2026-08-03", "s", "active-three", "provenance", 3, "2026-08-03T10:01:00.000Z"),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("p")])).transitionContinuation;
    expect(result).toEqual(common("TRANSITION_CONTINUATION", { continued: 1 }, 1, 0, [{ reasonClass: "ROUND_VOID", count: 1 }]));
  });

  it("separates mode abandonment and excludes corrected rounds without rewriting answers", () => {
    const events = [
      started("p", "2026-08-03", "sp"), displayed("p", "2026-08-03", "sp", "p-answered", "provenance", 1), answered("p", "2026-08-03", "sp", "p-answered", "provenance"),
      displayed("p", "2026-08-03", "sp", "p-abandoned", "provenance", 2), expired("p", "2026-08-03", "sp", 1),
      started("l", "2026-08-03", "sl"), displayed("l", "2026-08-03", "sl", "l-open", "language", 1),
      displayed("l", "2026-08-03", "sl", "l-void", "language", 2), answered("l", "2026-08-03", "sl", "l-void", "language"), corrected("l-void", "CONTENT_WITHDRAWN"),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("p"), included("l")])).modeAbandonment;
    expect(result.provenance).toEqual(common("MODE_ABANDONMENT_PROVENANCE", { abandoned: 1 }, 2));
    expect(result.language).toEqual(common("MODE_ABANDONMENT_LANGUAGE", { abandoned: 0 }, 1, 1, [{ reasonClass: "ROUND_CONTENT_WITHDRAWN", count: 1 }]));
  });

  it("treats withdrawal as a terminal abandonment boundary but excludes the withdrawn lineage from frozen analysis", () => {
    const events = [
      started("withdrawn", "2026-08-03", "sw"), displayed("withdrawn", "2026-08-03", "sw", "withdrawn-round", "provenance", 1), withdrawal("withdrawn"),
      started("open", "2026-08-03", "so"), displayed("open", "2026-08-03", "so", "open-round", "provenance", 1),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [
      excluded("withdrawn", "AUTHENTICATED_WITHDRAWAL", "2026-08-03T09:05:00.000Z"), included("open"),
    ])).modeAbandonment.provenance;
    expect(result).toEqual(common("MODE_ABANDONMENT_PROVENANCE", { abandoned: 0 }, 1, 1, [{ reasonClass: "AUTHENTICATED_WITHDRAWAL", count: 1 }]));
  });

  it("does not let an answer accepted after session expiry suppress abandonment", () => {
    const display = displayed("p", "2026-08-03", "s", "late-answer", "provenance", 1);
    const lateAnswer = parseAuthoritativeEvent(deepFreeze({ ...answered("p", "2026-08-03", "s", "late-answer", "provenance"), acceptedAt: "2026-08-04T00:00:00.000Z" }));
    const result = calculateCoherenceMeasures(runInput([started("p", "2026-08-03", "s"), display, expired("p", "2026-08-03", "s"), lateAnswer], [included("p")])).modeAbandonment.provenance;
    expect(result).toMatchObject({ rawNumerators: { abandoned: 1 }, rawDenominator: 1, missingCount: 0 });
  });

  it("counts zero, at-least-one, and both clues separately by mode", () => {
    const events = [
      displayed("p", "2026-08-03", "sp", "p0", "provenance", 1), answered("p", "2026-08-03", "sp", "p0", "provenance", 0),
      displayed("p", "2026-08-03", "sp", "p1", "provenance", 2), clue("p", "2026-08-03", "sp", "p1", 1), answered("p", "2026-08-03", "sp", "p1", "provenance", 1),
      displayed("l", "2026-08-03", "sl", "l2", "language", 1), clue("l", "2026-08-03", "sl", "l2", 1), clue("l", "2026-08-03", "sl", "l2", 2), answered("l", "2026-08-03", "sl", "l2", "language", 2),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [included("p"), included("l")])).modeClueUse;
    expect(result.provenance).toEqual(common("MODE_CLUE_USE_PROVENANCE", { atLeastOne: 1, both: 0 }, 2));
    expect(result.language).toEqual(common("MODE_CLUE_USE_LANGUAGE", { atLeastOne: 1, both: 1 }, 1));
  });

  it("reproduces response sufficiency from unique included offers and eligible submissions before freeze", () => {
    const events = [offered("yes"), submitted("yes", ["promise-understood"]), offered("missing"), offered("late"), submitted("late", ["promise-understood"], "2026-08-05T00:00:00.000Z"), offered("tester"), submitted("tester", ["promise-understood"])];
    const result = calculateCoherenceMeasures(runInput(events, [included("yes"), included("missing"), included("late"), excluded("tester")])).responseSufficiency;
    expect(result).toEqual(common("RESPONSE_SUFFICIENCY", { submitted: 1 }, 3, 2, [{ reasonClass: "OPERATIONAL_TESTER", count: 1 }]));
  });

  it("rejects pre-offer submissions and treats submissions after the signed response window as missing", () => {
    const early = submitted("early", ["promise-understood"], "2026-08-03T10:00:00.000Z");
    expect(() => calculateCoherenceMeasures(runInput([offered("early"), early], [included("early")]))).toThrow(/offer|chronology|submission|time/i);
    const afterWindow = submitted("after", ["promise-understood"], "2026-08-04T12:00:00.000Z");
    const result = calculateCoherenceMeasures(deepFreeze({ ...runInput([offered("after"), afterWindow], [included("after")]), observationBoundary: "2026-08-05T00:00:00.000Z" })).responseSufficiency;
    expect(result).toMatchObject({ rawNumerators: { submitted: 0 }, rawDenominator: 1, missingCount: 1 });
  });

  it("scores shared-promise comprehension only from the frozen closed-response key", () => {
    const events = [offered("understands"), submitted("understands", ["promise-understood"]), offered("does-not"), submitted("does-not", ["promise-not-understood"]), offered("unknown"), submitted("unknown", ["unscored-response"])];
    const result = calculateCoherenceMeasures(runInput(events, [included("understands"), included("does-not"), included("unknown")])).sharedPromiseComprehension;
    expect(result).toEqual(common("SHARED_PROMISE_COMPREHENSION", { understands: 1 }, 2, 1));
    expect(() => calculateCoherenceMeasures(runInput([offered("ambiguous"), submitted("ambiguous", ["promise-understood", "promise-not-understood"])], [included("ambiguous")]))).toThrow(/ambiguous|multiple|response/i);
    expect(() => calculateCoherenceMeasures(runInput([submitted("orphan", ["promise-understood"])], [included("orphan")]))).toThrow(/offer|orphan|submission/i);
    const excludedSubmission = parseAuthoritativeEvent(deepFreeze({ ...submitted("ineligible", ["promise-understood"]), analyticalInclusionState: "EXCLUDED" }));
    expect(() => calculateCoherenceMeasures(runInput([offered("ineligible"), excludedSubmission], [included("ineligible")]))).toThrow(/inclusion|submission|disposition/i);
  });

  it("reports unique critical defects by latest state at the frozen boundary and never invents a zero-defect rate", () => {
    const events = [
      defect("d1", "OPENED", "2026-08-02T10:00:00.000Z", "BLOCK_RELEASE"),
      defect("d1", "RESOLVED", "2026-08-03T10:00:00.000Z", "CLEAR_BLOCK"),
      defect("d2", "OPENED", "2026-08-03T11:00:00.000Z", "BLOCK_RELEASE"),
      defect("future", "OPENED", "2026-08-05T10:00:00.000Z", "BLOCK_RELEASE"),
    ];
    const result = calculateCoherenceMeasures(runInput(events, [])).criticalDefectStatus;
    expect(result).toEqual({
      measureId: "CRITICAL_DEFECT_STATUS", versions: VERSIONS,
      rawNumerators: { opened: 2, resolved: 1, unresolved: 1, releaseBlocking: 1 }, rawDenominator: 2,
      missingCount: 0, excludedCount: 0, excludedByReason: [], releaseBlockingDecisionCounts: [
        { releaseBlockingDecision: "BLOCK_RELEASE", count: 1 }, { releaseBlockingDecision: "CLEAR_BLOCK", count: 1 },
      ],
    });
    const empty = calculateCoherenceMeasures(runInput([], [])).criticalDefectStatus;
    expect(empty.rawDenominator).toBe(0);
    expect(empty).not.toHaveProperty("rates");
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
    expect(() => calculateCoherenceMeasures(runInput([defect("orphan", "RESOLVED", "2026-08-03T10:00:00.000Z", "CLEAR_BLOCK")], []))).toThrow(/open|defect|state/i);
    expect(() => calculateCoherenceMeasures(runInput([
      defect("repeat", "OPENED", "2026-08-03T09:00:00.000Z", "BLOCK_RELEASE"), defect("repeat", "OPENED", "2026-08-03T10:00:00.000Z", "BLOCK_RELEASE"),
    ], []))).toThrow(/transition|repeat|state|defect/i);
    expect(() => calculateCoherenceMeasures(runInput([defect("unknown", "OPENED", "2026-08-03T10:00:00.000Z", "NOT_BLOCK")], []))).toThrow(/decision|class|blocking/i);
    const nonCritical = parseAuthoritativeEvent(deepFreeze({ ...defect("high", "OPENED", "2026-08-03T10:00:00.000Z", "BLOCK_RELEASE"), severity: "HIGH" }));
    expect(() => calculateCoherenceMeasures(runInput([nonCritical], []))).toThrow(/critical|severity/i);
  });

  it("binds applicable start and correction versions and ignores events accepted after the observation boundary", () => {
    const wrongStart = parseAuthoritativeEvent(deepFreeze({ ...started("p", "2026-08-03", "s"), eligibilityVersionId: "wrong" }));
    expect(() => calculateCoherenceMeasures(runInput([wrongStart], [included("p")]))).toThrow(/eligibility|version/i);
    const wrongCorrection = parseAuthoritativeEvent(deepFreeze({ ...corrected("r", "VOID"), correctionVersionId: "wrong" }));
    expect(() => calculateCoherenceMeasures(runInput([wrongCorrection], []))).toThrow(/correction|version/i);
    const futureStart = started("future", "2026-08-05", "future-session");
    expect(calculateCoherenceMeasures(runInput([futureStart], [included("future")])).mixedSessionCompletion.rawDenominator).toBe(0);
  });

  it("keeps every output detached, recursively frozen, raw, versioned, and free of gate decisions", () => {
    const first = calculateCoherenceMeasures(runInput([], []));
    const second = calculateCoherenceMeasures(runInput([], []));
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(recursivelyFrozen(first)).toBe(true);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toMatch(/"(?:PASS|FAIL|INDETERMINATE|OPEN|PAUSE)"/u);
    expect(serialized).not.toMatch(/threshold|recommend|causal|equalDifficulty|combinedScore/i);
  });
});
