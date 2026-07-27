import { createHash } from "node:crypto";

import type { AcquisitionDraft } from "../draft/acquisition-draft";
import type { LicensedGitHubEvidenceRecord } from "../../evidence/records";
import type { PublicationEligibility } from "../../review/publication-eligibility";
import type { CatalogueApproval } from "./promotion-types";
import { canonical } from "./promotion-values";

const listEqual = (
  left: readonly unknown[],
  right: readonly unknown[],
): boolean => left.length === right.length
  && left.every((value, index) => value === right[index]);

const textRecord = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const modeDraftContinuity = (
  draft: AcquisitionDraft,
  evidence: LicensedGitHubEvidenceRecord,
  catalogue: CatalogueApproval,
): boolean => {
  if (catalogue.mode === "language") {
    const proposal = textRecord(draft.input.languageProposal);
    const answer = catalogue.candidates.find(
      ({ candidateId }) => candidateId === catalogue.correctCandidateId,
    );
    return proposal.proposedLanguage === answer?.label
      && sha256(evidence.excerpt) === evidence.revision.childNormalizedSha256;
  }
  const diff = textRecord(draft.input.diff);
  const startLine = diff.startLine as number;
  const endLine = diff.endLine as number;
  const lineNumbers = diff.changedLineNumbers as readonly number[];
  const excerptLines = evidence.excerpt.split("\n");
  if (excerptLines.length !== endLine - startLine + 1) return false;
  const changedLines = lineNumbers.map((line) => excerptLines[line - startLine]);
  if (changedLines.some((line) => line === undefined)) return false;
  return diff.excerptHash === sha256(evidence.excerpt)
    && diff.changedLinesHash === sha256(changedLines.join("\n"));
};

const markerContinuity = (
  draft: AcquisitionDraft,
  evidence: LicensedGitHubEvidenceRecord,
): boolean => {
  const attribution = textRecord(draft.input.attribution);
  const draftMarker = textRecord(attribution.evidence);
  if (
    attribution.policyVersion !== evidence.marker.attributionMarkerPolicyVersion
    || attribution.policyHash !== evidence.marker.attributionMarkerPolicyHash
  ) return false;
  if (evidence.marker.status === "language-only-not-applicable") {
    return draftMarker.kind === "LANGUAGE_ONLY_NOT_APPLICABLE";
  }
  const author = textRecord(draftMarker.author);
  const committer = textRecord(draftMarker.committer);
  const verification = textRecord(draftMarker.verification);
  const modelName = draftMarker.kind === "NAMED_MODEL_RECORDED"
    ? draftMarker.modelName
    : null;
  return draftMarker.kind === evidence.marker.classification
    && draftMarker.classification === evidence.marker.classification
    && modelName === evidence.marker.recordedModelName
    && draftMarker.ruleId === evidence.marker.policyRule
    && author.name === evidence.marker.commitAuthor
    && committer.name === evidence.marker.committer
    && verification.reason === evidence.marker.signatureVerificationResult
    && draftMarker.commitMessageHash === evidence.marker.commitMessageHash
    && draftMarker.parsedMarker === evidence.marker.parsedMarker
    && (draftMarker.vendorSessionDecision === "NOT_APPLICABLE"
      ? evidence.marker.vendorSessionReference === null
      : evidence.marker.vendorSessionReference !== null);
};

export const hasPromotionContinuity = (
  draft: AcquisitionDraft,
  evidence: LicensedGitHubEvidenceRecord,
  eligibility: PublicationEligibility,
  catalogue: CatalogueApproval,
): boolean => {
  const source = textRecord(draft.input.source);
  const acquisition = textRecord(draft.input.acquisition);
  const license = textRecord(draft.input.license);
  const policy = textRecord(draft.input.policy);
  const operator = textRecord(draft.input.operator);
  const revision = evidence.revision;
  const screening = evidence.screeningOutcomes;
  const expectedScreens = acquisition.screeningOutcomes as readonly unknown[];
  return evidence.acquisition.draftIdentifier === draft.draftId
    && evidence.acquisition.draftHash === draft.draftHash
    && evidence.stableId === eligibility.contentId
    && evidence.evidenceReference.versionId === eligibility.evidenceVersion
    && eligibility.itemMode === catalogue.mode
    && evidence.lineage.promotionIdentifier === catalogue.promotionIdentifier
    && evidence.lineage.catalogueApprovalHash === sha256(canonical(catalogue))
    && evidence.acquisition.purpose === acquisition.purpose
    && evidence.acquisition.observationTime === acquisition.observationTime
    && evidence.acquisition.authoritativeReceiptTime === acquisition.receiptTime
    && evidence.acquisition.repositoryMetadataSnapshotHash
      === source.repositoryMetadataHash
    && evidence.acquisition.checkpointHash === acquisition.checkpointHash
    && evidence.repository.immutableId === source.repositoryId
    && `${evidence.repository.owner}/${evidence.repository.name}` === source.repository
    && revision.childCommitSha === source.childCommit
    && revision.parentCommitSha === source.parentCommit
    && revision.childTreeSha === source.childTree
    && revision.parentTreeSha === source.parentTree
    && revision.approvedSubtree === source.subtree
    && revision.path === source.path
    && revision.childBlobSha === source.childBlob
    && revision.parentBlobSha === source.parentBlob
    && revision.sourceUrl === source.sourceUrl
    && revision.commitUrl === source.commitUrl
    && revision.childRawSha256 === source.childRawHash
    && revision.parentRawSha256 === source.parentRawHash
    && revision.childNormalizedSha256 === source.childNormalizedHash
    && revision.parentNormalizedSha256 === source.parentNormalizedHash
    && evidence.license.identifier === license.identifier
    && evidence.license.filePath === license.path
    && evidence.license.blobSha === license.blobSha
    && evidence.license.textHash === license.textHash
    && evidence.license.repositoryAdmissionPolicyVersion
      === license.repositoryPolicyVersion
    && evidence.license.repositoryAdmissionPolicyHash === license.repositoryPolicyHash
    && listEqual(evidence.storage.rawSnapshotIdentifiers,
      acquisition.snapshotIds as readonly unknown[])
    && evidence.storage.retentionDeadline === acquisition.retentionDeadline
    && listEqual(screening.map(({ screen }) => screen), expectedScreens)
    && screening.every(({ result }) => result === "passed")
    && evidence.policyAuthorization.approvedPolicyRegisterVersion
      === policy.registerVersion
    && evidence.policyAuthorization.approvedPolicyRegisterHash === policy.registerHash
    && listEqual(evidence.policyAuthorization.authorizingEntryIdentifiers, [
      policy.repositoryEntryId,
      policy.attributionEntryId,
    ])
    && evidence.operatorAuthorization.registerVersion === operator.registerVersion
    && evidence.operatorAuthorization.registerHash === operator.registerHash
    && evidence.operatorAuthorization.entryIdentifier === operator.entryId
    && markerContinuity(draft, evidence)
    && modeDraftContinuity(draft, evidence, catalogue);
};
