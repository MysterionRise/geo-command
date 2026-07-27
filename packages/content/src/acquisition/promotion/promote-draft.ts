import { createHash } from "node:crypto";

import {
  createAcquisitionDraft,
  type AcquisitionDraft,
} from "../draft/acquisition-draft";
import {
  parseEvidenceRecord,
  type LicensedGitHubEvidenceRecord,
} from "../../evidence/records";
import {
  createPublicationEligibility,
  type PublicationEligibility,
  type PublicationEligibilityInput,
} from "../../review/publication-eligibility";
import type {
  CatalogueApproval,
  PromotedH001Record,
  PromotionClue as Clue,
  PromotionMode as Mode,
  PromotionVersions as Versions,
} from "./promotion-types";
import { PROMOTION_RIGHTS, canonical, deepFreeze } from "./promotion-values";
import { hasPromotionContinuity } from "./promotion-continuity";
import { parsePromotionReceipt } from "./promotion-receipt";
export { parsePromotionReceipt } from "./promotion-receipt";
export type { PromotedH001Record, PromotionReceipt } from "./promotion-types";

export class PromotionRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PromotionRuleError";
  }
}

const fail = (message: string): never => {
  throw new PromotionRuleError(message);
};

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const exact = (
  value: Record<string, unknown>,
  fields: readonly string[],
  field: string,
): void => {
  const actual = Object.keys(value).sort().join("|");
  if (actual !== [...fields].sort().join("|")) fail(`${field} has an invalid shape`);
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be non-blank`);
  }
  return value.trim();
};

const revalidateDraft = (value: AcquisitionDraft): AcquisitionDraft => {
  try {
    const parsed = createAcquisitionDraft(value.input);
    if (canonical(parsed) !== canonical(value)) fail("draft failed immutable revalidation");
    return parsed;
  } catch {
    return fail("draft failed immutable revalidation");
  }
};

const eligibilityInput = (
  value: PublicationEligibility,
): PublicationEligibilityInput => ({
  contentId: value.contentId,
  itemMode: value.itemMode,
  evidenceVersion: value.evidenceVersion,
  defensibleCompetingAnswers: [...value.defensibleCompetingAnswers],
  approvalChecks: { ...value.approvalChecks },
  reviews: value.reviews.map((review) => ({
    ...review,
    qualifications: [...review.qualifications],
  })),
});

const revalidateEligibility = (
  value: PublicationEligibility,
): PublicationEligibility => {
  try {
    const parsed = createPublicationEligibility(eligibilityInput(value));
    if (canonical(parsed) !== canonical(value)) fail("human eligibility revalidation failed");
    return parsed;
  } catch {
    return fail("human eligibility revalidation failed");
  }
};

const revalidateEvidence = (
  value: LicensedGitHubEvidenceRecord,
): LicensedGitHubEvidenceRecord => {
  try {
    const parsed = parseEvidenceRecord(value);
    if (parsed.sourceClass !== "licensed-github" || canonical(parsed) !== canonical(value)) {
      return fail("evidence revalidation failed");
    }
    return parsed;
  } catch {
    return fail("evidence revalidation failed");
  }
};

const validateRights = (evidence: LicensedGitHubEvidenceRecord): void => {
  for (const [field, expected] of Object.entries(PROMOTION_RIGHTS)) {
    if (evidence.rights[field as keyof typeof PROMOTION_RIGHTS] !== expected) {
      fail(`rights.${field} is not approved`);
    }
  }
};

const validateContinuity = (
  draft: AcquisitionDraft,
  evidence: LicensedGitHubEvidenceRecord,
  eligibility: PublicationEligibility,
  catalogue: CatalogueApproval,
): void => {
  if (!hasPromotionContinuity(draft, evidence, eligibility, catalogue)) {
    fail("promotion binding drift");
  }
  const identities = eligibility.reviews.map(({ reviewerId }) => reviewerId);
  const dates = eligibility.reviews.map(({ reviewDate }) => reviewDate);
  if (
    identities.join("|") !== evidence.reviewerIdentities.join("|")
    || dates.join("|") !== evidence.reviewerDates.join("|")
    || evidence.eligibilityDecision !== "eligible"
    || evidence.publicationStatus !== "ELIGIBLE"
    || evidence.correctionState !== "ACTIVE"
  ) fail("review or active-state binding drift");
  const hash = createHash("sha256").update(evidence.excerpt).digest("hex");
  if (hash !== evidence.contentHash) fail("content hash binding drift");
};

const VERSION_FIELDS = [
  "candidateSet", "clueSet", "scoring", "rules", "renderer", "reveal",
  "modeContract", "calibration", "sourceRegime",
] as const;

const parseCatalogue = (value: unknown): CatalogueApproval => {
  const input = record(value, "catalogue");
  exact(input, [
    "promotionIdentifier", "mode", "roundId", "roundVersionId", "prompt",
    "candidates", "correctCandidateId", "clues", "approvedEvidence",
    "helpfulSignals", "misleadingSignals", "versions",
  ], "catalogue");
  const mode = input.mode;
  if (mode !== "language" && mode !== "provenance") fail("catalogue.mode is invalid");
  if (!Array.isArray(input.candidates) || input.candidates.length < 2) {
    fail("catalogue.candidates must contain at least two entries");
  }
  const candidateInputs = input.candidates as unknown[];
  const candidates = candidateInputs.map((value: unknown, index: number) => {
    const candidate = record(value, `candidate[${index}]`);
    exact(candidate, ["candidateId", "label"], `candidate[${index}]`);
    return Object.freeze({
      candidateId: text(candidate.candidateId, "candidateId"),
      label: text(candidate.label, "candidate label"),
    });
  });
  const correctCandidateId = text(input.correctCandidateId, "correctCandidateId");
  if (!candidates.some(({ candidateId }) => candidateId === correctCandidateId)
    || new Set(candidates.map(({ candidateId }) => candidateId)).size !== candidates.length) {
    fail("catalogue candidate binding is invalid");
  }
  const clues = parseClues(input.clues);
  const versions = record(input.versions, "catalogue.versions");
  exact(versions, VERSION_FIELDS, "catalogue.versions");
  const stringList = (field: "helpfulSignals" | "misleadingSignals"): readonly string[] => {
    if (!Array.isArray(input[field])) fail(`${field} must be an array`);
    const values = input[field] as unknown[];
    return Object.freeze(values.map((entry: unknown, index: number) =>
      text(entry, `${field}[${index}]`)));
  };
  return deepFreeze({
    promotionIdentifier: text(input.promotionIdentifier, "promotionIdentifier"),
    mode: mode as Mode, roundId: text(input.roundId, "roundId"),
    roundVersionId: text(input.roundVersionId, "roundVersionId"),
    prompt: text(input.prompt, "prompt"), candidates: Object.freeze(candidates),
    correctCandidateId, clues,
    approvedEvidence: text(input.approvedEvidence, "approvedEvidence"),
    helpfulSignals: stringList("helpfulSignals"),
    misleadingSignals: stringList("misleadingSignals"),
    versions: Object.freeze(Object.fromEntries(VERSION_FIELDS.map((field) => [
      field, text(versions[field], `versions.${field}`),
    ]))) as Versions,
  });
};

const parseClues = (value: unknown): readonly Clue[] => {
  if (!Array.isArray(value) || value.length > 2) fail("catalogue.clues are invalid");
  const entries = value as unknown[];
  return Object.freeze(entries.map((entry: unknown, index: number) => {
    const clue = record(entry, `clue[${index}]`);
    exact(clue, ["order", "label"], `clue[${index}]`);
    if (clue.order !== index + 1) fail("catalogue.clue order is invalid");
    return Object.freeze({
      order: clue.order as 1 | 2,
      label: text(clue.label, `clue[${index}].label`),
    });
  }));
};

const provenance = (
  evidence: LicensedGitHubEvidenceRecord,
  mode: Mode,
): PromotedH001Record["provenance"] => {
  if (mode === "language") {
    if (evidence.acquisition.purpose !== "LANGUAGE_CANDIDATE"
      || evidence.marker.status !== "language-only-not-applicable") {
      return fail("language purpose or marker binding is invalid");
    }
    return null;
  }
  if (evidence.acquisition.purpose !== "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
    || evidence.marker.status !== "accepted") {
    return fail("provenance purpose or marker binding is invalid");
  }
  const named = evidence.marker.classification === "NAMED_MODEL_RECORDED";
  const publicClaim = named
    ? text(evidence.marker.recordedModelName, "recorded model name")
    : "AI coding agent";
  return Object.freeze({
    classification: evidence.marker.classification,
    recordedModelName: evidence.marker.recordedModelName,
    publicClaim,
  });
};

export function promoteAcquisitionDraft(value: unknown): PromotedH001Record {
  const root = record(value, "promotion input");
  exact(root, ["draft", "evidence", "publicationEligibility", "catalogue"], "promotion input");
  const draft = revalidateDraft(root.draft as AcquisitionDraft);
  const evidence = revalidateEvidence(root.evidence as LicensedGitHubEvidenceRecord);
  const eligibility = revalidateEligibility(root.publicationEligibility as PublicationEligibility);
  const catalogue = parseCatalogue(root.catalogue);
  validateRights(evidence);
  validateContinuity(draft, evidence, eligibility, catalogue);
  const provenanceRecord = provenance(evidence, catalogue.mode);
  return deepFreeze({
    status: "PROMOTED_H001",
    mode: catalogue.mode,
    sourceClass: "licensed-github",
    purpose: evidence.acquisition.purpose,
    promotionIdentifier: catalogue.promotionIdentifier,
    promotionReceipt: parsePromotionReceipt({
      status: "PROMOTED_H001",
      promotionIdentifier: catalogue.promotionIdentifier,
      mode: catalogue.mode,
      sourceClass: "licensed-github",
      purpose: evidence.acquisition.purpose,
      draftHash: draft.draftHash,
      catalogueHash: evidence.lineage.catalogueApprovalHash,
      roundId: catalogue.roundId,
      roundVersionId: catalogue.roundVersionId,
      contentStableId: evidence.stableId,
      contentHash: evidence.contentHash,
      contentVersionId: evidence.evidenceReference.artifactId,
      evidenceVersionId: evidence.evidenceReference.versionId,
    }),
    content: {
      stableId: evidence.stableId, hash: evidence.contentHash,
      versionId: evidence.evidenceReference.artifactId, excerpt: evidence.excerpt,
    },
    round: {
      roundId: catalogue.roundId, roundVersionId: catalogue.roundVersionId,
      prompt: catalogue.prompt, candidates: catalogue.candidates,
      correctCandidateId: catalogue.correctCandidateId, clues: catalogue.clues,
      versions: catalogue.versions,
    },
    reveal: {
      evidence: catalogue.approvedEvidence,
      attribution: evidence.attributionOrDisclosureText,
      sourceIdentity: `${evidence.repository.owner}/${evidence.repository.name}`,
      sourceUrl: evidence.revision.sourceUrl,
      helpfulSignals: catalogue.helpfulSignals,
      misleadingSignals: catalogue.misleadingSignals,
      versions: {
        content: evidence.contentHash,
        evidence: evidence.evidenceReference.versionId,
        candidateSet: catalogue.versions.candidateSet,
        scoring: catalogue.versions.scoring,
        rules: catalogue.versions.rules,
        reveal: catalogue.versions.reveal,
      },
    },
    provenance: provenanceRecord,
  });
}
