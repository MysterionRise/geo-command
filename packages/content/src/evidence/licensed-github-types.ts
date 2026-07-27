import type { CommonEvidenceRecord } from "./common-evidence";

export type AcquisitionPurpose =
  | "LANGUAGE_CANDIDATE"
  | "RECORDED_AGENT_PARTICIPATION_CANDIDATE";

export type RecordedMarkerEvidence = Readonly<{
  status: "accepted";
  attributionMarkerPolicyVersion: string;
  attributionMarkerPolicyHash: string;
  classification: "NAMED_MODEL_RECORDED" | "AGENT_RECORDED";
  recordedModelName: string | null;
  policyRule: string;
  commitAuthor: string;
  committer: string;
  signatureVerificationResult: string;
  commitMessageHash: string;
  parsedMarker: string;
  vendorSessionReference: string | null;
}>;

export type LanguageMarkerDecision = Readonly<{
  status: "language-only-not-applicable";
  attributionMarkerPolicyVersion: string;
  attributionMarkerPolicyHash: string;
  decision: string;
}>;

export interface LicensedGitHubEvidenceRecord extends CommonEvidenceRecord {
  readonly sourceClass: "licensed-github";
  readonly repository: Readonly<{ owner: string; name: string; immutableId: string }>;
  readonly revision: Readonly<{
    childCommitSha: string; parentCommitSha: string; childTreeSha: string;
    parentTreeSha: string; approvedSubtree: string; path: string;
    childBlobSha: string; parentBlobSha: string; sourceUrl: string; commitUrl: string;
    childRawSha256: string; parentRawSha256: string;
    childNormalizedSha256: string; parentNormalizedSha256: string;
  }>;
  readonly acquisition: Readonly<{
    purpose: AcquisitionPurpose; observationTime: string; authoritativeReceiptTime: string;
    repositoryMetadataSnapshotHash: string; checkpointHash: string;
    draftIdentifier: string; draftHash: string;
  }>;
  readonly license: Readonly<{
    identifier: string; filePath: string; blobSha: string; textHash: string;
    repositoryAdmissionPolicyVersion: string; repositoryAdmissionPolicyHash: string;
  }>;
  readonly marker: RecordedMarkerEvidence | LanguageMarkerDecision;
  readonly screeningOutcomes: readonly Readonly<{ screen: string; result: string }>[];
  readonly storage: Readonly<{
    rawSnapshotIdentifiers: readonly string[];
    retentionDeadline: string;
  }>;
  readonly rights: Readonly<{
    fileCoverageDecision: string; noticeDecision: string;
    redistributionDecision: string; attributionTimingDecision: string;
    embeddedThirdPartyVendorAssessment: string;
    presentationDesignApproval: string;
  }>;
  readonly lineage: Readonly<{
    reviewLineage: string;
    promotionIdentifier: string;
    catalogueApprovalHash: string;
  }>;
  readonly policyAuthorization: Readonly<{
    approvedPolicyRegisterVersion: string; approvedPolicyRegisterHash: string;
    authorizingEntryIdentifiers: readonly string[];
  }>;
  readonly operatorAuthorization: Readonly<{
    registerVersion: string; registerHash: string; entryIdentifier: string;
  }>;
}
