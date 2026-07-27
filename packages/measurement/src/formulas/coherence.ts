import type { AuthoritativeEvent } from "../events/index.js";
import {
  addExclusion,
  correctionReasons,
  dispositionsByParticipant,
  fail,
  metric,
  parseCoherenceInput,
  type AnalysisDisposition,
  type CoherenceFormulaInput,
  type ComprehensionScoringKey,
} from "./types.js";

type Family = AuthoritativeEvent["eventFamilyId"];
type EventOf<F extends Family> = Extract<AuthoritativeEvent, { readonly eventFamilyId: F }>;
type Mode = "provenance" | "language";

const ofFamily = <F extends Family>(input: CoherenceFormulaInput, family: F): readonly EventOf<F>[] =>
  input.events.filter((event): event is EventOf<F> => event.eventFamilyId === family);
const sessionKey = (event: { readonly participantLineageId: string; readonly betaDay: string; readonly manifestLineageId: string; readonly manifestVersionId: string; readonly sessionId: string }): string =>
  `${event.participantLineageId}|${event.betaDay}|${event.manifestLineageId}|${event.manifestVersionId}|${event.sessionId}`;
const roundKey = (event: { readonly participantLineageId: string; readonly betaDay: string; readonly manifestLineageId: string; readonly manifestVersionId: string; readonly sessionId: string; readonly roundId: string }): string =>
  `${event.participantLineageId}|${event.betaDay}|${event.manifestLineageId}|${event.manifestVersionId}|${event.sessionId}|${event.roundId}`;

const classify = (disposition: AnalysisDisposition | undefined): "MISSING" | "INCLUDED" | "EXCLUDED" =>
  disposition === undefined || disposition.state === "PENDING" ? "MISSING" : disposition.state;
const exclusionReason = (disposition: AnalysisDisposition): string =>
  disposition.state === "EXCLUDED" ? disposition.reasonClass : fail("Expected exclusion disposition");

const uniqueBy = <T>(values: readonly T[], key: (value: T) => string, label: string): ReadonlyMap<string, T> => {
  const map = new Map<string, T>();
  for (const value of values) {
    const identity = key(value);
    if (map.has(identity)) fail(`Ambiguous duplicate ${label}`);
    map.set(identity, value);
  }
  return map;
};

const eventJoins = (input: CoherenceFormulaInput) => {
  const displays = ofFamily(input, "ROUND_DISPLAYED");
  const answers = ofFamily(input, "ANSWER_ACCEPTED");
  const reveals = ofFamily(input, "REVEAL_AUTHORIZED");
  const displaysByRound = uniqueBy(displays, roundKey, "round display");
  const answersByRound = uniqueBy(answers, roundKey, "answer round join");
  const answersById = uniqueBy(answers, (event) => event.eventId, "answer identifier");
  const revealsByAnswer = uniqueBy(reveals, (event) => event.acceptedAnswerId, "answer reveal join");
  const answerIds = new Set(answers.map((answer) => answer.eventId));
  for (const answer of answers) {
    const display = displaysByRound.get(roundKey(answer));
    if (!display || display.mode !== answer.mode) fail("Answer does not match its full displayed-round scope and mode");
    if (answer.acceptedAt < display.displayedAt) fail("Answer chronology precedes display");
  }
  for (const reveal of reveals) {
    if (!answerIds.has(reveal.acceptedAnswerId)) fail("Reveal is orphaned from an accepted answer");
    const answer = answers.find((candidate) => candidate.eventId === reveal.acceptedAnswerId)!;
    if (reveal.revealedAt < answer.acceptedAt || reveal.acceptedAt < answer.acceptedAt) fail("Reveal chronology precedes answer");
  }
  for (const clue of ofFamily(input, "CLUE_REVEALED")) {
    const display = displaysByRound.get(roundKey(clue));
    if (!display || clue.acceptedAt < display.displayedAt) fail("Clue chronology or display scope is invalid");
    const answer = answersByRound.get(roundKey(clue));
    if (answer && clue.acceptedAt > answer.acceptedAt) fail("Clue was accepted after the answer");
  }
  return {
    displays,
    answersByRound,
    answersById,
    revealsByAnswer,
  };
};

const acknowledgementKey = (event: { readonly participantLineageId: string; readonly sessionId: string; readonly roundId: string }): string =>
  `${event.participantLineageId}|${event.sessionId}|${event.roundId}`;

const mixedSessionCompletion = (input: CoherenceFormulaInput) => {
  const starts = ofFamily(input, "SESSION_STARTED");
  const completions = uniqueBy(ofFamily(input, "SESSION_COMPLETED"), sessionKey, "session completion");
  const expiries = uniqueBy(ofFamily(input, "SESSION_EXPIRED"), sessionKey, "session expiry");
  const startMap = uniqueBy(starts, sessionKey, "session start");
  const dispositions = dispositionsByParticipant(input);
  const corrections = correctionReasons(input.events);
  const joins = eventJoins(input);
  for (const completion of completions.values()) {
    const start = startMap.get(sessionKey(completion));
    if (!start) fail("Session completion is orphaned from its session start");
    if (completion.acceptedAt < start.acceptedAt || completion.completedAt < start.startedAt) fail("Session completion chronology precedes its session start");
    if (expiries.has(sessionKey(completion))) fail("Session cannot be both completed and expired");
  }
  for (const expiry of expiries.values()) {
    const start = startMap.get(sessionKey(expiry));
    if (!start) fail("Session expiry is orphaned from its session start");
    if (expiry.acceptedAt < start.acceptedAt || expiry.expiredAt < start.startedAt) fail("Session expiry chronology precedes its session start");
  }
  for (const reveal of joins.revealsByAnswer.values()) {
    const answer = joins.answersById.get(reveal.acceptedAnswerId)!;
    const completion = completions.get(sessionKey(answer));
    const expiry = expiries.get(sessionKey(answer));
    if (completion && (reveal.acceptedAt > completion.acceptedAt || reveal.revealedAt > completion.completedAt)) fail("Reveal chronology follows session completion");
    if (expiry && (reveal.acceptedAt > expiry.acceptedAt || reveal.revealedAt > expiry.expiredAt)) fail("Reveal chronology follows session expiry");
  }
  const correctionEvents = uniqueBy(ofFamily(input, "ROUND_CORRECTED"), (event) => event.roundId, "round correction");
  const correctedDisplays = uniqueBy(joins.displays.filter((display) => correctionEvents.has(display.roundId)), acknowledgementKey, "corrected-round display");
  const acknowledgements = uniqueBy(ofFamily(input, "CORRECTION_NOTICE_ACKNOWLEDGED"), acknowledgementKey, "correction acknowledgement");
  for (const acknowledgement of acknowledgements.values()) {
    const display = correctedDisplays.get(acknowledgementKey(acknowledgement));
    const correction = correctionEvents.get(acknowledgement.roundId);
    if (!display || !correction) fail("Correction acknowledgement is orphaned from its exact corrected-round scope");
    if (acknowledgement.correctionVersionId !== correction.correctionVersionId) fail("Correction acknowledgement version does not match its correction");
    if (acknowledgement.acceptedAt < correction.acceptedAt || acknowledgement.acknowledgedAt < correction.effectiveAt) fail("Correction acknowledgement chronology precedes its correction");
    const completion = completions.get(sessionKey(display));
    if (completion && (acknowledgement.acceptedAt > completion.acceptedAt || acknowledgement.acknowledgedAt > completion.completedAt)) fail("Correction acknowledgement chronology follows session completion");
  }
  const exclusions = new Map<string, number>();
  let denominator = 0; let completed = 0; let missing = 0;
  for (const start of [...startMap.values()].sort((a, b) => sessionKey(a).localeCompare(sessionKey(b)))) {
    const disposition = dispositions.get(start.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    denominator += 1;
    const key = sessionKey(start);
    const completion = completions.get(key);
    const expiry = expiries.get(key);
    if (!completion) { if (!expiry) missing += 1; continue; }
    const activeDisplays = joins.displays.filter((display) => sessionKey(display) === key && !corrections.has(display.roundId));
    const sessionCorrectedDisplays = joins.displays.filter((display) => sessionKey(display) === key && corrections.has(display.roundId));
    const allCorrectionNoticesAcknowledged = sessionCorrectedDisplays.every((display) => acknowledgements.has(acknowledgementKey(display)));
    let authorizedRevealCount = 0;
    for (const display of activeDisplays) {
      const answer = joins.answersByRound.get(roundKey(display));
      const reveal = answer ? joins.revealsByAnswer.get(answer.eventId) : undefined;
      if (reveal) {
        if (reveal.revealedAt > completion.completedAt) fail("Session completion chronology precedes an active-round reveal");
        authorizedRevealCount += 1;
      }
    }
    if (completion.acknowledgementCompleteness && allCorrectionNoticesAcknowledged && authorizedRevealCount === completion.roundCounts.ACTIVE && activeDisplays.length === completion.roundCounts.ACTIVE) completed += 1;
    else missing += 1;
  }
  return metric("MIXED_SESSION_COMPLETION", input.versions, Object.freeze({ completed }), denominator, missing, exclusions);
};

const voluntaryReturn = (input: CoherenceFormulaInput) => {
  const starts = ofFamily(input, "SESSION_STARTED");
  const dispositions = dispositionsByParticipant(input);
  const exclusions = new Map<string, number>();
  let denominator = 0; let returned = 0; let missing = 0;
  for (const opportunity of input.voluntaryReturnOpportunities) {
    const preceding = starts.some((event) => event.participantLineageId === opportunity.participantLineageId && event.betaDay === opportunity.precedingDay);
    if (!preceding) fail("Voluntary-return opportunity has no preceding-day SESSION_STARTED event");
    const disposition = dispositions.get(opportunity.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    if (opportunity.platformIncidentBlocked) { addExclusion(exclusions, "PLATFORM_INCIDENT"); continue; }
    if (!opportunity.consented || !opportunity.eligible || !opportunity.unrevoked) { addExclusion(exclusions, "VOLUNTARY_RETURN_INELIGIBLE"); continue; }
    if (!opportunity.fullWindowObserved) { missing += 1; continue; }
    denominator += 1;
    if (starts.some((event) => event.participantLineageId === opportunity.participantLineageId && event.betaDay === opportunity.nextActiveDay)) returned += 1;
  }
  return metric("VOLUNTARY_RETURN", input.versions, Object.freeze({ returned }), denominator, missing, exclusions);
};

const transitionContinuation = (input: CoherenceFormulaInput) => {
  const joins = eventJoins(input);
  const dispositions = dispositionsByParticipant(input);
  const corrections = correctionReasons(input.events);
  const terminalSessions = new Set([...ofFamily(input, "SESSION_COMPLETED"), ...ofFamily(input, "SESSION_EXPIRED")].map(sessionKey));
  const exclusions = new Map<string, number>();
  let denominator = 0; let continued = 0; let missing = 0;
  const displaysBySession = new Map<string, EventOf<"ROUND_DISPLAYED">[]>();
  for (const display of joins.displays) {
    const key = sessionKey(display);
    const group = displaysBySession.get(key) ?? [];
    group.push(display); displaysBySession.set(key, group);
  }
  const continuedInto = new Set<string>();
  for (const group of displaysBySession.values()) group.sort((a, b) => a.ordinalPosition - b.ordinalPosition);
  for (const display of [...joins.displays].sort((a, b) => roundKey(a).localeCompare(roundKey(b)))) {
    if (display.ordinalPosition > 4) continue;
    const disposition = dispositions.get(display.participantLineageId);
    const state = classify(disposition);
    const correction = corrections.get(display.roundId);
    if (correction) { addExclusion(exclusions, correction); continue; }
    const answer = joins.answersByRound.get(roundKey(display));
    const terminal = answer !== undefined && joins.revealsByAnswer.has(answer.eventId);
    if (!terminal) continue;
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    denominator += 1;
    const later = (displaysBySession.get(sessionKey(display)) ?? []).filter((candidate) => candidate.ordinalPosition > display.ordinalPosition);
    const firstLater = later[0];
    if (firstLater) continuedInto.add(roundKey(firstLater));
    let expectedOrdinal = display.ordinalPosition + 1;
    let next: EventOf<"ROUND_DISPLAYED"> | undefined;
    while (expectedOrdinal <= 5) {
      const atOrdinal = later.find((candidate) => candidate.ordinalPosition === expectedOrdinal);
      if (!atOrdinal) break;
      if (!corrections.has(atOrdinal.roundId)) { next = atOrdinal; break; }
      expectedOrdinal += 1;
    }
    const reveal = joins.revealsByAnswer.get(answer!.eventId)!;
    if (next && next.displayedAt < reveal.revealedAt) fail("Following round was displayed before terminal reveal");
    if (next) { continued += 1; continuedInto.add(roundKey(next)); }
    else if (!terminalSessions.has(sessionKey(display))) missing += 1;
  }
  for (const display of joins.displays) {
    if (display.ordinalPosition > 4 || corrections.has(display.roundId) || continuedInto.has(roundKey(display))) continue;
    const disposition = dispositions.get(display.participantLineageId);
    if (classify(disposition) !== "INCLUDED") continue;
    const answer = joins.answersByRound.get(roundKey(display));
    if (!answer || !joins.revealsByAnswer.has(answer.eventId)) missing += 1;
  }
  return metric("TRANSITION_CONTINUATION", input.versions, Object.freeze({ continued }), denominator, missing, exclusions);
};

const modeAbandonment = (input: CoherenceFormulaInput, mode: Mode) => {
  const joins = eventJoins(input);
  const dispositions = dispositionsByParticipant(input);
  const corrections = correctionReasons(input.events);
  const expiries = uniqueBy(ofFamily(input, "SESSION_EXPIRED"), sessionKey, "session expiry");
  const exclusions = new Map<string, number>();
  let denominator = 0; let abandoned = 0; let missing = 0;
  for (const display of joins.displays.filter((entry) => entry.mode === mode).sort((a, b) => roundKey(a).localeCompare(roundKey(b)))) {
    const correction = corrections.get(display.roundId);
    if (correction) { addExclusion(exclusions, correction); continue; }
    const disposition = dispositions.get(display.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    denominator += 1;
    const expiry = expiries.get(sessionKey(display));
    const answer = joins.answersByRound.get(roundKey(display));
    if (answer && (!expiry || answer.acceptedAt <= expiry.expiredAt)) continue;
    if (expiry && display.displayedAt <= expiry.expiredAt) abandoned += 1;
    else missing += 1;
  }
  return metric(`MODE_ABANDONMENT_${mode.toUpperCase()}`, input.versions, Object.freeze({ abandoned }), denominator, missing, exclusions);
};

const modeClueUse = (input: CoherenceFormulaInput, mode: Mode) => {
  const joins = eventJoins(input);
  const clues = ofFamily(input, "CLUE_REVEALED");
  const dispositions = dispositionsByParticipant(input);
  const corrections = correctionReasons(input.events);
  const terminalSessions = new Set([...ofFamily(input, "SESSION_COMPLETED"), ...ofFamily(input, "SESSION_EXPIRED")].map(sessionKey));
  const exclusions = new Map<string, number>();
  let denominator = 0; let atLeastOne = 0; let both = 0; let missing = 0;
  for (const display of joins.displays.filter((entry) => entry.mode === mode).sort((a, b) => roundKey(a).localeCompare(roundKey(b)))) {
    const correction = corrections.get(display.roundId);
    if (correction) { addExclusion(exclusions, correction); continue; }
    const disposition = dispositions.get(display.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    denominator += 1;
    const matching = clues.filter((event) => roundKey(event) === roundKey(display)).map((event) => event.clueNumber).sort();
    if (new Set(matching).size !== matching.length || (matching.length === 2 && (matching[0] !== 1 || matching[1] !== 2))) fail("Ambiguous or out-of-order clue join");
    if (matching.length >= 1) atLeastOne += 1;
    if (matching.length === 2) both += 1;
    if (matching.length === 0 && !joins.answersByRound.has(roundKey(display)) && !terminalSessions.has(sessionKey(display))) missing += 1;
  }
  return metric(`MODE_CLUE_USE_${mode.toUpperCase()}`, input.versions, Object.freeze({ atLeastOne, both }), denominator, missing, exclusions);
};

const responseSufficiency = (input: CoherenceFormulaInput) => {
  const offers = uniqueBy(ofFamily(input, "SURVEY_OFFERED"), (event) => `${event.participantLineageId}|${event.instrumentVersionId}`, "survey offer");
  const submissions = ofFamily(input, "SURVEY_SUBMITTED");
  const dispositions = dispositionsByParticipant(input);
  const exclusions = new Map<string, number>();
  let denominator = 0; let submitted = 0; let missing = 0;
  for (const offer of [...offers.values()].sort((a, b) => a.participantLineageId.localeCompare(b.participantLineageId))) {
    const disposition = dispositions.get(offer.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    denominator += 1;
    const scoped = submissions.filter((entry) => entry.participantLineageId === offer.participantLineageId && entry.instrumentVersionId === offer.instrumentVersionId);
    if (scoped.some((entry) => entry.submittedAt < offer.offeredAt)) fail("Survey submission chronology precedes its offer");
    const matches = scoped.filter((entry) => entry.submittedAt <= input.observationBoundary && entry.submittedAt <= offer.responseWindowEndsAt);
    if (matches.length > 1) fail("Ambiguous duplicate survey submission");
    if (matches.length === 1 && matches[0]!.analyticalInclusionState === "INCLUDED") submitted += 1;
    else missing += 1;
  }
  return metric("RESPONSE_SUFFICIENCY", input.versions, Object.freeze({ submitted }), denominator, missing, exclusions);
};

const keyFor = (keys: readonly ComprehensionScoringKey[], instrumentVersionId: string): ComprehensionScoringKey | undefined =>
  keys.find((key) => key.instrumentVersionId === instrumentVersionId);

const sharedPromiseComprehension = (input: CoherenceFormulaInput) => {
  const submissions = ofFamily(input, "SURVEY_SUBMITTED").filter((entry) => entry.submittedAt <= input.observationBoundary);
  const offers = uniqueBy(ofFamily(input, "SURVEY_OFFERED"), (event) => `${event.participantLineageId}|${event.instrumentVersionId}`, "survey offer");
  uniqueBy(submissions, (event) => `${event.participantLineageId}|${event.instrumentVersionId}`, "comprehension submission");
  const dispositions = dispositionsByParticipant(input);
  const exclusions = new Map<string, number>();
  let denominator = 0; let understands = 0; let missing = 0;
  for (const submission of submissions.sort((a, b) => a.eventId.localeCompare(b.eventId))) {
    const offer = offers.get(`${submission.participantLineageId}|${submission.instrumentVersionId}`);
    if (!offer) fail("Comprehension submission is orphaned from a survey offer");
    if (submission.submittedAt < offer.offeredAt) fail("Comprehension submission precedes its offer");
    if (submission.submittedAt > offer.responseWindowEndsAt) continue;
    const disposition = dispositions.get(submission.participantLineageId);
    const state = classify(disposition);
    if (state === "MISSING") { missing += 1; continue; }
    if (state === "EXCLUDED") { addExclusion(exclusions, exclusionReason(disposition!)); continue; }
    if (submission.analyticalInclusionState !== "INCLUDED") fail("Submission analytical inclusion disagrees with authoritative disposition");
    const key = keyFor(input.comprehensionScoringKeys, submission.instrumentVersionId);
    if (!key) { missing += 1; continue; }
    const understanding = submission.closedResponseIds.filter((id) => key.understandingResponseIds.includes(id));
    const nonUnderstanding = submission.closedResponseIds.filter((id) => key.nonUnderstandingResponseIds.includes(id));
    if (understanding.length + nonUnderstanding.length > 1) fail("Ambiguous multiple comprehension responses");
    if (understanding.length + nonUnderstanding.length === 0) { missing += 1; continue; }
    denominator += 1;
    if (understanding.length === 1) understands += 1;
  }
  return metric("SHARED_PROMISE_COMPREHENSION", input.versions, Object.freeze({ understands }), denominator, missing, exclusions);
};

const criticalDefectStatus = (input: CoherenceFormulaInput) => {
  const changes = ofFamily(input, "CRITICAL_DEFECT_CHANGED").filter((event) => event.effectiveAt <= input.observationBoundary);
  const groups = new Map<string, EventOf<"CRITICAL_DEFECT_CHANGED">[]>();
  for (const event of changes) { const group = groups.get(event.defectId) ?? []; group.push(event); groups.set(event.defectId, group); }
  let resolved = 0; let unresolved = 0; let releaseBlocking = 0;
  const decisions = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.eventId.localeCompare(b.eventId));
    if (group[0]?.defectStatus !== "OPENED") fail("Critical defect was resolved without an open event");
    if (group.some((event) => event.severity !== "CRITICAL")) fail("Critical-defect formula received a non-critical severity");
    if (group.length > 2 || (group.length === 2 && group[1]!.defectStatus !== "RESOLVED") || (group.length === 2 && group[0]!.effectiveAt === group[1]!.effectiveAt)) fail("Invalid or ambiguous critical-defect state transition");
    if (group.some((event) => event.releaseBlockingDecision !== "BLOCK_RELEASE" && event.releaseBlockingDecision !== "CLEAR_BLOCK")) fail("Unknown release-blocking decision class");
    const latest = group[group.length - 1]!;
    if (latest.defectStatus === "RESOLVED") resolved += 1; else unresolved += 1;
    if (latest.releaseBlockingDecision === "BLOCK_RELEASE") releaseBlocking += 1;
    decisions.set(latest.releaseBlockingDecision, (decisions.get(latest.releaseBlockingDecision) ?? 0) + 1);
  }
  const releaseBlockingDecisionCounts = Object.freeze([...decisions.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([releaseBlockingDecision, count]) => Object.freeze({ releaseBlockingDecision, count })));
  const rawNumerators = Object.freeze({ opened: groups.size, resolved, unresolved, releaseBlocking });
  return Object.freeze({ measureId: "CRITICAL_DEFECT_STATUS" as const, versions: Object.freeze({ ...input.versions }), rawNumerators,
    rawDenominator: groups.size, missingCount: 0, excludedCount: 0, excludedByReason: Object.freeze([]), releaseBlockingDecisionCounts });
};

export const calculateCoherenceMeasures = (value: unknown) => {
  const input = parseCoherenceInput(value);
  return Object.freeze({
    mixedSessionCompletion: mixedSessionCompletion(input),
    voluntaryReturn: voluntaryReturn(input),
    transitionContinuation: transitionContinuation(input),
    modeAbandonment: Object.freeze({ provenance: modeAbandonment(input, "provenance"), language: modeAbandonment(input, "language") }),
    modeClueUse: Object.freeze({ provenance: modeClueUse(input, "provenance"), language: modeClueUse(input, "language") }),
    responseSufficiency: responseSufficiency(input),
    sharedPromiseComprehension: sharedPromiseComprehension(input),
    criticalDefectStatus: criticalDefectStatus(input),
  });
};

export type CoherenceMeasures = ReturnType<typeof calculateCoherenceMeasures>;
