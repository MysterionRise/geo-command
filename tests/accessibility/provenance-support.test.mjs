import assert from "node:assert/strict";
import test from "node:test";

import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";
import {
  PROVENANCE_ACCESSIBILITY_CHECKS,
  PROVENANCE_ACCESSIBILITY_FLOW_STAGES,
  evaluateProvenanceAccessibilityEvidence,
} from "./provenance-support.mjs";

const checks = () => Object.fromEntries(PROVENANCE_ACCESSIBILITY_CHECKS.map((name) => [name, true]));
const stages = () => PROVENANCE_ACCESSIBILITY_FLOW_STAGES.map((stage) => ({ stage, checks: checks() }));
const versions = Object.fromEntries(ACCESSIBILITY_TARGETS.browserFamilies.map((family) => [family, ["124", "123"]]));
const provenanceRound = (roundOrdinal, clueCount, candidateOutcome) => ({
  roundId: `round-${roundOrdinal}`,
  roundOrdinal,
  clueCount,
  candidateOutcome,
  stages: stages(),
});
const session = () => ({
  roundCount: 5,
  completed: true,
  provenanceRounds: [
    provenanceRound(1, 0, "CORRECT"),
    provenanceRound(3, 1, "INCORRECT"),
    provenanceRound(5, 2, "CORRECT"),
  ],
});

test("the provenance flow stages and checks are frozen to the signed matrix", () => {
  assert.deepEqual(PROVENANCE_ACCESSIBILITY_FLOW_STAGES, [
    "BASE_EXCERPT", "CLUE_1", "CLUE_2", "ANSWER_ACCEPTED", "REVEAL", "CORRECTION", "ERROR",
  ]);
  assert.deepEqual(PROVENANCE_ACCESSIBILITY_CHECKS, [
    "keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast",
    "nonColorState", "textEquivalent", "responsive", "reducedMotion",
  ]);
  assert.equal(Object.isFrozen(PROVENANCE_ACCESSIBILITY_FLOW_STAGES), true);
  assert.equal(Object.isFrozen(PROVENANCE_ACCESSIBILITY_CHECKS), true);
});

function completeEvidence(kind = "OPERATIONAL_MEASURED") {
  return {
    kind,
    mode: "provenance",
    authorityDomainId: "accessibility-review-domain-v1",
    supportMatrixId: "support-matrix-v1",
    flowVersionId: "provenance-flow-v1",
    rendererVersionId: "renderer-v1",
    frozenVersions: structuredClone(versions),
    browserFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({
      family,
      version,
      viewport: { width: 320, height: 568 },
      keyboardInputs: ["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"],
      session: session(),
    }))),
    assistiveTechnologyFlows: ACCESSIBILITY_TARGETS.assistiveTechnology.map((combination) => ({ combination, session: session() })),
    noJavaScriptFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({
      family,
      version,
      accessibleExplanation: true,
      partialGameControlCount: 0,
    }))),
    scenarioCoverage: {
      clueCounts: [0, 1, 2],
      candidateOutcomes: ["CORRECT", "INCORRECT"],
      answerAccepted: true,
      authorizedReveal: true,
      correctionStates: ["VOID", "CONTENT_WITHDRAWN"],
      errorRecovery: true,
      preRevealLeakage: false,
      recordedSourceExplanation: true,
      attribution: true,
      helpfulSignals: true,
      misleadingSignals: true,
      textEquivalentCorrectness: true,
    },
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

test("only complete, authentic, operationally measured provenance evidence can pass", () => {
  assert.deepEqual(evaluateProvenanceAccessibilityEvidence(completeEvidence(), authority), {
    status: "PASS",
    invitationsBlocked: false,
  });
  assert.deepEqual(evaluateProvenanceAccessibilityEvidence(completeEvidence("SYNTHETIC_TEST_FIXTURE"), authority), {
    status: "INDETERMINATE",
    invitationsBlocked: true,
  });
  assert.deepEqual(evaluateProvenanceAccessibilityEvidence(completeEvidence("LOCAL_AUTOMATED"), authority), {
    status: "INDETERMINATE",
    invitationsBlocked: true,
  });
});

test("a complete measured required-check or no-JavaScript failure is launch-blocking FAIL", () => {
  for (const check of PROVENANCE_ACCESSIBILITY_CHECKS) {
    const browserFailure = completeEvidence();
    browserFailure.browserFlows[0].session.provenanceRounds[0].stages[0].checks[check] = false;
    assert.equal(evaluateProvenanceAccessibilityEvidence(browserFailure, authority).status, "FAIL", `browser check ${check}`);
    const assistiveTechnologyFailure = completeEvidence();
    assistiveTechnologyFailure.assistiveTechnologyFlows[0].session.provenanceRounds[0].stages[0].checks[check] = false;
    assert.equal(evaluateProvenanceAccessibilityEvidence(assistiveTechnologyFailure, authority).status, "FAIL", `AT check ${check}`);
  }

  const partialNoJavaScript = completeEvidence();
  partialNoJavaScript.noJavaScriptFlows[0].partialGameControlCount = 1;
  assert.equal(evaluateProvenanceAccessibilityEvidence(partialNoJavaScript, authority).status, "FAIL");
  const inaccessibleNoJavaScript = completeEvidence();
  inaccessibleNoJavaScript.noJavaScriptFlows[0].accessibleExplanation = false;
  assert.equal(evaluateProvenanceAccessibilityEvidence(inaccessibleNoJavaScript, authority).status, "FAIL");

  const failureWithUnrelatedMissingRow = completeEvidence();
  failureWithUnrelatedMissingRow.browserFlows[0].session.provenanceRounds[0].stages[0].checks.contrast = false;
  failureWithUnrelatedMissingRow.assistiveTechnologyFlows.pop();
  assert.equal(evaluateProvenanceAccessibilityEvidence(failureWithUnrelatedMissingRow, authority).status, "FAIL");
});

test("missing, duplicate, invalid, unauthenticated, or cross-domain evidence is INDETERMINATE", () => {
  const variants = [];
  const missingBrowser = completeEvidence();
  missingBrowser.browserFlows.pop();
  variants.push(missingBrowser);
  const duplicateBrowser = completeEvidence();
  duplicateBrowser.browserFlows.push(structuredClone(duplicateBrowser.browserFlows[0]));
  variants.push(duplicateBrowser);
  const invalidVersion = completeEvidence();
  invalidVersion.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]] = ["124", "124"];
  variants.push(invalidVersion);
  for (const stage of PROVENANCE_ACCESSIBILITY_FLOW_STAGES) {
    const missingBrowserStage = completeEvidence();
    missingBrowserStage.browserFlows[0].session.provenanceRounds[0].stages = missingBrowserStage.browserFlows[0].session.provenanceRounds[0].stages.filter((row) => row.stage !== stage);
    variants.push(missingBrowserStage);
    const missingAssistiveTechnologyStage = completeEvidence();
    missingAssistiveTechnologyStage.assistiveTechnologyFlows[0].session.provenanceRounds[0].stages = missingAssistiveTechnologyStage.assistiveTechnologyFlows[0].session.provenanceRounds[0].stages.filter((row) => row.stage !== stage);
    variants.push(missingAssistiveTechnologyStage);
  }
  const missingAssistiveTechnology = completeEvidence();
  missingAssistiveTechnology.assistiveTechnologyFlows.pop();
  variants.push(missingAssistiveTechnology);
  const missingNoJavaScript = completeEvidence();
  missingNoJavaScript.noJavaScriptFlows.pop();
  variants.push(missingNoJavaScript);
  const wrongMinimumViewport = completeEvidence();
  wrongMinimumViewport.browserFlows[0].viewport.width = 321;
  variants.push(wrongMinimumViewport);
  const crossDomain = completeEvidence();
  crossDomain.authorityDomainId = "foreign-domain";
  variants.push(crossDomain);
  for (const variant of variants) assert.equal(evaluateProvenanceAccessibilityEvidence(variant, authority).status, "INDETERMINATE");
  assert.equal(evaluateProvenanceAccessibilityEvidence(completeEvidence(), { ...authority, verifyEvidence: () => false }).status, "INDETERMINATE");
  assert.equal(evaluateProvenanceAccessibilityEvidence(completeEvidence(), { ...authority, verifyReview: () => false }).status, "INDETERMINATE");
});

test("review approval and exact evidence envelopes are mandatory", () => {
  const unapproved = completeEvidence();
  unapproved.review.approved = false;
  assert.equal(evaluateProvenanceAccessibilityEvidence(unapproved, authority).status, "INDETERMINATE");

  const missingReviewField = completeEvidence();
  delete missingReviewField.review.qualificationVersionId;
  assert.equal(evaluateProvenanceAccessibilityEvidence(missingReviewField, authority).status, "INDETERMINATE");

  const extraReviewField = completeEvidence();
  extraReviewField.review.comment = "looks good";
  assert.equal(evaluateProvenanceAccessibilityEvidence(extraReviewField, authority).status, "INDETERMINATE");

  const extraTopLevelField = completeEvidence();
  extraTopLevelField.claimedPass = true;
  assert.equal(evaluateProvenanceAccessibilityEvidence(extraTopLevelField, authority).status, "INDETERMINATE");

  const missingScenarioFlag = completeEvidence();
  delete missingScenarioFlag.scenarioCoverage.textEquivalentCorrectness;
  assert.equal(evaluateProvenanceAccessibilityEvidence(missingScenarioFlag, authority).status, "INDETERMINATE");

  const extraStageCheck = completeEvidence();
  extraStageCheck.browserFlows[0].session.provenanceRounds[0].stages[0].checks.claimedAccessible = true;
  assert.equal(evaluateProvenanceAccessibilityEvidence(extraStageCheck, authority).status, "INDETERMINATE");
});

test("every environment binds ordered stages to three provenance rounds in one completed five-round session", () => {
  const outOfOrderStages = completeEvidence();
  outOfOrderStages.browserFlows[0].session.provenanceRounds[0].stages.reverse();
  assert.equal(evaluateProvenanceAccessibilityEvidence(outOfOrderStages, authority).status, "INDETERMINATE");
  const outOfOrderAssistiveTechnologyStages = completeEvidence();
  outOfOrderAssistiveTechnologyStages.assistiveTechnologyFlows[0].session.provenanceRounds[0].stages.reverse();
  assert.equal(evaluateProvenanceAccessibilityEvidence(outOfOrderAssistiveTechnologyStages, authority).status, "INDETERMINATE");

  const outOfOrderRounds = completeEvidence();
  outOfOrderRounds.browserFlows[0].session.provenanceRounds.reverse();
  assert.equal(evaluateProvenanceAccessibilityEvidence(outOfOrderRounds, authority).status, "INDETERMINATE");

  const oneRoundOnly = completeEvidence();
  oneRoundOnly.assistiveTechnologyFlows[0].session.provenanceRounds = oneRoundOnly.assistiveTechnologyFlows[0].session.provenanceRounds.slice(0, 1);
  assert.equal(evaluateProvenanceAccessibilityEvidence(oneRoundOnly, authority).status, "INDETERMINATE");

  const duplicateOrdinal = completeEvidence();
  duplicateOrdinal.browserFlows[0].session.provenanceRounds[1].roundOrdinal = 1;
  assert.equal(evaluateProvenanceAccessibilityEvidence(duplicateOrdinal, authority).status, "INDETERMINATE");

  const duplicateRoundId = completeEvidence();
  duplicateRoundId.browserFlows[0].session.provenanceRounds[1].roundId = duplicateRoundId.browserFlows[0].session.provenanceRounds[0].roundId;
  assert.equal(evaluateProvenanceAccessibilityEvidence(duplicateRoundId, authority).status, "INDETERMINATE");

  const outOfRangeOrdinal = completeEvidence();
  outOfRangeOrdinal.browserFlows[0].session.provenanceRounds[2].roundOrdinal = 6;
  assert.equal(evaluateProvenanceAccessibilityEvidence(outOfRangeOrdinal, authority).status, "INDETERMINATE");

  const incompleteSession = completeEvidence();
  incompleteSession.browserFlows[0].session.completed = false;
  assert.equal(evaluateProvenanceAccessibilityEvidence(incompleteSession, authority).status, "FAIL");

  const wrongRoundCount = completeEvidence();
  wrongRoundCount.browserFlows[0].session.roundCount = 4;
  assert.equal(evaluateProvenanceAccessibilityEvidence(wrongRoundCount, authority).status, "INDETERMINATE");

  const missingRoundId = completeEvidence();
  missingRoundId.browserFlows[0].session.provenanceRounds[0].roundId = " ";
  assert.equal(evaluateProvenanceAccessibilityEvidence(missingRoundId, authority).status, "INDETERMINATE");

  const duplicateClueCount = completeEvidence();
  duplicateClueCount.browserFlows[0].session.provenanceRounds[2].clueCount = 1;
  assert.equal(evaluateProvenanceAccessibilityEvidence(duplicateClueCount, authority).status, "FAIL");

  const oneCandidateOutcome = completeEvidence();
  oneCandidateOutcome.browserFlows[0].session.provenanceRounds[1].candidateOutcome = "CORRECT";
  assert.equal(evaluateProvenanceAccessibilityEvidence(oneCandidateOutcome, authority).status, "FAIL");

  const extraSessionField = completeEvidence();
  extraSessionField.browserFlows[0].session.claimedComplete = true;
  assert.equal(evaluateProvenanceAccessibilityEvidence(extraSessionField, authority).status, "INDETERMINATE");
});

test("complete scenario and keyboard coverage are mandatory and exact", () => {
  const incompleteScenarios = [];
  const wrongClueCounts = completeEvidence();
  wrongClueCounts.scenarioCoverage.clueCounts = [0, 1];
  incompleteScenarios.push(wrongClueCounts);
  const missingOutcome = completeEvidence();
  missingOutcome.scenarioCoverage.candidateOutcomes = ["CORRECT"];
  incompleteScenarios.push(missingOutcome);
  for (const flag of [
    "answerAccepted", "authorizedReveal", "errorRecovery", "recordedSourceExplanation", "attribution",
    "helpfulSignals", "misleadingSignals", "textEquivalentCorrectness",
  ]) {
    const evidence = completeEvidence();
    evidence.scenarioCoverage[flag] = false;
    incompleteScenarios.push(evidence);
  }
  for (const retained of [["VOID"], ["CONTENT_WITHDRAWN"]]) {
    const evidence = completeEvidence();
    evidence.scenarioCoverage.correctionStates = retained;
    incompleteScenarios.push(evidence);
  }
  for (const evidence of incompleteScenarios) {
    assert.equal(evaluateProvenanceAccessibilityEvidence(evidence, authority).status, "FAIL");
  }

  const requiredKeys = ["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"];
  for (const key of requiredKeys) {
    const missingKey = completeEvidence();
    missingKey.browserFlows[0].keyboardInputs = missingKey.browserFlows[0].keyboardInputs.filter((candidate) => candidate !== key);
    assert.equal(evaluateProvenanceAccessibilityEvidence(missingKey, authority).status, "INDETERMINATE", `keyboard input ${key}`);
  }

  const leaked = completeEvidence();
  leaked.scenarioCoverage.preRevealLeakage = true;
  assert.equal(evaluateProvenanceAccessibilityEvidence(leaked, authority).status, "FAIL");
});

test("results are detached and recursively immutable", () => {
  const evidence = completeEvidence();
  const result = evaluateProvenanceAccessibilityEvidence(evidence, authority);
  evidence.browserFlows.length = 0;
  assert.deepEqual(result, { status: "PASS", invitationsBlocked: false });
  assert.equal(Object.isFrozen(result), true);
});
