import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";

export const PROVENANCE_ACCESSIBILITY_FLOW_STAGES = Object.freeze([
  "BASE_EXCERPT", "CLUE_1", "CLUE_2", "ANSWER_ACCEPTED", "REVEAL", "CORRECTION", "ERROR",
]);
export const PROVENANCE_ACCESSIBILITY_CHECKS = Object.freeze([
  "keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast",
  "nonColorState", "textEquivalent", "responsive", "reducedMotion",
]);

const keyboardInputs = Object.freeze(["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"]);
const topLevelKeys = Object.freeze([
  "assistiveTechnologyFlows", "authorityDomainId", "browserFlows", "flowVersionId", "frozenVersions", "kind", "mode",
  "noJavaScriptFlows", "rendererVersionId", "review", "scenarioCoverage", "supportMatrixId",
]);
const scenarioKeys = Object.freeze([
  "answerAccepted", "attribution", "authorizedReveal", "candidateOutcomes", "clueCounts", "correctionStates", "errorRecovery",
  "helpfulSignals", "misleadingSignals", "preRevealLeakage", "recordedSourceExplanation", "textEquivalentCorrectness",
]);
const requiredTrueScenarioKeys = Object.freeze([
  "answerAccepted", "attribution", "authorizedReveal", "errorRecovery", "helpfulSignals", "misleadingSignals",
  "recordedSourceExplanation", "textEquivalentCorrectness",
]);

const PASS = Object.freeze({ status: "PASS", invitationsBlocked: false });
const FAIL = Object.freeze({ status: "FAIL", invitationsBlocked: true });
const INDETERMINATE = Object.freeze({ status: "INDETERMINATE", invitationsBlocked: true });
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const nonBlank = (value) => typeof value === "string" && value.trim().length > 0;
const exactArray = (value, expected) => Array.isArray(value)
  && value.length === expected.length
  && value.every((entry, index) => entry === expected[index]);
const safeVerify = (verify, ...values) => {
  try {
    return verify(...values) === true;
  } catch {
    return false;
  }
};

function validStages(value) {
  if (!Array.isArray(value) || value.length !== PROVENANCE_ACCESSIBILITY_FLOW_STAGES.length) return false;
  return PROVENANCE_ACCESSIBILITY_FLOW_STAGES.every((stage, index) => {
    const row = value[index];
    return exactKeys(row, ["checks", "stage"]) && row.stage === stage
      && exactKeys(row.checks, PROVENANCE_ACCESSIBILITY_CHECKS)
      && PROVENANCE_ACCESSIBILITY_CHECKS.every((check) => typeof row.checks[check] === "boolean");
  });
}

function validSession(value) {
  if (!exactKeys(value, ["completed", "provenanceRounds", "roundCount"])
    || value.roundCount !== 5 || value.completed !== true
    || !Array.isArray(value.provenanceRounds) || value.provenanceRounds.length !== 3) return false;
  const rounds = value.provenanceRounds;
  if (!rounds.every((round) => exactKeys(round, ["candidateOutcome", "clueCount", "roundId", "roundOrdinal", "stages"])
    && nonBlank(round.roundId)
    && Number.isSafeInteger(round.roundOrdinal) && round.roundOrdinal >= 1 && round.roundOrdinal <= 5
    && Number.isSafeInteger(round.clueCount) && round.clueCount >= 0 && round.clueCount <= 2
    && (round.candidateOutcome === "CORRECT" || round.candidateOutcome === "INCORRECT")
    && validStages(round.stages))) return false;
  const ids = rounds.map((round) => round.roundId.trim());
  const ordinals = rounds.map((round) => round.roundOrdinal);
  const clueCounts = rounds.map((round) => round.clueCount).sort((left, right) => left - right);
  const outcomes = new Set(rounds.map((round) => round.candidateOutcome));
  return new Set(ids).size === 3
    && new Set(ordinals).size === 3
    && ordinals.every((ordinal, index) => index === 0 || ordinal > ordinals[index - 1])
    && exactArray(clueCounts, [0, 1, 2])
    && outcomes.has("CORRECT") && outcomes.has("INCORRECT");
}

function validFrozenVersions(value) {
  return exactKeys(value, ACCESSIBILITY_TARGETS.browserFamilies)
    && ACCESSIBILITY_TARGETS.browserFamilies.every((family) => {
      const versions = value[family];
      return Array.isArray(versions) && versions.length === 2
        && versions.every((version) => typeof version === "string" && /^\d+$/.test(version))
        && new Set(versions).size === 2;
    });
}

function expectedBrowserPairs(frozenVersions) {
  if (!validFrozenVersions(frozenVersions)) return [];
  return ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => frozenVersions[family].map((version) => ({ family, version })));
}

function validBrowserFlows(value, frozenVersions) {
  const expected = expectedBrowserPairs(frozenVersions);
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  return expected.every(({ family, version }) => {
    const rows = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    if (rows.length !== 1) return false;
    const row = rows[0];
    return exactKeys(row, ["family", "keyboardInputs", "session", "version", "viewport"])
      && exactKeys(row.viewport, ["height", "width"])
      && row.viewport.width === 320 && row.viewport.height === 568
      && exactArray(row.keyboardInputs, keyboardInputs)
      && validSession(row.session);
  });
}

function validAssistiveTechnologyFlows(value) {
  if (!Array.isArray(value) || value.length !== ACCESSIBILITY_TARGETS.assistiveTechnology.length) return false;
  return ACCESSIBILITY_TARGETS.assistiveTechnology.every((combination) => {
    const rows = value.filter((row) => isRecord(row) && row.combination === combination);
    return rows.length === 1 && exactKeys(rows[0], ["combination", "session"]) && validSession(rows[0].session);
  });
}

function validNoJavaScriptFlows(value, frozenVersions) {
  const expected = expectedBrowserPairs(frozenVersions);
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  return expected.every(({ family, version }) => {
    const rows = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    return rows.length === 1
      && exactKeys(rows[0], ["accessibleExplanation", "family", "partialGameControlCount", "version"])
      && typeof rows[0].accessibleExplanation === "boolean"
      && Number.isSafeInteger(rows[0].partialGameControlCount) && rows[0].partialGameControlCount >= 0;
  });
}

function validScenarioCoverage(value) {
  return exactKeys(value, scenarioKeys)
    && exactArray(value.clueCounts, [0, 1, 2])
    && exactArray(value.candidateOutcomes, ["CORRECT", "INCORRECT"])
    && exactArray(value.correctionStates, ["VOID", "CONTENT_WITHDRAWN"])
    && requiredTrueScenarioKeys.every((key) => value[key] === true)
    && value.preRevealLeakage === false;
}

function validReview(value) {
  return exactKeys(value, ["approved", "qualificationVersionId", "reviewedAt", "reviewerId"])
    && nonBlank(value.reviewerId) && nonBlank(value.qualificationVersionId)
    && typeof value.reviewedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.reviewedAt)
    && Number.isFinite(Date.parse(value.reviewedAt)) && value.approved === true;
}

function hasMeasuredFailure(value) {
  const stageRows = [
    ...(Array.isArray(value.browserFlows) ? value.browserFlows : []),
    ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : []),
  ].flatMap((row) => isRecord(row) && isRecord(row.session) && Array.isArray(row.session.provenanceRounds)
    ? row.session.provenanceRounds.flatMap((round) => isRecord(round) && Array.isArray(round.stages) ? round.stages : [])
    : []);
  if (stageRows.some((row) => isRecord(row) && isRecord(row.checks)
    && PROVENANCE_ACCESSIBILITY_CHECKS.some((check) => row.checks[check] === false))) return true;
  const sessions = [
    ...(Array.isArray(value.browserFlows) ? value.browserFlows : []),
    ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : []),
  ].flatMap((row) => isRecord(row) && isRecord(row.session) ? [row.session] : []);
  if (sessions.some((session) => session.completed === false)) return true;
  if (sessions.some((session) => Array.isArray(session.provenanceRounds) && session.provenanceRounds.length === 3
    && session.provenanceRounds.every((round) => isRecord(round) && Number.isSafeInteger(round.clueCount))
    && !exactArray(session.provenanceRounds.map((round) => round.clueCount).sort((left, right) => left - right), [0, 1, 2]))) return true;
  if (sessions.some((session) => Array.isArray(session.provenanceRounds) && session.provenanceRounds.length === 3
    && session.provenanceRounds.every((round) => isRecord(round) && typeof round.candidateOutcome === "string")
    && !(session.provenanceRounds.some((round) => round.candidateOutcome === "CORRECT")
      && session.provenanceRounds.some((round) => round.candidateOutcome === "INCORRECT")))) return true;
  if ((Array.isArray(value.noJavaScriptFlows) ? value.noJavaScriptFlows : []).some((row) => isRecord(row)
    && (row.accessibleExplanation === false || (Number.isSafeInteger(row.partialGameControlCount) && row.partialGameControlCount > 0)))) return true;
  const scenario = value.scenarioCoverage;
  if (!isRecord(scenario)) return false;
  if (scenario.preRevealLeakage === true) return true;
  if (Array.isArray(scenario.clueCounts) && !exactArray(scenario.clueCounts, [0, 1, 2])) return true;
  if (Array.isArray(scenario.candidateOutcomes) && !exactArray(scenario.candidateOutcomes, ["CORRECT", "INCORRECT"])) return true;
  if (Array.isArray(scenario.correctionStates) && !exactArray(scenario.correctionStates, ["VOID", "CONTENT_WITHDRAWN"])) return true;
  return requiredTrueScenarioKeys.some((key) => scenario[key] === false);
}

function complete(value) {
  return exactKeys(value, topLevelKeys)
    && value.mode === "provenance"
    && nonBlank(value.authorityDomainId) && nonBlank(value.supportMatrixId)
    && nonBlank(value.flowVersionId) && nonBlank(value.rendererVersionId)
    && validFrozenVersions(value.frozenVersions)
    && validBrowserFlows(value.browserFlows, value.frozenVersions)
    && validAssistiveTechnologyFlows(value.assistiveTechnologyFlows)
    && validNoJavaScriptFlows(value.noJavaScriptFlows, value.frozenVersions)
    && validScenarioCoverage(value.scenarioCoverage)
    && validReview(value.review);
}

export function evaluateProvenanceAccessibilityEvidence(value, authority) {
  if (!isRecord(value) || value.kind !== "OPERATIONAL_MEASURED") return INDETERMINATE;
  if (!isRecord(authority) || !nonBlank(authority.trustDomainId)
    || typeof authority.verifyEvidence !== "function" || typeof authority.verifyReview !== "function"
    || value.authorityDomainId !== authority.trustDomainId
    || !safeVerify(authority.verifyEvidence, value)
    || !safeVerify(authority.verifyReview, value.review, value)) return INDETERMINATE;
  if (hasMeasuredFailure(value)) return FAIL;
  return complete(value) ? PASS : INDETERMINATE;
}
