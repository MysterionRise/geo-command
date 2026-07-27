import { ACCESSIBILITY_TARGETS } from "./support-gate.mjs";

export const PRIVACY_ACCESSIBILITY_FLOW_STAGES = Object.freeze(["ENROLLMENT_CREDENTIAL", "ELIGIBILITY_REVIEW", "CONSENT_REVIEW", "CONSENT_ACCEPTED", "ENROLLMENT_CONFIRMED", "SESSION_STARTED", "SESSION_COMPLETED", "CORRECTION_NOTICE", "CORRECTION_ACKNOWLEDGED", "WITHDRAWAL_AUTHENTICATED", "WITHDRAWAL_REVIEW", "WITHDRAWAL_COMMITTED", "DELETION_STATUS"]);
export const PRIVACY_ACCESSIBILITY_ERROR_STAGES = Object.freeze(["ERROR_PRESENTED", "ERROR_RECOVERED"]);
export const PRIVACY_ACCESSIBILITY_CHECKS = Object.freeze(["keyboardOnly", "stableVisibleFocus", "announcements", "screenReaderLabels", "contrast", "nonColorState", "textEquivalent", "responsive", "reducedMotion"]);

const keyboardInputs = Object.freeze(["Tab", "Shift+Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"]);
const atomicEffects = Object.freeze(["CONSENT_WITHDRAWN", "ANALYSIS_EXCLUDED", "CREDENTIAL_CASCADE_REVOKED", "OPTIONAL_TELEMETRY_DISABLED", "OPTIONAL_PROCESSING_STOPPED", "DELETION_CASE_OPENED", "WITHDRAWAL_AUDITED"]);
const deletionStatuses = Object.freeze(["CASE_OPENED", "ACKNOWLEDGED", "ACTIVE_STORES_COMPLETED", "DERIVED_RECORDS_COMPLETED", "PROVIDER_PROPAGATED", "BACKUPS_AGED_OUT"]);
const errorCases = Object.freeze(["ENROLLMENT_CREDENTIAL_REJECTED", "CONSENT_INCOMPLETE", "CORRECTION_ACKNOWLEDGEMENT_FAILED", "WITHDRAWAL_AUTHENTICATION_FAILED", "DELETION_STATUS_UNAVAILABLE"]);
const identityKeys = Object.freeze(["participantLineageId", "invitationId", "enrollmentId", "sessionId", "correctionNoticeId", "deletionCaseId"]);
const topKeys = Object.freeze(["assistiveTechnologyFlows", "authorityDomainId", "browserFlows", "correctionNoticeVersionId", "deletionStatusVersionId", "eventSchemaVersionId", "flow", "flowVersionId", "frozenVersions", "kind", "noJavaScriptFlows", "rendererVersionId", "review", "supportMatrixId"]);
const journeyKeys = Object.freeze(["completed", "consent", "correction", "deletion", "errorFlows", "identities", "journeyId", "roundCount", "stages", "withdrawal"]);
const errorKeys = Object.freeze(["errorCase", "focusPreservedOrRepaired", "partialStateMutation", "retryRecovered", "sensitiveEchoAbsent", "stages"]);
const correctionKeys = Object.freeze(["acknowledged", "adjustedMaximumPresented", "contentWithdrawnGenericOnly", "correctionNoticeId", "correctionNoticeVersionId", "participantLineageId", "roundId", "screenReaderNotice", "sessionId", "status", "visibleNonColorState"]);
const withdrawalKeys = Object.freeze(["atomicEffects", "authenticated", "deletionCaseId", "participantLineageId", "physicalDeletionMode", "unfinishedDeletionShownAsComplete"]);
const deletionKeys = Object.freeze(["deadlines", "deletionCaseId", "derivedTreatment", "statuses", "statusVersionId"]);
const deletionStatusKeys = Object.freeze(["announced", "screenReaderLabel", "status", "visibleNonColorState"]);
const forbiddenKeys = new Set(["rawCredential", "authenticationProof", "recruitmentIdentity", "freeText", "rawCode", "prompt", "ipFingerprint", "fullUserAgent", "secret"]);
const PASS = Object.freeze({ status: "PASS", invitationsBlocked: false });
const FAIL = Object.freeze({ status: "FAIL", invitationsBlocked: true });
const INDETERMINATE = Object.freeze({ status: "INDETERMINATE", invitationsBlocked: true });
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const nonBlank = (value) => typeof value === "string" && value.trim().length > 0;
const exactKeys = (value, expected) => isRecord(value) && Object.keys(value).sort().join("|") === [...expected].sort().join("|");
const exactArray = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]);
const safeVerify = (verify, ...values) => { try { return verify(...values) === true; } catch { return false; } };

function validStages(value, expectedStages) {
  return Array.isArray(value) && value.length === expectedStages.length
    && value.every((row, index) => exactKeys(row, ["checks", "stage"])
      && row.stage === expectedStages[index]
      && exactKeys(row.checks, PRIVACY_ACCESSIBILITY_CHECKS)
      && PRIVACY_ACCESSIBILITY_CHECKS.every((check) => typeof row.checks[check] === "boolean"));
}

function validIdentities(value) {
  return exactKeys(value, identityKeys) && identityKeys.every((key) => nonBlank(value[key]));
}

function validConsent(value) {
  return exactKeys(value, ["cohortVersionId", "consentInitiallyUnselected", "consentPolicyVersionId", "consentRecorded", "eligibilityDistinctFromConsent", "eligibilityPolicyVersionId", "eligibilityRecorded", "withdrawalTermsPresented"])
    && nonBlank(value.cohortVersionId) && nonBlank(value.eligibilityPolicyVersionId) && nonBlank(value.consentPolicyVersionId)
    && value.eligibilityPolicyVersionId === value.consentPolicyVersionId
    && ["eligibilityRecorded", "consentRecorded", "eligibilityDistinctFromConsent", "consentInitiallyUnselected", "withdrawalTermsPresented"].every((field) => value[field] === true);
}

function validCorrection(value, identities, correctionNoticeVersionId) {
  return exactKeys(value, correctionKeys) && validIdentities(identities)
    && nonBlank(value.roundId) && nonBlank(value.correctionNoticeVersionId)
    && (value.status === "VOID" || value.status === "CONTENT_WITHDRAWN")
    && value.participantLineageId === identities.participantLineageId && value.sessionId === identities.sessionId
    && value.correctionNoticeId === identities.correctionNoticeId && value.correctionNoticeVersionId === correctionNoticeVersionId
    && value.acknowledged === true && value.adjustedMaximumPresented === true
    && value.visibleNonColorState === true && value.screenReaderNotice === true
    && value.contentWithdrawnGenericOnly === (value.status === "CONTENT_WITHDRAWN");
}

function validWithdrawal(value, identities) {
  return exactKeys(value, withdrawalKeys) && validIdentities(identities)
    && value.participantLineageId === identities.participantLineageId && value.deletionCaseId === identities.deletionCaseId
    && value.authenticated === true && exactArray(value.atomicEffects, atomicEffects)
    && value.physicalDeletionMode === "ASYNCHRONOUS" && value.unfinishedDeletionShownAsComplete === false;
}

function validDeletionStatus(value, expectedStatus) {
  return exactKeys(value, deletionStatusKeys) && value.status === expectedStatus
    && value.announced === true && value.visibleNonColorState === true && value.screenReaderLabel === true;
}

function validDeletion(value, identities, deletionStatusVersionId) {
  return exactKeys(value, deletionKeys) && validIdentities(identities)
    && value.deletionCaseId === identities.deletionCaseId
    && (value.derivedTreatment === "DELETE" || value.derivedTreatment === "IRREVERSIBLY_DELINK")
    && value.statusVersionId === deletionStatusVersionId
    && exactKeys(value.deadlines, ["acknowledgementDays", "activeStoresDays", "backupAgeOutDays"])
    && value.deadlines.acknowledgementDays === 7 && value.deadlines.activeStoresDays === 30 && value.deadlines.backupAgeOutDays === 35
    && Array.isArray(value.statuses) && value.statuses.length === deletionStatuses.length
    && value.statuses.every((status, index) => validDeletionStatus(status, deletionStatuses[index]));
}

function validError(value) {
  return exactKeys(value, errorKeys) && errorCases.includes(value.errorCase)
    && validStages(value.stages, PRIVACY_ACCESSIBILITY_ERROR_STAGES)
    && value.sensitiveEchoAbsent === true && value.partialStateMutation === false
    && value.focusPreservedOrRepaired === true && value.retryRecovered === true;
}

function validJourney(value, evidence) {
  return exactKeys(value, journeyKeys) && nonBlank(value.journeyId) && value.completed === true && value.roundCount === 5
    && validStages(value.stages, PRIVACY_ACCESSIBILITY_FLOW_STAGES)
    && Array.isArray(value.errorFlows) && value.errorFlows.every(validError)
    && validIdentities(value.identities) && validConsent(value.consent)
    && validCorrection(value.correction, value.identities, evidence.correctionNoticeVersionId)
    && validWithdrawal(value.withdrawal, value.identities)
    && validDeletion(value.deletion, value.identities, evidence.deletionStatusVersionId);
}

function exactJourneyAggregate(value, evidence) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((journey) => validJourney(journey, evidence))) return false;
  if (new Set(value.map((journey) => journey.journeyId.trim())).size !== 2) return false;
  if (!identityKeys.every((key) => new Set(value.map((journey) => journey.identities[key].trim())).size === 2)) return false;
  if (!exactArray(value.map((journey) => journey.correction.status).sort(), ["CONTENT_WITHDRAWN", "VOID"])) return false;
  if (!exactArray(value.map((journey) => journey.deletion.derivedTreatment).sort(), ["DELETE", "IRREVERSIBLY_DELINK"])) return false;
  return exactArray(value.flatMap((journey) => journey.errorFlows.map((error) => error.errorCase)).sort(), [...errorCases].sort());
}

function validFrozenVersions(value) {
  return exactKeys(value, ACCESSIBILITY_TARGETS.browserFamilies) && ACCESSIBILITY_TARGETS.browserFamilies.every((family) => {
    const versions = value[family];
    return Array.isArray(versions) && versions.length === 2 && versions.every((version) => typeof version === "string" && /^\d+$/.test(version)) && new Set(versions).size === 2;
  });
}

function browserPairs(value) {
  return validFrozenVersions(value) ? ACCESSIBILITY_TARGETS.browserFamilies.flatMap((family) => value[family].map((version) => ({ family, version }))) : [];
}

function validBrowserFlows(value, evidence) {
  const expected = browserPairs(evidence.frozenVersions);
  return Array.isArray(value) && value.length === expected.length && expected.every(({ family, version }) => {
    const matches = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    return matches.length === 1 && exactKeys(matches[0], ["family", "journeys", "keyboardInputs", "version", "viewport"])
      && exactKeys(matches[0].viewport, ["height", "width"]) && matches[0].viewport.width === 320 && matches[0].viewport.height === 568
      && exactArray(matches[0].keyboardInputs, keyboardInputs) && exactJourneyAggregate(matches[0].journeys, evidence);
  });
}

function validAtFlows(value, evidence) {
  return Array.isArray(value) && value.length === ACCESSIBILITY_TARGETS.assistiveTechnology.length
    && ACCESSIBILITY_TARGETS.assistiveTechnology.every((combination) => {
      const matches = value.filter((row) => isRecord(row) && row.combination === combination);
      return matches.length === 1 && exactKeys(matches[0], ["combination", "journeys"]) && exactJourneyAggregate(matches[0].journeys, evidence);
    });
}

function validNoJavaScript(value, frozenVersions) {
  const expected = browserPairs(frozenVersions);
  return Array.isArray(value) && value.length === expected.length && expected.every(({ family, version }) => {
    const matches = value.filter((row) => isRecord(row) && row.family === family && row.version === version);
    return matches.length === 1 && exactKeys(matches[0], ["accessibleExplanation", "credentialInputCount", "family", "partialGameControlCount", "privacyControlCount", "version"])
      && matches[0].accessibleExplanation === true && matches[0].partialGameControlCount === 0
      && matches[0].privacyControlCount === 0 && matches[0].credentialInputCount === 0;
  });
}

function validReview(value) {
  return exactKeys(value, ["approved", "qualificationVersionId", "reviewedAt", "reviewerId"])
    && nonBlank(value.reviewerId) && nonBlank(value.qualificationVersionId)
    && typeof value.reviewedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.reviewedAt)
    && Number.isFinite(Date.parse(value.reviewedAt)) && value.approved === true;
}

function allRows(value) {
  return [...(Array.isArray(value.browserFlows) ? value.browserFlows : []), ...(Array.isArray(value.assistiveTechnologyFlows) ? value.assistiveTechnologyFlows : [])];
}

function allJourneys(value) {
  return allRows(value).flatMap((row) => isRecord(row) && Array.isArray(row.journeys) ? row.journeys : []);
}

function containsForbiddenKey(value, seen = new WeakSet()) {
  if (!isRecord(value) && !Array.isArray(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (isRecord(value) && Object.keys(value).some((key) => forbiddenKeys.has(key))) return true;
  return Object.values(value).some((entry) => containsForbiddenKey(entry, seen));
}

function explicitFalseCheck(value) {
  return allJourneys(value).some((journey) => isRecord(journey) && [
    ...(Array.isArray(journey.stages) ? journey.stages : []),
    ...(Array.isArray(journey.errorFlows) ? journey.errorFlows : []).flatMap((error) => isRecord(error) && Array.isArray(error.stages) ? error.stages : []),
  ].some((stage) => isRecord(stage) && isRecord(stage.checks) && PRIVACY_ACCESSIBILITY_CHECKS.some((check) => stage.checks[check] === false)));
}

function exactSemanticFailure(journey, evidence) {
  if (!isRecord(journey)) return false;
  if (journey.completed === false) return true;
  if (exactKeys(journey, journeyKeys) && !nonBlank(journey.journeyId)) return true;
  const identities = journey.identities;
  if (exactKeys(identities, identityKeys) && !identityKeys.every((key) => nonBlank(identities[key]))) return true;
  if (exactKeys(journey.consent, ["cohortVersionId", "consentInitiallyUnselected", "consentPolicyVersionId", "consentRecorded", "eligibilityDistinctFromConsent", "eligibilityPolicyVersionId", "eligibilityRecorded", "withdrawalTermsPresented"]) && !validConsent(journey.consent)) return true;
  const correction = journey.correction;
  if (exactKeys(correction, correctionKeys)) {
    if (!nonBlank(correction.roundId) || !nonBlank(correction.correctionNoticeVersionId)
      || !["VOID", "CONTENT_WITHDRAWN"].includes(correction.status)
      || correction.acknowledged !== true || correction.adjustedMaximumPresented !== true
      || correction.visibleNonColorState !== true || correction.screenReaderNotice !== true
      || correction.contentWithdrawnGenericOnly !== (correction.status === "CONTENT_WITHDRAWN")) return true;
    if (nonBlank(evidence.correctionNoticeVersionId) && correction.correctionNoticeVersionId !== evidence.correctionNoticeVersionId) return true;
    if (validIdentities(identities) && (correction.participantLineageId !== identities.participantLineageId || correction.sessionId !== identities.sessionId || correction.correctionNoticeId !== identities.correctionNoticeId)) return true;
  }
  const withdrawal = journey.withdrawal;
  if (exactKeys(withdrawal, withdrawalKeys)) {
    if (withdrawal.authenticated !== true || !exactArray(withdrawal.atomicEffects, atomicEffects)
      || withdrawal.physicalDeletionMode !== "ASYNCHRONOUS" || withdrawal.unfinishedDeletionShownAsComplete !== false) return true;
    if (validIdentities(identities) && (withdrawal.participantLineageId !== identities.participantLineageId || withdrawal.deletionCaseId !== identities.deletionCaseId)) return true;
  }
  const deletion = journey.deletion;
  if (exactKeys(deletion, deletionKeys)) {
    if (!nonBlank(deletion.deletionCaseId) || !nonBlank(deletion.statusVersionId) || !["DELETE", "IRREVERSIBLY_DELINK"].includes(deletion.derivedTreatment)) return true;
    if (nonBlank(evidence.deletionStatusVersionId) && deletion.statusVersionId !== evidence.deletionStatusVersionId) return true;
    if (validIdentities(identities) && deletion.deletionCaseId !== identities.deletionCaseId) return true;
    if (exactKeys(deletion.deadlines, ["acknowledgementDays", "activeStoresDays", "backupAgeOutDays"])
      && (deletion.deadlines.acknowledgementDays !== 7 || deletion.deadlines.activeStoresDays !== 30 || deletion.deadlines.backupAgeOutDays !== 35)) return true;
    if (Array.isArray(deletion.statuses) && deletion.statuses.every((status) => exactKeys(status, deletionStatusKeys))
      && (deletion.statuses.length !== deletionStatuses.length || deletion.statuses.some((status, index) => !validDeletionStatus(status, deletionStatuses[index])))) return true;
  }
  if (Array.isArray(journey.errorFlows)) {
    for (const error of journey.errorFlows) {
      if (exactKeys(error, errorKeys) && (!errorCases.includes(error.errorCase) || error.sensitiveEchoAbsent !== true
        || error.partialStateMutation !== false || error.focusPreservedOrRepaired !== true || error.retryRecovered !== true)) return true;
    }
  }
  return false;
}

function aggregateSemanticFailure(row) {
  if (!isRecord(row) || !Array.isArray(row.journeys) || row.journeys.length !== 2 || !row.journeys.every(isRecord)) return false;
  const journeys = row.journeys;
  if (journeys.every((journey) => nonBlank(journey.journeyId)) && new Set(journeys.map((journey) => journey.journeyId.trim())).size !== 2) return true;
  if (journeys.every((journey) => validIdentities(journey.identities))
    && identityKeys.some((key) => new Set(journeys.map((journey) => journey.identities[key].trim())).size !== 2)) return true;
  if (journeys.every((journey) => exactKeys(journey.correction, correctionKeys) && ["VOID", "CONTENT_WITHDRAWN"].includes(journey.correction.status))
    && !exactArray(journeys.map((journey) => journey.correction.status).sort(), ["CONTENT_WITHDRAWN", "VOID"])) return true;
  if (journeys.every((journey) => exactKeys(journey.deletion, deletionKeys) && ["DELETE", "IRREVERSIBLY_DELINK"].includes(journey.deletion.derivedTreatment))
    && !exactArray(journeys.map((journey) => journey.deletion.derivedTreatment).sort(), ["DELETE", "IRREVERSIBLY_DELINK"])) return true;
  const errors = journeys.flatMap((journey) => Array.isArray(journey.errorFlows) ? journey.errorFlows : []);
  if (journeys.every((journey) => Array.isArray(journey.errorFlows)) && errors.every((error) => exactKeys(error, errorKeys))) {
    if (!exactArray(errors.map((error) => error.errorCase).sort(), [...errorCases].sort())) return true;
  }
  return false;
}

function measuredFailure(value) {
  if (containsForbiddenKey(value) || explicitFalseCheck(value)) return true;
  if (allJourneys(value).some((journey) => exactSemanticFailure(journey, value))) return true;
  if (allRows(value).some(aggregateSemanticFailure)) return true;
  return (Array.isArray(value.noJavaScriptFlows) ? value.noJavaScriptFlows : []).some((row) => isRecord(row)
    && (row.accessibleExplanation === false || row.partialGameControlCount > 0 || row.privacyControlCount > 0 || row.credentialInputCount > 0));
}

function complete(value) {
  return exactKeys(value, topKeys) && value.flow === "privacy" && nonBlank(value.authorityDomainId)
    && [value.supportMatrixId, value.flowVersionId, value.rendererVersionId, value.eventSchemaVersionId, value.correctionNoticeVersionId, value.deletionStatusVersionId].every(nonBlank)
    && validFrozenVersions(value.frozenVersions) && validBrowserFlows(value.browserFlows, value)
    && validAtFlows(value.assistiveTechnologyFlows, value) && validNoJavaScript(value.noJavaScriptFlows, value.frozenVersions)
    && validReview(value.review);
}

export function evaluatePrivacyAccessibilityEvidence(value, authority) {
  if (!isRecord(value) || value.kind !== "OPERATIONAL_MEASURED") return INDETERMINATE;
  if (!isRecord(authority) || !nonBlank(authority.trustDomainId) || typeof authority.verifyEvidence !== "function" || typeof authority.verifyReview !== "function"
    || value.authorityDomainId !== authority.trustDomainId || !safeVerify(authority.verifyEvidence, value) || !safeVerify(authority.verifyReview, value.review, value)) return INDETERMINATE;
  if (measuredFailure(value)) return FAIL;
  return complete(value) ? PASS : INDETERMINATE;
}
