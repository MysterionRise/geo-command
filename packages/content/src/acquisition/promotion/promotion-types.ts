import type {
  LicensedGitHubEvidenceRecord,
} from "../../evidence/records";

export type PromotionMode = "language" | "provenance";
export type PromotionCandidate = Readonly<{
  candidateId: string;
  label: string;
}>;
export type PromotionClue = Readonly<{
  order: 1 | 2;
  label: string;
}>;
export type PromotionVersions = Readonly<{
  candidateSet: string;
  clueSet: string;
  scoring: string;
  rules: string;
  renderer: string;
  reveal: string;
  modeContract: string;
  calibration: string;
  sourceRegime: string;
}>;
export type CatalogueApproval = Readonly<{
  promotionIdentifier: string;
  mode: PromotionMode;
  roundId: string;
  roundVersionId: string;
  prompt: string;
  candidates: readonly PromotionCandidate[];
  correctCandidateId: string;
  clues: readonly PromotionClue[];
  approvedEvidence: string;
  helpfulSignals: readonly string[];
  misleadingSignals: readonly string[];
  versions: PromotionVersions;
}>;
export type PromotionReceipt = Readonly<{
  status: "PROMOTED_H001";
  promotionIdentifier: string;
  mode: PromotionMode;
  sourceClass: "licensed-github";
  purpose: LicensedGitHubEvidenceRecord["acquisition"]["purpose"];
  draftHash: string;
  catalogueHash: string;
  roundId: string;
  roundVersionId: string;
  contentStableId: string;
  contentHash: string;
  contentVersionId: string;
  evidenceVersionId: string;
}>;
export type PromotedH001Record = Readonly<{
  status: "PROMOTED_H001";
  mode: PromotionMode;
  sourceClass: "licensed-github";
  purpose: LicensedGitHubEvidenceRecord["acquisition"]["purpose"];
  promotionIdentifier: string;
  promotionReceipt: PromotionReceipt;
  content: Readonly<{
    stableId: string; hash: string; versionId: string; excerpt: string;
  }>;
  round: Readonly<{
    roundId: string; roundVersionId: string; prompt: string;
    candidates: readonly PromotionCandidate[]; correctCandidateId: string;
    clues: readonly PromotionClue[]; versions: PromotionVersions;
  }>;
  reveal: Readonly<{
    evidence: string; attribution: string; sourceIdentity: string; sourceUrl: string;
    helpfulSignals: readonly string[]; misleadingSignals: readonly string[];
    versions: Readonly<{
      content: string; evidence: string; candidateSet: string;
      scoring: string; rules: string; reveal: string;
    }>;
  }>;
  provenance: Readonly<{
    classification: "NAMED_MODEL_RECORDED" | "AGENT_RECORDED";
    recordedModelName: string | null;
    publicClaim: string;
  }> | null;
}>;
