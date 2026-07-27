import type {
  PromotedH001Record,
} from "../../../../../../packages/content/src/index.js";

export type NegativeEvidence = Readonly<{
  classification: "PROJECT_CONTROLLED_HUMAN_ONLY";
  recordedModelName: null;
  publicClaim: string;
  creationOrCommissionBasis: string;
  recordedProjectAuthorization: string;
  noAgentParticipationAttestation: string;
}>;
export type ProvenanceHandoff = Omit<
  PromotedH001Record,
  "sourceClass" | "purpose" | "provenance" | "reveal" | "promotionReceipt"
> & Readonly<{
  sourceClass: "licensed-github" | "project-owned-human";
  purpose:
    | "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
    | "PROJECT_CONTROLLED_HUMAN_ONLY";
  provenance: PromotedH001Record["provenance"] | NegativeEvidence;
  promotionReceipt: PromotedH001Record["promotionReceipt"] | null;
  reveal: Omit<PromotedH001Record["reveal"], "sourceUrl"> & Readonly<{
    sourceUrl: string | null;
  }>;
}>;
export type ProvenanceCatalogueEntry = Readonly<{
  status: "APPROVED_PROVENANCE_CATALOGUE_ENTRY";
  publicRound: Readonly<{
    roundId: string;
    roundVersionId: string;
    excerpt: Readonly<{ versionId: string; text: string }>;
    mode: Readonly<{
      kind: "provenance";
      contractVersionId: string;
      calibrationVersionId: string;
      prompt: string;
      candidates: readonly Readonly<{ candidateId: string; label: string }>[];
      clues: readonly Readonly<{ order: 1 | 2; label: string }>[];
    }>;
    versions: Readonly<{
      candidateSet: string; clueSet: string; scoring: string; rules: string;
    }>;
  }>;
  serverReveal: Readonly<{
    correctCandidateId:
      | "RECORDED_AGENT_PARTICIPATION"
      | "PROJECT_CONTROLLED_HUMAN_ONLY";
    classification:
      | "NAMED_MODEL_RECORDED"
      | "AGENT_RECORDED"
      | "PROJECT_CONTROLLED_HUMAN_ONLY";
    recordedModelName: string | null;
    publicClaim: string;
    evidence: string;
    attribution: string;
    sourceIdentity: string;
    sourceUrl: string | null;
    helpfulSignals: readonly string[];
    misleadingSignals: readonly string[];
    versions: Readonly<{
      content: string; evidence: string; candidateSet: string;
      scoring: string; rules: string; reveal: string;
    }>;
  }>;
  bindings: Readonly<{
    promotionIdentifier: string; contentStableId: string; contentVersionId: string;
    contentHash: string; evidenceVersionId: string; rendererVersionId: string;
    revealVersionId: string; sourceRegimeVersionId: string; catalogueHash: string;
  }>;
}>;
