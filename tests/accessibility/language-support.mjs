import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";

export const LANGUAGE_ACCESSIBILITY_FLOW_STAGES = Object.freeze(["BASE_EXCERPT", "CLUE_1", "CLUE_2", "ANSWER_ACCEPTED", "REVEAL", "CORRECTION", "ERROR"]);
export const LANGUAGE_ACCESSIBILITY_CHECKS = Object.freeze(["keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast", "nonColorState", "textEquivalent", "responsive", "reducedMotion"]);

const keys = Object.freeze(["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"]);
const annotationVersion = "language-control-annotation-v1";
const annotationText = "The excerpt contains approved visible annotations for bidirectional or zero-width controls.";
const controlCases = Object.freeze(["ABSENT", "BIDI", "ZERO_WIDTH", "BIDI_AND_ZERO_WIDTH"]);
const topKeys = Object.freeze(["assistiveTechnologyFlows", "authorityDomainId", "browserFlows", "flowVersionId", "frozenVersions", "kind", "mode", "noJavaScriptFlows", "rendererVersionId", "review", "supportMatrixId"]);
const PASS = Object.freeze({ status: "PASS", invitationsBlocked: false });
const FAIL = Object.freeze({ status: "FAIL", invitationsBlocked: true });
const INDETERMINATE = Object.freeze({ status: "INDETERMINATE", invitationsBlocked: true });
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value, expected) => isRecord(value) && Object.keys(value).sort().join("|") === [...expected].sort().join("|");
const nonBlank = (value) => typeof value === "string" && value.trim().length > 0;
const exactArray = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]);
const safeVerify = (verify, ...values) => { try { return verify(...values) === true; } catch { return false; } };

function validStages(value) {
  return Array.isArray(value) && value.length === LANGUAGE_ACCESSIBILITY_FLOW_STAGES.length
    && value.every((row, index) => exactKeys(row, ["checks", "stage"])
      && row.stage === LANGUAGE_ACCESSIBILITY_FLOW_STAGES[index]
      && exactKeys(row.checks, LANGUAGE_ACCESSIBILITY_CHECKS)
      && LANGUAGE_ACCESSIBILITY_CHECKS.every((check) => typeof row.checks[check] === "boolean"));
}

function validPresentation(value, sessionId) {
  if (!exactKeys(value, ["candidateSetVersionId", "domOrder", "focusOrder", "orderingPolicyVersionId", "orderingRecordVersionId", "presentedCandidateCount", "presentedCandidateIds", "screenReaderOrder", "selectedCandidateId", "sessionId"])) return false;
  if (![value.candidateSetVersionId, value.orderingRecordVersionId, value.orderingPolicyVersionId, value.sessionId, value.selectedCandidateId].every(nonBlank)) return false;
  if (value.sessionId !== sessionId || !Array.isArray(value.presentedCandidateIds) || value.presentedCandidateIds.length < 2
    || value.presentedCandidateIds.some((candidate) => !nonBlank(candidate))
    || new Set(value.presentedCandidateIds).size !== value.presentedCandidateIds.length
    || value.presentedCandidateCount !== value.presentedCandidateIds.length
    || !value.presentedCandidateIds.includes(value.selectedCandidateId)) return false;
  return exactArray(value.domOrder, value.presentedCandidateIds)
    && exactArray(value.focusOrder, value.presentedCandidateIds)
    && exactArray(value.screenReaderOrder, value.presentedCandidateIds);
}

function expectedClasses(controlCase) {
  if (controlCase === "ABSENT") return [];
  if (controlCase === "BIDI") return ["bidi"];
  if (controlCase === "ZERO_WIDTH") return ["zero-width"];
  if (controlCase === "BIDI_AND_ZERO_WIDTH") return ["bidi", "zero-width"];
  return null;
}

function validControl(value) {
  if (!exactKeys(value, ["annotationText", "annotationVersionId", "controlCase", "detectedControlClasses", "inertEscapedRendering", "screenReaderTextEquivalent", "visibleNonColorDisclosure"])) return false;
  const classes = expectedClasses(value.controlCase);
  if (classes === null || !exactArray(value.detectedControlClasses, classes)
    || value.inertEscapedRendering !== true || value.visibleNonColorDisclosure !== true || value.screenReaderTextEquivalent !== true) return false;
  return value.controlCase === "ABSENT"
    ? value.annotationVersionId === null && value.annotationText === null
    : value.annotationVersionId === annotationVersion && value.annotationText === annotationText;
}

function validSemantics(value) {
  if (!exactKeys(value, ["approvedAttribution", "approvedEvidence", "canonicalCorrectLanguageLabel", "correctionStates", "crossModeComparabilityClaim", "errorRecovery", "helpfulSignals", "misleadingSignals", "preRevealLeakage", "requiredVersionsPresent", "revealCorrectness"])) return false;
  return nonBlank(value.canonicalCorrectLanguageLabel)
    && value.preRevealLeakage === false && value.crossModeComparabilityClaim === false
    && ["revealCorrectness", "approvedEvidence", "approvedAttribution", "helpfulSignals", "misleadingSignals", "requiredVersionsPresent", "errorRecovery"].every((field) => value[field] === true)
    && exactArray(value.correctionStates, ["VOID", "CONTENT_WITHDRAWN"]);
}

function validRound(value, sessionId) {
  return exactKeys(value, ["candidateOutcome", "candidatePresentation", "clueCount", "controlReview", "languageSemantics", "roundId", "roundOrdinal", "stages"])
    && nonBlank(value.roundId)
    && Number.isSafeInteger(value.roundOrdinal) && value.roundOrdinal >= 1 && value.roundOrdinal <= 5
    && Number.isSafeInteger(value.clueCount) && value.clueCount >= 0 && value.clueCount <= 2
    && (value.candidateOutcome === "CORRECT" || value.candidateOutcome === "INCORRECT")
    && validPresentation(value.candidatePresentation, sessionId)
    && validControl(value.controlReview)
    && validSemantics(value.languageSemantics)
    && validStages(value.stages);
}

function validSession(value) {
  if (!exactKeys(value, ["completed", "languageRounds", "roundCount", "sessionId"])
    || !nonBlank(value.sessionId) || value.roundCount !== 5 || value.completed !== true
    || !Array.isArray(value.languageRounds) || value.languageRounds.length !== 2
    || !value.languageRounds.every((round) => validRound(round, value.sessionId))) return false;
  const ids = value.languageRounds.map((round) => round.roundId.trim());
  const ordinals = value.languageRounds.map((round) => round.roundOrdinal);
  return new Set(ids).size === 2 && new Set(ordinals).size === 2 && ordinals[0] < ordinals[1];
}

function validSessions(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(validSession)) return false;
  if (new Set(value.map((session) => session.sessionId.trim())).size !== 2) return false;
  const rounds = value.flatMap((session) => session.languageRounds);
  const clues = new Set(rounds.map((round) => round.clueCount));
  const outcomes = new Set(rounds.map((round) => round.candidateOutcome));
  const cases = rounds.map((round) => round.controlReview.controlCase).sort();
  return [0, 1, 2].every((count) => clues.has(count))
    && outcomes.has("CORRECT") && outcomes.has("INCORRECT")
    && exactArray(cases, [...controlCases].sort());
}

function validFrozenVersions(value) {
  return exactKeys(value, ACCESSIBILITY_TARGETS.browserFamilies) && ACCESSIBILITY_TARGETS.browserFamilies.every((family) => {
    const entries = value[family];
    return Array.isArray(entries) && entries.length === 2 && entries.every((version) => typeof version === "string" && /^\d+$/.test(version)) && new Set(entries).size === 2;
  });
}

function pairs(value) {
  return validFrozenVersions(value) ? ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => value[family].map((version) => ({ family, version }))) : [];
}

function validBrowserFlows(value, frozenVersions) {
  const expected = pairs(frozenVersions);
  return Array.isArray(value) && value.length === expected.length && expected.every(({ family, version }) => {
    const rows = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    return rows.length === 1 && exactKeys(rows[0], ["family", "keyboardInputs", "sessions", "version", "viewport"])
      && exactKeys(rows[0].viewport, ["height", "width"]) && rows[0].viewport.width === 320 && rows[0].viewport.height === 568
      && exactArray(rows[0].keyboardInputs, keys) && validSessions(rows[0].sessions);
  });
}

function validAtFlows(value) {
  return Array.isArray(value) && value.length === ACCESSIBILITY_TARGETS.assistiveTechnology.length
    && ACCESSIBILITY_TARGETS.assistiveTechnology.every((combination) => {
      const rows = value.filter((row) => isRecord(row) && row.combination === combination);
      return rows.length === 1 && exactKeys(rows[0], ["combination", "sessions"]) && validSessions(rows[0].sessions);
    });
}

function validNoJs(value, frozenVersions) {
  const expected = pairs(frozenVersions);
  return Array.isArray(value) && value.length === expected.length && expected.every(({ family, version }) => {
    const rows = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    return rows.length === 1 && exactKeys(rows[0], ["accessibleExplanation", "family", "partialGameControlCount", "version"])
      && rows[0].accessibleExplanation === true && rows[0].partialGameControlCount === 0;
  });
}

function validReview(value) {
  return exactKeys(value, ["approved", "qualificationVersionId", "reviewedAt", "reviewerId"])
    && nonBlank(value.reviewerId) && nonBlank(value.qualificationVersionId)
    && typeof value.reviewedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.reviewedAt)
    && Number.isFinite(Date.parse(value.reviewedAt)) && value.approved === true;
}

function suppliedRounds(value) {
  return [...(Array.isArray(value.browserFlows) ? value.browserFlows : []), ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : [])]
    .flatMap((row) => isRecord(row) && Array.isArray(row.sessions) ? row.sessions : [])
    .flatMap((session) => isRecord(session) && Array.isArray(session.languageRounds) ? session.languageRounds : []);
}

function measuredFailure(value) {
  const rounds = suppliedRounds(value);
  if (rounds.flatMap((round) => isRecord(round) && Array.isArray(round.stages) ? round.stages : [])
    .some((stage) => isRecord(stage) && isRecord(stage.checks) && LANGUAGE_ACCESSIBILITY_CHECKS.some((check) => stage.checks[check] === false))) return true;
  const sessions = [...(Array.isArray(value.browserFlows) ? value.browserFlows : []), ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : [])]
    .flatMap((row) => isRecord(row) && Array.isArray(row.sessions) ? row.sessions : []);
  if (sessions.some((session) => isRecord(session) && session.completed === false)) return true;
  for (const sessionSet of [...(Array.isArray(value.browserFlows) ? value.browserFlows : []), ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : [])].map((row) => isRecord(row) ? row.sessions : undefined)) {
    if (!Array.isArray(sessionSet) || sessionSet.length !== 2) continue;
    const sessionRounds = sessionSet.flatMap((session) => isRecord(session) && Array.isArray(session.languageRounds) ? session.languageRounds : []);
    if (sessionRounds.length !== 4 || !sessionRounds.every(isRecord)) continue;
    if (![0, 1, 2].every((count) => sessionRounds.some((round) => round.clueCount === count))) return true;
    if (!(sessionRounds.some((round) => round.candidateOutcome === "CORRECT") && sessionRounds.some((round) => round.candidateOutcome === "INCORRECT"))) return true;
    if (!controlCases.every((controlCase) => sessionRounds.some((round) => isRecord(round.controlReview) && round.controlReview.controlCase === controlCase))) return true;
  }
  for (const round of rounds) {
    if (!isRecord(round)) continue;
    const presentation = round.candidatePresentation;
    if (isRecord(presentation) && exactKeys(presentation, ["candidateSetVersionId", "domOrder", "focusOrder", "orderingPolicyVersionId", "orderingRecordVersionId", "presentedCandidateCount", "presentedCandidateIds", "screenReaderOrder", "selectedCandidateId", "sessionId"]) && !validPresentation(presentation, presentation.sessionId)) return true;
    const control = round.controlReview;
    if (isRecord(control) && exactKeys(control, ["annotationText", "annotationVersionId", "controlCase", "detectedControlClasses", "inertEscapedRendering", "screenReaderTextEquivalent", "visibleNonColorDisclosure"]) && !validControl(control)) return true;
    const semantics = round.languageSemantics;
    if (isRecord(semantics) && exactKeys(semantics, ["approvedAttribution", "approvedEvidence", "canonicalCorrectLanguageLabel", "correctionStates", "crossModeComparabilityClaim", "errorRecovery", "helpfulSignals", "misleadingSignals", "preRevealLeakage", "requiredVersionsPresent", "revealCorrectness"]) && !validSemantics(semantics)) return true;
    const session = [...sessions].find((candidate) => isRecord(candidate) && Array.isArray(candidate.languageRounds) && candidate.languageRounds.includes(round));
    if (isRecord(presentation) && isRecord(session) && nonBlank(presentation.sessionId) && presentation.sessionId !== session.sessionId) return true;
  }
  return (Array.isArray(value.noJavaScriptFlows) ? value.noJavaScriptFlows : []).some((row) => isRecord(row) && (row.accessibleExplanation === false || row.partialGameControlCount > 0));
}

function complete(value) {
  return exactKeys(value, topKeys) && value.mode === "language" && nonBlank(value.authorityDomainId)
    && nonBlank(value.supportMatrixId) && nonBlank(value.flowVersionId) && nonBlank(value.rendererVersionId)
    && validFrozenVersions(value.frozenVersions) && validBrowserFlows(value.browserFlows, value.frozenVersions)
    && validAtFlows(value.assistiveTechnologyFlows) && validNoJs(value.noJavaScriptFlows, value.frozenVersions) && validReview(value.review);
}

export function evaluateLanguageAccessibilityEvidence(value, authority) {
  if (!isRecord(value) || value.kind !== "OPERATIONAL_MEASURED") return INDETERMINATE;
  if (!isRecord(authority) || !nonBlank(authority.trustDomainId) || typeof authority.verifyEvidence !== "function" || typeof authority.verifyReview !== "function"
    || value.authorityDomainId !== authority.trustDomainId || !safeVerify(authority.verifyEvidence, value) || !safeVerify(authority.verifyReview, value.review, value)) return INDETERMINATE;
  if (measuredFailure(value)) return FAIL;
  return complete(value) ? PASS : INDETERMINATE;
}
