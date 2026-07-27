import assert from "node:assert/strict";
import test from "node:test";

import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";
import {
  PRIVACY_ACCESSIBILITY_CHECKS,
  PRIVACY_ACCESSIBILITY_ERROR_STAGES,
  PRIVACY_ACCESSIBILITY_FLOW_STAGES,
  evaluatePrivacyAccessibilityEvidence,
} from "./privacy-support.mjs";

const keys = ["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"];
const atomicEffects = ["CONSENT_WITHDRAWN", "ANALYSIS_EXCLUDED", "CREDENTIAL_CASCADE_REVOKED", "OPTIONAL_TELEMETRY_DISABLED", "OPTIONAL_PROCESSING_STOPPED", "DELETION_CASE_OPENED", "WITHDRAWAL_AUDITED"];
const deletionStatuses = ["CASE_OPENED", "ACKNOWLEDGED", "ACTIVE_STORES_COMPLETED", "DERIVED_RECORDS_COMPLETED", "PROVIDER_PROPAGATED", "BACKUPS_AGED_OUT"];
const errorCases = ["ENROLLMENT_CREDENTIAL_REJECTED", "CONSENT_INCOMPLETE", "CORRECTION_ACKNOWLEDGEMENT_FAILED", "WITHDRAWAL_AUTHENTICATION_FAILED", "DELETION_STATUS_UNAVAILABLE"];
const versions = Object.fromEntries(ACCESSIBILITY_TARGETS.browserFamilies.map((family, index) => [family, [`${120 + index}`, `${121 + index}`]]));
const checks = () => Object.fromEntries(PRIVACY_ACCESSIBILITY_CHECKS.map((check) => [check, true]));
const stages = (names) => names.map((stage) => ({ stage, checks: checks() }));

function errorFlow(errorCase) {
  return {
    errorCase,
    stages: stages(PRIVACY_ACCESSIBILITY_ERROR_STAGES),
    sensitiveEchoAbsent: true,
    partialStateMutation: false,
    focusPreservedOrRepaired: true,
    retryRecovered: true,
  };
}

function journey(prefix, suffix, correctionStatus, derivedTreatment, errors) {
  const journeyId = `${prefix}-journey-${suffix}`;
  const participantLineageId = `${prefix}-lineage-${suffix}`;
  const sessionId = `${prefix}-session-${suffix}`;
  const correctionNoticeId = `${prefix}-notice-${suffix}`;
  const deletionCaseId = `${prefix}-deletion-${suffix}`;
  return {
    journeyId,
    completed: true,
    roundCount: 5,
    stages: stages(PRIVACY_ACCESSIBILITY_FLOW_STAGES),
    errorFlows: errors.map(errorFlow),
    identities: {
      participantLineageId,
      invitationId: `${prefix}-invitation-${suffix}`,
      enrollmentId: `${prefix}-enrollment-${suffix}`,
      sessionId,
      correctionNoticeId,
      deletionCaseId,
    },
    consent: {
      cohortVersionId: "cohort-v1",
      eligibilityPolicyVersionId: "adult-policy-v1",
      consentPolicyVersionId: "adult-policy-v1",
      eligibilityRecorded: true,
      consentRecorded: true,
      eligibilityDistinctFromConsent: true,
      consentInitiallyUnselected: true,
      withdrawalTermsPresented: true,
    },
    correction: {
      status: correctionStatus,
      participantLineageId,
      sessionId,
      roundId: `${prefix}-round-${suffix}`,
      correctionNoticeId,
      correctionNoticeVersionId: "correction-notice-v1",
      acknowledged: true,
      adjustedMaximumPresented: true,
      visibleNonColorState: true,
      screenReaderNotice: true,
      contentWithdrawnGenericOnly: correctionStatus === "CONTENT_WITHDRAWN",
    },
    withdrawal: {
      participantLineageId,
      deletionCaseId,
      authenticated: true,
      atomicEffects: [...atomicEffects],
      physicalDeletionMode: "ASYNCHRONOUS",
      unfinishedDeletionShownAsComplete: false,
    },
    deletion: {
      deletionCaseId,
      derivedTreatment,
      deadlines: { acknowledgementDays: 7, activeStoresDays: 30, backupAgeOutDays: 35 },
      statusVersionId: "deletion-status-v1",
      statuses: deletionStatuses.map((status) => ({ status, announced: true, visibleNonColorState: true, screenReaderLabel: true })),
    },
  };
}

const journeys = (prefix) => [
  journey(prefix, "a", "VOID", "DELETE", errorCases.slice(0, 3)),
  journey(prefix, "b", "CONTENT_WITHDRAWN", "IRREVERSIBLY_DELINK", errorCases.slice(3)),
];

function completeEvidence(kind = "OPERATIONAL_MEASURED") {
  let row = 0;
  return {
    kind,
    flow: "privacy",
    authorityDomainId: "accessibility-review-domain-v1",
    supportMatrixId: "support-matrix-v1",
    flowVersionId: "privacy-flow-v1",
    rendererVersionId: "renderer-v1",
    eventSchemaVersionId: "event-schema-v1",
    correctionNoticeVersionId: "correction-notice-v1",
    deletionStatusVersionId: "deletion-status-v1",
    frozenVersions: structuredClone(versions),
    browserFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({
      family,
      version,
      viewport: { width: 320, height: 568 },
      keyboardInputs: [...keys],
      journeys: journeys(`browser-${row++}`),
    }))),
    assistiveTechnologyFlows: ACCESSIBILITY_TARGETS.assistiveTechnology.map((combination) => ({ combination, journeys: journeys(`at-${row++}`) })),
    noJavaScriptFlows: ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => versions[family].map((version) => ({ family, version, accessibleExplanation: true, partialGameControlCount: 0, privacyControlCount: 0, credentialInputCount: 0 }))),
    review: { reviewerId: "accessibility-reviewer-1", qualificationVersionId: "accessibility-qualification-v1", reviewedAt: "2026-07-15T00:00:00Z", approved: true },
  };
}

const authority = {
  trustDomainId: "accessibility-review-domain-v1",
  verifyEvidence: () => true,
  verifyReview: () => true,
};

test("freezes exact privacy journey, error, and accessibility checks", () => {
  assert.deepEqual(PRIVACY_ACCESSIBILITY_FLOW_STAGES, ["ENROLLMENT_CREDENTIAL", "ELIGIBILITY_REVIEW", "CONSENT_REVIEW", "CONSENT_ACCEPTED", "ENROLLMENT_CONFIRMED", "SESSION_STARTED", "SESSION_COMPLETED", "CORRECTION_NOTICE", "CORRECTION_ACKNOWLEDGED", "WITHDRAWAL_AUTHENTICATED", "WITHDRAWAL_REVIEW", "WITHDRAWAL_COMMITTED", "DELETION_STATUS"]);
  assert.deepEqual(PRIVACY_ACCESSIBILITY_ERROR_STAGES, ["ERROR_PRESENTED", "ERROR_RECOVERED"]);
  assert.deepEqual(PRIVACY_ACCESSIBILITY_CHECKS, ["keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast", "nonColorState", "textEquivalent", "responsive", "reducedMotion"]);
  assert.equal(Object.isFrozen(PRIVACY_ACCESSIBILITY_FLOW_STAGES), true);
  assert.equal(Object.isFrozen(PRIVACY_ACCESSIBILITY_ERROR_STAGES), true);
  assert.equal(Object.isFrozen(PRIVACY_ACCESSIBILITY_CHECKS), true);
});

test("only complete authentic operational privacy evidence can pass", () => {
  assert.deepEqual(evaluatePrivacyAccessibilityEvidence(completeEvidence(), authority), { status: "PASS", invitationsBlocked: false });
  for (const kind of ["SYNTHETIC_TEST_FIXTURE", "LOCAL_AUTOMATED"]) assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(kind), authority).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), { ...authority, verifyEvidence: () => false }).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), { ...authority, verifyReview: () => false }).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), { ...authority, verifyEvidence: () => { throw new Error("bad evidence verifier"); } }).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), { ...authority, verifyReview: () => { throw new Error("bad review verifier"); } }).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), null).status, "INDETERMINATE");
  assert.equal(evaluatePrivacyAccessibilityEvidence(completeEvidence(), { trustDomainId: authority.trustDomainId, verifyEvidence: authority.verifyEvidence }).status, "INDETERMINATE");
  const crossDomain = completeEvidence(); crossDomain.authorityDomainId = "foreign";
  assert.equal(evaluatePrivacyAccessibilityEvidence(crossDomain, authority).status, "INDETERMINATE");
  const wrongFlow = completeEvidence(); wrongFlow.flow = "language";
  assert.equal(evaluatePrivacyAccessibilityEvidence(wrongFlow, authority).status, "INDETERMINATE");
});

test("every browser and AT journey stage check is enforced with failure precedence", () => {
  for (const check of PRIVACY_ACCESSIBILITY_CHECKS) {
    for (const stageIndex of PRIVACY_ACCESSIBILITY_FLOW_STAGES.keys()) {
      for (const journeyIndex of [0, 1]) {
        const browser = completeEvidence(); browser.browserFlows[0].journeys[journeyIndex].stages[stageIndex].checks[check] = false;
        assert.equal(evaluatePrivacyAccessibilityEvidence(browser, authority).status, "FAIL", `browser ${journeyIndex} ${stageIndex} ${check}`);
        const at = completeEvidence(); at.assistiveTechnologyFlows[0].journeys[journeyIndex].stages[stageIndex].checks[check] = false;
        assert.equal(evaluatePrivacyAccessibilityEvidence(at, authority).status, "FAIL", `AT ${journeyIndex} ${stageIndex} ${check}`);
      }
    }
  }
  const failureAndMissing = completeEvidence();
  failureAndMissing.browserFlows[0].journeys[0].stages[4].checks.contrast = false;
  failureAndMissing.assistiveTechnologyFlows.pop();
  assert.equal(evaluatePrivacyAccessibilityEvidence(failureAndMissing, authority).status, "FAIL");
});

test("requires two distinct identity-bound completed five-round journeys per environment", () => {
  const incomplete = [];
  const oneJourney = completeEvidence(); oneJourney.browserFlows[0].journeys.pop(); incomplete.push(oneJourney);
  const wrongRounds = completeEvidence(); wrongRounds.browserFlows[0].journeys[0].roundCount = 4; incomplete.push(wrongRounds);
  const reordered = completeEvidence(); reordered.assistiveTechnologyFlows[0].journeys[0].stages.reverse(); incomplete.push(reordered);
  const nullBrowserJourney = completeEvidence(); nullBrowserJourney.browserFlows[0].journeys[0] = null; incomplete.push(nullBrowserJourney);
  const malformedAtJourney = completeEvidence(); malformedAtJourney.assistiveTechnologyFlows[0].journeys[0] = "bad"; incomplete.push(malformedAtJourney);
  const nullStage = completeEvidence(); nullStage.browserFlows[0].journeys[0].stages[0] = null; incomplete.push(nullStage);
  const nullChecks = completeEvidence(); nullChecks.assistiveTechnologyFlows[0].journeys[0].stages[0].checks = null; incomplete.push(nullChecks);
  const nullErrorStage = completeEvidence(); nullErrorStage.browserFlows[0].journeys[0].errorFlows[0].stages[0] = null; incomplete.push(nullErrorStage);
  const nullIdentities = completeEvidence(); nullIdentities.browserFlows[0].journeys[0].identities = null; incomplete.push(nullIdentities);
  const nullConsent = completeEvidence(); nullConsent.browserFlows[0].journeys[0].consent = null; incomplete.push(nullConsent);
  const nullCorrection = completeEvidence(); nullCorrection.browserFlows[0].journeys[0].correction = null; incomplete.push(nullCorrection);
  const nullWithdrawal = completeEvidence(); nullWithdrawal.browserFlows[0].journeys[0].withdrawal = null; incomplete.push(nullWithdrawal);
  const nullDeletion = completeEvidence(); nullDeletion.browserFlows[0].journeys[0].deletion = null; incomplete.push(nullDeletion);
  const nullDeadlines = completeEvidence(); nullDeadlines.browserFlows[0].journeys[0].deletion.deadlines = null; incomplete.push(nullDeadlines);
  const nullDeletionStatus = completeEvidence(); nullDeletionStatus.browserFlows[0].journeys[0].deletion.statuses[0] = null; incomplete.push(nullDeletionStatus);
  const nullReview = completeEvidence(); nullReview.review = null; incomplete.push(nullReview);
  const nullNoJs = completeEvidence(); nullNoJs.noJavaScriptFlows[0] = null; incomplete.push(nullNoJs);
  const missingNested = completeEvidence(); delete missingNested.browserFlows[0].journeys[0].identities.enrollmentId; incomplete.push(missingNested);
  const extraNested = completeEvidence(); extraNested.browserFlows[0].journeys[0].consent.claimedAccessible = true; incomplete.push(extraNested);
  const missingCorrection = completeEvidence(); delete missingCorrection.browserFlows[0].journeys[0].correction.roundId; incomplete.push(missingCorrection);
  const extraWithdrawal = completeEvidence(); extraWithdrawal.browserFlows[0].journeys[0].withdrawal.claimedAtomicDeletion = true; incomplete.push(extraWithdrawal);
  const extraDeletionStatus = completeEvidence(); extraDeletionStatus.browserFlows[0].journeys[0].deletion.statuses[0].color = "green"; incomplete.push(extraDeletionStatus);
  const extraError = completeEvidence(); extraError.browserFlows[0].journeys[0].errorFlows[0].message = "retry"; incomplete.push(extraError);
  const extraStage = completeEvidence(); extraStage.browserFlows[0].journeys[0].stages[0].order = 1; incomplete.push(extraStage);
  for (const evidence of incomplete) assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "INDETERMINATE");
  const measuredIncomplete = completeEvidence(); measuredIncomplete.browserFlows[0].journeys[0].completed = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(measuredIncomplete, authority).status, "FAIL");
  const blankJourneyId = completeEvidence(); blankJourneyId.browserFlows[0].journeys[0].journeyId = " ";
  assert.equal(evaluatePrivacyAccessibilityEvidence(blankJourneyId, authority).status, "FAIL");
  for (const field of ["journeyId", "participantLineageId", "invitationId", "enrollmentId", "sessionId", "correctionNoticeId", "deletionCaseId"]) {
    const duplicate = completeEvidence();
    if (field === "journeyId") duplicate.browserFlows[0].journeys[1].journeyId = duplicate.browserFlows[0].journeys[0].journeyId;
    else duplicate.browserFlows[0].journeys[1].identities[field] = duplicate.browserFlows[0].journeys[0].identities[field];
    assert.equal(evaluatePrivacyAccessibilityEvidence(duplicate, authority).status, "FAIL", `duplicate ${field}`);
  }
});

test("enforces exact identity, policy, and distinct accessible consent semantics", () => {
  const identityFields = ["participantLineageId", "invitationId", "enrollmentId", "sessionId", "correctionNoticeId", "deletionCaseId"];
  for (const field of identityFields) {
    const blank = completeEvidence(); blank.browserFlows[0].journeys[0].identities[field] = " ";
    assert.equal(evaluatePrivacyAccessibilityEvidence(blank, authority).status, "FAIL", field);
  }
  for (const field of ["eligibilityRecorded", "consentRecorded", "eligibilityDistinctFromConsent", "consentInitiallyUnselected", "withdrawalTermsPresented"]) {
    const evidence = completeEvidence(); evidence.browserFlows[0].journeys[0].consent[field] = false;
    assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  const policyDrift = completeEvidence(); policyDrift.browserFlows[0].journeys[0].consent.consentPolicyVersionId = "other-policy";
  assert.equal(evaluatePrivacyAccessibilityEvidence(policyDrift, authority).status, "FAIL");
  const reversePolicyDrift = completeEvidence(); reversePolicyDrift.browserFlows[0].journeys[0].consent.eligibilityPolicyVersionId = "other-policy";
  assert.equal(evaluatePrivacyAccessibilityEvidence(reversePolicyDrift, authority).status, "FAIL");
  for (const field of ["cohortVersionId", "eligibilityPolicyVersionId", "consentPolicyVersionId"]) {
    const blank = completeEvidence(); blank.browserFlows[0].journeys[0].consent[field] = " ";
    assert.equal(evaluatePrivacyAccessibilityEvidence(blank, authority).status, "FAIL", `blank ${field}`);
    const missing = completeEvidence(); delete missing.browserFlows[0].journeys[0].consent[field];
    assert.equal(evaluatePrivacyAccessibilityEvidence(missing, authority).status, "INDETERMINATE", `missing ${field}`);
  }
  for (const field of ["supportMatrixId", "flowVersionId", "rendererVersionId", "eventSchemaVersionId", "correctionNoticeVersionId", "deletionStatusVersionId"]) {
    const blank = completeEvidence(); blank[field] = " ";
    assert.equal(evaluatePrivacyAccessibilityEvidence(blank, authority).status, "INDETERMINATE", field);
  }
});

test("binds correction notice identity and covers both correction states without disclosure drift", () => {
  for (const [field, value] of [["participantLineageId", "other-lineage"], ["sessionId", "other-session"], ["correctionNoticeId", "other-notice"], ["correctionNoticeVersionId", "other-version"]]) {
    const correctionDrift = completeEvidence(); correctionDrift.browserFlows[0].journeys[0].correction[field] = value;
    assert.equal(evaluatePrivacyAccessibilityEvidence(correctionDrift, authority).status, "FAIL", field);
  }
  const unacknowledged = completeEvidence(); unacknowledged.browserFlows[0].journeys[0].correction.acknowledged = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(unacknowledged, authority).status, "FAIL");
  const exposed = completeEvidence(); exposed.browserFlows[0].journeys[1].correction.contentWithdrawnGenericOnly = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(exposed, authority).status, "FAIL");
  const oneState = completeEvidence(); oneState.browserFlows[0].journeys[1].correction.status = "VOID"; oneState.browserFlows[0].journeys[1].correction.contentWithdrawnGenericOnly = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(oneState, authority).status, "FAIL");
  const versionDrift = completeEvidence(); versionDrift.browserFlows[0].journeys[0].correction.correctionNoticeVersionId = "other-version";
  assert.equal(evaluatePrivacyAccessibilityEvidence(versionDrift, authority).status, "FAIL");
  const blankRoundId = completeEvidence(); blankRoundId.browserFlows[0].journeys[0].correction.roundId = " ";
  assert.equal(evaluatePrivacyAccessibilityEvidence(blankRoundId, authority).status, "FAIL");
  for (const field of ["adjustedMaximumPresented", "visibleNonColorState", "screenReaderNotice"]) {
    const evidence = completeEvidence(); evidence.browserFlows[0].journeys[0].correction[field] = false;
    assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
});

test("requires the exact seven atomic withdrawal effects and asynchronous physical deletion truth", () => {
  const missingEffect = completeEvidence(); missingEffect.browserFlows[0].journeys[0].withdrawal.atomicEffects.pop();
  assert.equal(evaluatePrivacyAccessibilityEvidence(missingEffect, authority).status, "FAIL");
  const reordered = completeEvidence(); reordered.assistiveTechnologyFlows[0].journeys[0].withdrawal.atomicEffects.reverse();
  assert.equal(evaluatePrivacyAccessibilityEvidence(reordered, authority).status, "FAIL");
  const unauthenticated = completeEvidence(); unauthenticated.browserFlows[0].journeys[0].withdrawal.authenticated = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(unauthenticated, authority).status, "FAIL");
  const fakeAtomicDeletion = completeEvidence(); fakeAtomicDeletion.browserFlows[0].journeys[0].withdrawal.physicalDeletionMode = "ATOMIC";
  assert.equal(evaluatePrivacyAccessibilityEvidence(fakeAtomicDeletion, authority).status, "FAIL");
  const falseCompletion = completeEvidence(); falseCompletion.browserFlows[0].journeys[0].withdrawal.unfinishedDeletionShownAsComplete = true;
  assert.equal(evaluatePrivacyAccessibilityEvidence(falseCompletion, authority).status, "FAIL");
  const identityDrift = completeEvidence(); identityDrift.browserFlows[0].journeys[0].withdrawal.deletionCaseId = "other-case";
  assert.equal(evaluatePrivacyAccessibilityEvidence(identityDrift, authority).status, "FAIL");
  const lineageDrift = completeEvidence(); lineageDrift.browserFlows[0].journeys[0].withdrawal.participantLineageId = "other-lineage";
  assert.equal(evaluatePrivacyAccessibilityEvidence(lineageDrift, authority).status, "FAIL");
  const semanticFailureAndMissing = completeEvidence();
  semanticFailureAndMissing.browserFlows[0].journeys[0].withdrawal.physicalDeletionMode = "ATOMIC";
  semanticFailureAndMissing.assistiveTechnologyFlows.pop();
  assert.equal(evaluatePrivacyAccessibilityEvidence(semanticFailureAndMissing, authority).status, "FAIL");
});

test("enforces ordered accessible deletion status, deadlines, and both derived treatments", () => {
  for (const [field, value] of [["acknowledgementDays", 8], ["activeStoresDays", 31], ["backupAgeOutDays", 36]]) {
    const wrongDeadline = completeEvidence(); wrongDeadline.browserFlows[0].journeys[0].deletion.deadlines[field] = value;
    assert.equal(evaluatePrivacyAccessibilityEvidence(wrongDeadline, authority).status, "FAIL", field);
  }
  const reordered = completeEvidence(); reordered.browserFlows[0].journeys[0].deletion.statuses.reverse();
  assert.equal(evaluatePrivacyAccessibilityEvidence(reordered, authority).status, "FAIL");
  for (const field of ["announced", "visibleNonColorState", "screenReaderLabel"]) {
    const evidence = completeEvidence(); evidence.assistiveTechnologyFlows[0].journeys[0].deletion.statuses[0][field] = false;
    assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  const oneTreatment = completeEvidence(); oneTreatment.browserFlows[0].journeys[1].deletion.derivedTreatment = "DELETE";
  assert.equal(evaluatePrivacyAccessibilityEvidence(oneTreatment, authority).status, "FAIL");
  const caseDrift = completeEvidence(); caseDrift.browserFlows[0].journeys[0].deletion.deletionCaseId = "other-case";
  assert.equal(evaluatePrivacyAccessibilityEvidence(caseDrift, authority).status, "FAIL");
  const statusVersionDrift = completeEvidence(); statusVersionDrift.browserFlows[0].journeys[0].deletion.statusVersionId = "other-version";
  assert.equal(evaluatePrivacyAccessibilityEvidence(statusVersionDrift, authority).status, "FAIL");
});

test("requires all five accessible, mutation-safe, recoverable error cases", () => {
  for (const journeyIndex of [0, 1]) {
    for (const errorIndex of journeys("coverage")[journeyIndex].errorFlows.keys()) {
      for (const field of ["sensitiveEchoAbsent", "focusPreservedOrRepaired", "retryRecovered"]) {
        const evidence = completeEvidence(); evidence.browserFlows[0].journeys[journeyIndex].errorFlows[errorIndex][field] = false;
        assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", `${journeyIndex} ${errorIndex} ${field}`);
      }
      const mutation = completeEvidence(); mutation.assistiveTechnologyFlows[0].journeys[journeyIndex].errorFlows[errorIndex].partialStateMutation = true;
      assert.equal(evaluatePrivacyAccessibilityEvidence(mutation, authority).status, "FAIL", `${journeyIndex} ${errorIndex} mutation`);
    }
  }
  const missing = completeEvidence(); missing.browserFlows[0].journeys[0].errorFlows.pop();
  assert.equal(evaluatePrivacyAccessibilityEvidence(missing, authority).status, "FAIL");
  const duplicate = completeEvidence(); duplicate.browserFlows[0].journeys[1].errorFlows[0].errorCase = "ENROLLMENT_CREDENTIAL_REJECTED";
  assert.equal(evaluatePrivacyAccessibilityEvidence(duplicate, authority).status, "FAIL");
  const nullError = completeEvidence(); nullError.browserFlows[0].journeys[0].errorFlows[0] = null;
  assert.equal(evaluatePrivacyAccessibilityEvidence(nullError, authority).status, "INDETERMINATE");
  const unknown = completeEvidence(); unknown.browserFlows[0].journeys[0].errorFlows[0].errorCase = "UNKNOWN";
  assert.equal(evaluatePrivacyAccessibilityEvidence(unknown, authority).status, "FAIL");
  const extra = completeEvidence(); extra.browserFlows[0].journeys[0].errorFlows.push(errorFlow("UNKNOWN"));
  assert.equal(evaluatePrivacyAccessibilityEvidence(extra, authority).status, "FAIL");
  for (const check of PRIVACY_ACCESSIBILITY_CHECKS) {
    for (const stageIndex of PRIVACY_ACCESSIBILITY_ERROR_STAGES.keys()) {
      for (const journeyIndex of [0, 1]) {
        for (const errorIndex of journeys("coverage")[journeyIndex].errorFlows.keys()) {
          const browser = completeEvidence(); browser.browserFlows[0].journeys[journeyIndex].errorFlows[errorIndex].stages[stageIndex].checks[check] = false;
          assert.equal(evaluatePrivacyAccessibilityEvidence(browser, authority).status, "FAIL", `browser error ${journeyIndex} ${errorIndex} ${stageIndex} ${check}`);
          const at = completeEvidence(); at.assistiveTechnologyFlows[0].journeys[journeyIndex].errorFlows[errorIndex].stages[stageIndex].checks[check] = false;
          assert.equal(evaluatePrivacyAccessibilityEvidence(at, authority).status, "FAIL", `AT error ${journeyIndex} ${errorIndex} ${stageIndex} ${check}`);
        }
      }
    }
  }
  const falseErrorCheck = completeEvidence(); falseErrorCheck.browserFlows[0].journeys[0].errorFlows[0].stages[0].checks.announcements = false; falseErrorCheck.assistiveTechnologyFlows.pop();
  assert.equal(evaluatePrivacyAccessibilityEvidence(falseErrorCheck, authority).status, "FAIL");
});

test("requires exact browser, AT, no-JavaScript, review, and privacy-safe envelopes", () => {
  const incomplete = [];
  const missingBrowser = completeEvidence(); missingBrowser.browserFlows.pop(); incomplete.push(missingBrowser);
  const duplicateBrowser = completeEvidence(); duplicateBrowser.browserFlows.push(structuredClone(duplicateBrowser.browserFlows[0])); incomplete.push(duplicateBrowser);
  const missingAt = completeEvidence(); missingAt.assistiveTechnologyFlows.pop(); incomplete.push(missingAt);
  const duplicateAt = completeEvidence(); duplicateAt.assistiveTechnologyFlows.push(structuredClone(duplicateAt.assistiveTechnologyFlows[0])); incomplete.push(duplicateAt);
  const missingNoJs = completeEvidence(); missingNoJs.noJavaScriptFlows.pop(); incomplete.push(missingNoJs);
  const wrongViewport = completeEvidence(); wrongViewport.browserFlows[0].viewport.width = 321; incomplete.push(wrongViewport);
  const missingKey = completeEvidence(); missingKey.browserFlows[0].keyboardInputs.pop(); incomplete.push(missingKey);
  const unapproved = completeEvidence(); unapproved.review.approved = false; incomplete.push(unapproved);
  const nullBrowser = completeEvidence(); nullBrowser.browserFlows[0] = null; incomplete.push(nullBrowser);
  const nullAt = completeEvidence(); nullAt.assistiveTechnologyFlows[0] = null; incomplete.push(nullAt);
  const extra = completeEvidence(); extra.claimedPass = true; incomplete.push(extra);
  const missingVersionFamily = completeEvidence(); delete missingVersionFamily.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]]; incomplete.push(missingVersionFamily);
  const duplicateVersion = completeEvidence(); duplicateVersion.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]][1] = duplicateVersion.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]][0]; incomplete.push(duplicateVersion);
  const nonNumericVersion = completeEvidence(); nonNumericVersion.frozenVersions[ACCESSIBILITY_TARGETS.browserFamilies[0]][0] = "current"; incomplete.push(nonNumericVersion);
  const extraReview = completeEvidence(); extraReview.review.claimedQualified = true; incomplete.push(extraReview);
  const missingReview = completeEvidence(); delete missingReview.review.reviewerId; incomplete.push(missingReview);
  const blankReviewer = completeEvidence(); blankReviewer.review.reviewerId = " "; incomplete.push(blankReviewer);
  const blankQualification = completeEvidence(); blankQualification.review.qualificationVersionId = " "; incomplete.push(blankQualification);
  const badReviewTime = completeEvidence(); badReviewTime.review.reviewedAt = "tomorrow"; incomplete.push(badReviewTime);
  const nonBooleanApproval = completeEvidence(); nonBooleanApproval.review.approved = "yes"; incomplete.push(nonBooleanApproval);
  for (const evidence of incomplete) assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "INDETERMINATE");
  for (const [field, value] of [["accessibleExplanation", false], ["partialGameControlCount", 1], ["privacyControlCount", 1], ["credentialInputCount", 1]]) {
    const evidence = completeEvidence(); evidence.noJavaScriptFlows[0][field] = value;
    assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", field);
  }
  for (const forbidden of ["rawCredential", "authenticationProof", "recruitmentIdentity", "freeText", "rawCode", "prompt", "ipFingerprint", "fullUserAgent", "secret"]) {
    const evidence = completeEvidence(); evidence.browserFlows[0].journeys[0][forbidden] = "forbidden";
    assert.equal(evaluatePrivacyAccessibilityEvidence(evidence, authority).status, "FAIL", forbidden);
  }
  const nestedIdentityForbidden = completeEvidence(); nestedIdentityForbidden.browserFlows[0].journeys[0].identities.rawCredential = "forbidden";
  assert.equal(evaluatePrivacyAccessibilityEvidence(nestedIdentityForbidden, authority).status, "FAIL");
  const nestedErrorForbidden = completeEvidence(); nestedErrorForbidden.browserFlows[0].journeys[0].errorFlows[0].authenticationProof = "forbidden";
  assert.equal(evaluatePrivacyAccessibilityEvidence(nestedErrorForbidden, authority).status, "FAIL");
  const nestedDeletionForbidden = completeEvidence(); nestedDeletionForbidden.browserFlows[0].journeys[0].deletion.secret = "forbidden";
  assert.equal(evaluatePrivacyAccessibilityEvidence(nestedDeletionForbidden, authority).status, "FAIL");
  const conflictingDuplicate = completeEvidence();
  conflictingDuplicate.assistiveTechnologyFlows.push(structuredClone(conflictingDuplicate.assistiveTechnologyFlows[0]));
  conflictingDuplicate.assistiveTechnologyFlows.at(-1).journeys[0].stages[0].checks.contrast = false;
  assert.equal(evaluatePrivacyAccessibilityEvidence(conflictingDuplicate, authority).status, "FAIL");
});
