import assert from "node:assert/strict";
import test from "node:test";

import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";
import {
  LANGUAGE_ACCESSIBILITY_CHECKS,
  LANGUAGE_ACCESSIBILITY_FLOW_STAGES,
  evaluateLanguageAccessibilityEvidence,
} from "./language-support.mjs";

const ANNOTATION_VERSION = "language-control-annotation-v1";
const ANNOTATION_TEXT = "The excerpt contains approved visible annotations for bidirectional or zero-width controls.";
const requiredKeys = ["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"];
const versions = Object.fromEntries(ACCESSIBILITY_TARGETS.browserFamilies.map((family) => [family, ["124", "123"]]));
const checks = () => Object.fromEntries(LANGUAGE_ACCESSIBILITY_CHECKS.map((name) => [name, true]));
const stages = () => LANGUAGE_ACCESSIBILITY_FLOW_STAGES.map((stage) => ({ stage, checks: checks() }));

const presentation = (sessionId, suffix) => ({
  candidateSetVersionId: `language-set-${suffix}`,
  orderingRecordVersionId: `ordering-record-${suffix}`,
  orderingPolicyVersionId: `ordering-policy-${suffix}`,
  sessionId,
  presentedCandidateIds: ["lang-ts-01", "lang-js-02", "lang-rs-03"],
  presentedCandidateCount: 3,
  selectedCandidateId: suffix.endsWith("1") ? "lang-ts-01" : "lang-js-02",
  domOrder: ["lang-ts-01", "lang-js-02", "lang-rs-03"],
  focusOrder: ["lang-ts-01", "lang-js-02", "lang-rs-03"],
  screenReaderOrder: ["lang-ts-01", "lang-js-02", "lang-rs-03"],
});

const control = (controlCase) => ({
  controlCase,
  annotationVersionId: controlCase === "ABSENT" ? null : ANNOTATION_VERSION,
  annotationText: controlCase === "ABSENT" ? null : ANNOTATION_TEXT,
  detectedControlClasses: controlCase === "ABSENT" ? [] : controlCase === "BIDI" ? ["bidi"] : controlCase === "ZERO_WIDTH" ? ["zero-width"] : ["bidi", "zero-width"],
  inertEscapedRendering: true,
  visibleNonColorDisclosure: true,
  screenReaderTextEquivalent: true,
});

const semantics = () => ({
  preRevealLeakage: false,
  revealCorrectness: true,
  canonicalCorrectLanguageLabel: "TypeScript",
  approvedEvidence: true,
  approvedAttribution: true,
  helpfulSignals: true,
  misleadingSignals: true,
  crossModeComparabilityClaim: false,
  requiredVersionsPresent: true,
  correctionStates: ["VOID", "CONTENT_WITHDRAWN"],
  errorRecovery: true,
});

const languageRound = (sessionId, ordinal, clueCount, outcome, controlCase) => ({
  roundId: `${sessionId}-round-${ordinal}`,
  roundOrdinal: ordinal,
  clueCount,
  candidateOutcome: outcome,
  candidatePresentation: presentation(sessionId, `${ordinal}`),
  controlReview: control(controlCase),
  languageSemantics: semantics(),
  stages: stages(),
});

const session = (suffix) => {
  const sessionId = `session-${suffix}`;
  return {
    sessionId,
    roundCount: 5,
    completed: true,
    languageRounds: suffix === "a"
      ? [languageRound(sessionId, 2, 0, "CORRECT", "ABSENT"), languageRound(sessionId, 4, 1, "INCORRECT", "BIDI")]
      : [languageRound(sessionId, 1, 2, "CORRECT", "ZERO_WIDTH"), languageRound(sessionId, 5, 0, "INCORRECT", "BIDI_AND_ZERO_WIDTH")],
  };
};

function completeEvidence(kind = "OPERATIONAL_MEASURED") {
  return {
    kind,
    mode: "language",
    authorityDomainId: "accessibility-review-domain-v1",
    supportMatrixId: "support-matrix-v1",
    flowVersionId: "language-flow-v1",
    rendererVersionId: "renderer-v1",
    frozenVersions: structuredClone(versions),
    browserFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({
      family,
      version,
      viewport: { width: 320, height: 568 },
      keyboardInputs: [...requiredKeys],
      sessions: [session("a"), session("b")],
    }))),
    assistiveTechnologyFlows: ACCESSIBILITY_TARGETS.assistiveTechnology.map((combination) => ({
      combination,
      sessions: [session("a"), session("b")],
    })),
    noJavaScriptFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({
      family,
      version,
      accessibleExplanation: true,
      partialGameControlCount: 0,
    }))),
    review: {
      reviewerId: "accessibility-reviewer-1",
      qualificationVersionId: "qualification-v1",
      reviewedAt: "2026-07-15T00:00:00Z",
      approved: true,
    },
  };
}

const authority = {
  trustDomainId: "accessibility-review-domain-v1",
  verifyEvidence: () => true,
  verifyReview: () => true,
};

test("freezes the exact language stages and checks", () => {
  assert.deepEqual(LANGUAGE_ACCESSIBILITY_FLOW_STAGES, ["BASE_EXCERPT", "CLUE_1", "CLUE_2", "ANSWER_ACCEPTED", "REVEAL", "CORRECTION", "ERROR"]);
  assert.deepEqual(LANGUAGE_ACCESSIBILITY_CHECKS, ["keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast", "nonColorState", "textEquivalent", "responsive", "reducedMotion"]);
  assert.equal(Object.isFrozen(LANGUAGE_ACCESSIBILITY_FLOW_STAGES), true);
  assert.equal(Object.isFrozen(LANGUAGE_ACCESSIBILITY_CHECKS), true);
});

test("only complete authentic operational language evidence can pass", () => {
  assert.deepEqual(evaluateLanguageAccessibilityEvidence(completeEvidence(), authority), { status: "PASS", invitationsBlocked: false });
  for (const kind of ["SYNTHETIC_TEST_FIXTURE", "LOCAL_AUTOMATED"]) {
    assert.equal(evaluateLanguageAccessibilityEvidence(completeEvidence(kind), authority).status, "INDETERMINATE");
  }
  assert.equal(evaluateLanguageAccessibilityEvidence(completeEvidence(), { ...authority, verifyEvidence: () => false }).status, "INDETERMINATE");
  assert.equal(evaluateLanguageAccessibilityEvidence({ ...completeEvidence(), authorityDomainId: "foreign" }, authority).status, "INDETERMINATE");
});

test("every browser and AT language stage check is enforced with failure precedence", () => {
  for (const check of LANGUAGE_ACCESSIBILITY_CHECKS) {
    const browser = completeEvidence();
    browser.browserFlows[0].sessions[0].languageRounds[0].stages[0].checks[check] = false;
    assert.equal(evaluateLanguageAccessibilityEvidence(browser, authority).status, "FAIL", `browser ${check}`);
    const at = completeEvidence();
    at.assistiveTechnologyFlows[0].sessions[0].languageRounds[0].stages[0].checks[check] = false;
    assert.equal(evaluateLanguageAccessibilityEvidence(at, authority).status, "FAIL", `AT ${check}`);
  }
  const failureAndMissing = completeEvidence();
  failureAndMissing.browserFlows[0].sessions[0].languageRounds[0].stages[0].checks.contrast = false;
  failureAndMissing.assistiveTechnologyFlows.pop();
  assert.equal(evaluateLanguageAccessibilityEvidence(failureAndMissing, authority).status, "FAIL");
});

test("requires two ordered completed five-round session traces per environment", () => {
  const variants = [];
  const oneSession = completeEvidence(); oneSession.browserFlows[0].sessions.pop(); variants.push(oneSession);
  const oneRound = completeEvidence(); oneRound.assistiveTechnologyFlows[0].sessions[0].languageRounds.pop(); variants.push(oneRound);
  const duplicateSession = completeEvidence(); duplicateSession.browserFlows[0].sessions[1].sessionId = duplicateSession.browserFlows[0].sessions[0].sessionId;
  assert.equal(evaluateLanguageAccessibilityEvidence(duplicateSession, authority).status, "FAIL");
  const duplicateRound = completeEvidence(); duplicateRound.browserFlows[0].sessions[0].languageRounds[1].roundOrdinal = 2; variants.push(duplicateRound);
  const outOfOrder = completeEvidence(); outOfOrder.browserFlows[0].sessions[0].languageRounds.reverse(); variants.push(outOfOrder);
  const outOfOrderStages = completeEvidence(); outOfOrderStages.assistiveTechnologyFlows[0].sessions[0].languageRounds[0].stages.reverse(); variants.push(outOfOrderStages);
  const outOfOrderBrowserStages = completeEvidence(); outOfOrderBrowserStages.browserFlows[0].sessions[0].languageRounds[0].stages.reverse(); variants.push(outOfOrderBrowserStages);
  const wrongRoundCount = completeEvidence(); wrongRoundCount.browserFlows[0].sessions[0].roundCount = 4; variants.push(wrongRoundCount);
  const duplicateRoundId = completeEvidence(); duplicateRoundId.browserFlows[0].sessions[0].languageRounds[1].roundId = duplicateRoundId.browserFlows[0].sessions[0].languageRounds[0].roundId; variants.push(duplicateRoundId);
  const blankRoundId = completeEvidence(); blankRoundId.browserFlows[0].sessions[0].languageRounds[0].roundId = " "; variants.push(blankRoundId);
  const outOfRangeOrdinal = completeEvidence(); outOfRangeOrdinal.browserFlows[0].sessions[0].languageRounds[0].roundOrdinal = 6; variants.push(outOfRangeOrdinal);
  const nullBrowserRound = completeEvidence(); nullBrowserRound.browserFlows[0].sessions[0].languageRounds[0] = null; variants.push(nullBrowserRound);
  const malformedBrowserRound = completeEvidence(); malformedBrowserRound.browserFlows[0].sessions[0].languageRounds[0] = "malformed"; variants.push(malformedBrowserRound);
  const nullAtRound = completeEvidence(); nullAtRound.assistiveTechnologyFlows[0].sessions[0].languageRounds[0] = null; variants.push(nullAtRound);
  const malformedAtRound = completeEvidence(); malformedAtRound.assistiveTechnologyFlows[0].sessions[0].languageRounds[0] = 17; variants.push(malformedAtRound);
  for (const variant of variants) assert.equal(evaluateLanguageAccessibilityEvidence(variant, authority).status, "INDETERMINATE");
  const incomplete = completeEvidence(); incomplete.browserFlows[0].sessions[0].completed = false;
  assert.equal(evaluateLanguageAccessibilityEvidence(incomplete, authority).status, "FAIL");
  const duplicateClueCount = completeEvidence(); duplicateClueCount.browserFlows[0].sessions[1].languageRounds[0].clueCount = 1;
  assert.equal(evaluateLanguageAccessibilityEvidence(duplicateClueCount, authority).status, "FAIL");
  const oneOutcome = completeEvidence();
  for (const currentSession of oneOutcome.browserFlows[0].sessions) for (const round of currentSession.languageRounds) round.candidateOutcome = "CORRECT";
  assert.equal(evaluateLanguageAccessibilityEvidence(oneOutcome, authority).status, "FAIL");
});

test("binds exact certified candidate presentation and measured DOM/focus/screen-reader order", () => {
  for (const field of ["domOrder", "focusOrder", "screenReaderOrder"]) {
    const evidence = completeEvidence();
    evidence.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation[field].reverse();
    assert.equal(evaluateLanguageAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  const selectedMissing = completeEvidence();
  selectedMissing.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation.selectedCandidateId = "lang-missing";
  assert.equal(evaluateLanguageAccessibilityEvidence(selectedMissing, authority).status, "FAIL");
  const countDrift = completeEvidence();
  countDrift.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation.presentedCandidateCount = 4;
  assert.equal(evaluateLanguageAccessibilityEvidence(countDrift, authority).status, "FAIL");
  const sessionDrift = completeEvidence();
  sessionDrift.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation.sessionId = "other-session";
  assert.equal(evaluateLanguageAccessibilityEvidence(sessionDrift, authority).status, "FAIL");
  for (const field of ["candidateSetVersionId", "orderingRecordVersionId", "orderingPolicyVersionId"]) {
    const blank = completeEvidence(); blank.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation[field] = " ";
    assert.equal(evaluateLanguageAccessibilityEvidence(blank, authority).status, "FAIL", field);
    const missing = completeEvidence(); delete missing.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation[field];
    assert.equal(evaluateLanguageAccessibilityEvidence(missing, authority).status, "INDETERMINATE", `missing ${field}`);
  }
  const duplicateCandidate = completeEvidence();
  duplicateCandidate.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation.presentedCandidateIds[1] = "lang-ts-01";
  assert.equal(evaluateLanguageAccessibilityEvidence(duplicateCandidate, authority).status, "FAIL");
  const extraPresentation = completeEvidence(); extraPresentation.browserFlows[0].sessions[0].languageRounds[0].candidatePresentation.claimedOrdered = true;
  assert.equal(evaluateLanguageAccessibilityEvidence(extraPresentation, authority).status, "INDETERMINATE");
});

test("enforces language reveal containment, canonical fields, and correction/error coverage", () => {
  for (const field of ["revealCorrectness", "approvedEvidence", "approvedAttribution", "helpfulSignals", "misleadingSignals", "requiredVersionsPresent", "errorRecovery"]) {
    const evidence = completeEvidence();
    evidence.browserFlows[0].sessions[0].languageRounds[0].languageSemantics[field] = false;
    assert.equal(evaluateLanguageAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  const leaked = completeEvidence(); leaked.browserFlows[0].sessions[0].languageRounds[0].languageSemantics.preRevealLeakage = true;
  assert.equal(evaluateLanguageAccessibilityEvidence(leaked, authority).status, "FAIL");
  const comparison = completeEvidence(); comparison.browserFlows[0].sessions[0].languageRounds[0].languageSemantics.crossModeComparabilityClaim = true;
  assert.equal(evaluateLanguageAccessibilityEvidence(comparison, authority).status, "FAIL");
  const oneCorrection = completeEvidence(); oneCorrection.browserFlows[0].sessions[0].languageRounds[0].languageSemantics.correctionStates = ["VOID"];
  assert.equal(evaluateLanguageAccessibilityEvidence(oneCorrection, authority).status, "FAIL");
  const blankLabel = completeEvidence(); blankLabel.browserFlows[0].sessions[0].languageRounds[0].languageSemantics.canonicalCorrectLanguageLabel = " ";
  assert.equal(evaluateLanguageAccessibilityEvidence(blankLabel, authority).status, "FAIL");
});

test("requires all four inert-control cases and exact approved annotation evidence", () => {
  const cases = ["ABSENT", "BIDI", "ZERO_WIDTH", "BIDI_AND_ZERO_WIDTH"];
  for (const controlCase of cases) {
    const evidence = completeEvidence();
    const round = evidence.browserFlows[0].sessions.flatMap(({ languageRounds }) => languageRounds).find(({ controlReview }) => controlReview.controlCase === controlCase);
    round.controlReview.inertEscapedRendering = false;
    assert.equal(evaluateLanguageAccessibilityEvidence(evidence, authority).status, "FAIL", controlCase);
  }
  const missingCase = completeEvidence();
  missingCase.browserFlows[0].sessions[1].languageRounds[1].controlReview = control("BIDI");
  assert.equal(evaluateLanguageAccessibilityEvidence(missingCase, authority).status, "FAIL");
  const annotationDrift = completeEvidence();
  annotationDrift.browserFlows[0].sessions[0].languageRounds[1].controlReview.annotationText = "controls present";
  assert.equal(evaluateLanguageAccessibilityEvidence(annotationDrift, authority).status, "FAIL");
  const annotationVersionDrift = completeEvidence();
  annotationVersionDrift.browserFlows[0].sessions[0].languageRounds[1].controlReview.annotationVersionId = "other-version";
  assert.equal(evaluateLanguageAccessibilityEvidence(annotationVersionDrift, authority).status, "FAIL");
  const classDrift = completeEvidence();
  classDrift.browserFlows[0].sessions[1].languageRounds[1].controlReview.detectedControlClasses = ["bidi"];
  assert.equal(evaluateLanguageAccessibilityEvidence(classDrift, authority).status, "FAIL");
  for (const field of ["visibleNonColorDisclosure", "screenReaderTextEquivalent"]) {
    const evidence = completeEvidence(); evidence.browserFlows[0].sessions[0].languageRounds[1].controlReview[field] = false;
    assert.equal(evaluateLanguageAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  const absentAnnotated = completeEvidence();
  absentAnnotated.browserFlows[0].sessions[0].languageRounds[0].controlReview.annotationVersionId = ANNOTATION_VERSION;
  absentAnnotated.browserFlows[0].sessions[0].languageRounds[0].controlReview.annotationText = ANNOTATION_TEXT;
  assert.equal(evaluateLanguageAccessibilityEvidence(absentAnnotated, authority).status, "FAIL");
});

test("requires exact keyboard, no-JavaScript, browser, AT, review, and evidence envelopes", () => {
  const incomplete = [];
  for (const key of requiredKeys) {
    const evidence = completeEvidence(); evidence.browserFlows[0].keyboardInputs = evidence.browserFlows[0].keyboardInputs.filter((candidate) => candidate !== key); incomplete.push(evidence);
  }
  const missingBrowser = completeEvidence(); missingBrowser.browserFlows.pop(); incomplete.push(missingBrowser);
  const duplicateBrowser = completeEvidence(); duplicateBrowser.browserFlows.push(structuredClone(duplicateBrowser.browserFlows[0])); incomplete.push(duplicateBrowser);
  const missingAt = completeEvidence(); missingAt.assistiveTechnologyFlows.pop(); incomplete.push(missingAt);
  const duplicateAt = completeEvidence(); duplicateAt.assistiveTechnologyFlows.push(structuredClone(duplicateAt.assistiveTechnologyFlows[0])); incomplete.push(duplicateAt);
  const missingNoJs = completeEvidence(); missingNoJs.noJavaScriptFlows.pop(); incomplete.push(missingNoJs);
  const unapproved = completeEvidence(); unapproved.review.approved = false; incomplete.push(unapproved);
  const wrongViewport = completeEvidence(); wrongViewport.browserFlows[0].viewport.width = 321; incomplete.push(wrongViewport);
  const invalidVersions = completeEvidence(); invalidVersions.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]] = ["124", "124"]; incomplete.push(invalidVersions);
  const extra = completeEvidence(); extra.claimedPass = true; incomplete.push(extra);
  const nullBrowser = completeEvidence(); nullBrowser.browserFlows[0] = null; incomplete.push(nullBrowser);
  const nullAt = completeEvidence(); nullAt.assistiveTechnologyFlows[0] = null; incomplete.push(nullAt);
  for (const evidence of incomplete) assert.equal(evaluateLanguageAccessibilityEvidence(evidence, authority).status, "INDETERMINATE");
  const noJsFailure = completeEvidence(); noJsFailure.noJavaScriptFlows[0].partialGameControlCount = 1;
  assert.equal(evaluateLanguageAccessibilityEvidence(noJsFailure, authority).status, "FAIL");
  const inaccessibleNoJs = completeEvidence(); inaccessibleNoJs.noJavaScriptFlows[0].accessibleExplanation = false;
  assert.equal(evaluateLanguageAccessibilityEvidence(inaccessibleNoJs, authority).status, "FAIL");
  assert.equal(evaluateLanguageAccessibilityEvidence(completeEvidence(), { ...authority, verifyReview: () => false }).status, "INDETERMINATE");
  const conflictingDuplicateAt = completeEvidence();
  conflictingDuplicateAt.assistiveTechnologyFlows.push(structuredClone(conflictingDuplicateAt.assistiveTechnologyFlows[0]));
  conflictingDuplicateAt.assistiveTechnologyFlows.at(-1).sessions[0].languageRounds[0].stages[0].checks.contrast = false;
  assert.equal(evaluateLanguageAccessibilityEvidence(conflictingDuplicateAt, authority).status, "FAIL");
});
