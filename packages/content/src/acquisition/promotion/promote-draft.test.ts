import { createHash } from "node:crypto";

import { createAcquisitionDraft } from "../draft/acquisition-draft";
import {
  parseEvidenceRecord,
  type LicensedGitHubEvidenceRecord,
} from "../../evidence/records";
import { createPublicationEligibility } from "../../review/publication-eligibility";
import {
  PromotionRuleError,
  parsePromotionReceipt,
  promoteAcquisitionDraft,
} from "./promote-draft";

interface Expectation {
  readonly not: Expectation;
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatch(expected: RegExp): void;
  toThrow(expected?: unknown): void;
}
interface TestApi {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): Expectation;
  it(name: string, callback: () => unknown): void;
}
const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as TestApi;
const publicContent = await import("../../index") as Record<string, unknown>;

const h40 = (character: string): string => character.repeat(40);
const h64 = (character: string): string => character.repeat(64);
const excerpt = "export const answer: number = 42;";
const excerptHash = createHash("sha256").update(excerpt).digest("hex");
const canonicalValue = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) =>
      `${JSON.stringify(key)}:${canonicalValue(nested)}`).join(",")}}`;
};
const catalogueHash = (mode: "language" | "provenance"): string =>
  createHash("sha256").update(canonicalValue(catalogue(mode))).digest("hex");

function draft(purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE" = "LANGUAGE_CANDIDATE") {
  const provenance = purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE";
  return createAcquisitionDraft({
    run: {
      draftIdempotencyKey: h64("a"), toolId: "acquirer", toolVersion: "1",
      toolHash: h64("b"), schemaVersion: "draft-v1", schemaHash: h64("c"),
    },
    source: {
      repository: "owner/repo", repositoryId: "R_1", childCommit: h40("1"),
      parentCommit: h40("2"), childTree: h40("3"), parentTree: h40("4"),
      subtree: "src", path: "src/code.ts", childBlob: h40("5"),
      parentBlob: h40("6"),
      sourceUrl: `https://github.com/owner/repo/blob/${h40("1")}/src/code.ts`,
      commitUrl: `https://github.com/owner/repo/commit/${h40("1")}`,
      parentRawHash: h64("d"), childRawHash: h64("e"),
      parentNormalizedHash: h64("f"),
      childNormalizedHash: provenance ? h64("0") : excerptHash,
      repositoryMetadataHash: h64("9"),
    },
    acquisition: {
      purpose, observationTime: "2026-07-27T15:00:00Z",
      receiptTime: "2026-07-27T15:00:01Z", checkpointHash: h64("8"),
      screeningOutcomes: ["SAFE_TEXT"], snapshotIds: ["snapshot-1"],
      retentionDeadline: "2026-08-26T15:00:01Z",
    },
    license: {
      identifier: "MIT", path: "LICENSE", blobSha: h40("7"), textHash: h64("7"),
      repositoryPolicyVersion: "repo-v1", repositoryPolicyHash: h64("6"),
    },
    attribution: {
      policyVersion: "markers-v1", policyHash: h64("5"),
      evidence: provenance
        ? {
            kind: "AGENT_RECORDED", classification: "AGENT_RECORDED",
            evidenceHash: h64("4"), commitMessageHash: h64("3"),
            ruleId: "generic-agent", ruleBindingHash: h64("2"),
            publicPhrase: "AI coding agent",
            author: { name: "Developer", login: "developer" },
            committer: { name: "Developer", login: "developer" },
            verification: { verified: true, reason: "valid" },
            parsedMarker: "Co-authored-by: Example Agent",
            vendorSessionDecision: "NOT_APPLICABLE",
          }
        : { kind: "LANGUAGE_ONLY_NOT_APPLICABLE" },
    },
    policy: {
      registerVersion: "policies-v1", registerHash: h64("1"),
      repositoryEntryId: "repo-entry", attributionEntryId: "marker-entry",
    },
    operator: {
      name: "Operator", osIdentity: "uid:1000", registerVersion: "operators-v1",
      registerHash: h64("a"), entryId: "operator-entry",
    },
    diff: provenance
      ? {
          algorithmVersion: "line-sequence-v1", startLine: 1, endLine: 1,
          excerptHash, parentBlob: h40("6"), childBlob: h40("5"),
          parentNormalizedHash: h64("f"), childNormalizedHash: h64("0"),
          changedLineNumbers: [1], changedLinesHash: excerptHash,
        }
      : null,
    languageProposal: provenance
      ? null
      : {
          proposedLanguage: "TypeScript", detectorVersion: "proposal-v1",
          proposalHash: h64("4"), decision: "HUMAN_REVIEW_REQUIRED",
        },
  });
}

function evidence(
  purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE" =
    "LANGUAGE_CANDIDATE",
): LicensedGitHubEvidenceRecord {
  const sourceDraft = draft(purpose);
  const recorded = purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE";
  const parsed = parseEvidenceRecord({
    stableId: "content-1", sourceClass: "licensed-github", contentHash: excerptHash,
    excerpt, acquisitionMethod: "bounded GitHub API", acquisitionDate: "2026-07-27",
    evidenceReference: { artifactId: "content-version-1", versionId: "evidence-v1" },
    creatorOrSourceIdentity: "owner/repo",
    ownershipLicenseAuthorizationBasis: "approved file-level MIT review",
    reviewerIdentities: ["editor", "technical-a", "technical-b", "rights"],
    reviewerDates: ["2026-07-28", "2026-07-28", "2026-07-28", "2026-07-28"],
    eligibilityDecision: "eligible", attributionOrDisclosureText: "owner/repo, MIT",
    correctionState: "ACTIVE", publicationStatus: "ELIGIBLE",
    repository: { owner: "owner", name: "repo", immutableId: "R_1" },
    revision: {
      childCommitSha: h40("1"), parentCommitSha: h40("2"),
      childTreeSha: h40("3"), parentTreeSha: h40("4"), approvedSubtree: "src",
      path: "src/code.ts", childBlobSha: h40("5"), parentBlobSha: h40("6"),
      sourceUrl: `https://github.com/owner/repo/blob/${h40("1")}/src/code.ts`,
      commitUrl: `https://github.com/owner/repo/commit/${h40("1")}`,
      childRawSha256: h64("e"), parentRawSha256: h64("d"),
      childNormalizedSha256: recorded ? h64("0") : excerptHash,
      parentNormalizedSha256: h64("f"),
    },
    acquisition: {
      purpose, observationTime: "2026-07-27T15:00:00Z",
      authoritativeReceiptTime: "2026-07-27T15:00:01Z",
      repositoryMetadataSnapshotHash: h64("9"), checkpointHash: h64("8"),
      draftIdentifier: sourceDraft.draftId, draftHash: sourceDraft.draftHash,
    },
    license: {
      identifier: "MIT", filePath: "LICENSE", blobSha: h40("7"),
      textHash: h64("7"), repositoryAdmissionPolicyVersion: "repo-v1",
      repositoryAdmissionPolicyHash: h64("6"),
    },
    marker: recorded
      ? {
          status: "accepted", attributionMarkerPolicyVersion: "markers-v1",
          attributionMarkerPolicyHash: h64("5"), classification: "AGENT_RECORDED",
          recordedModelName: null, policyRule: "generic-agent",
          commitAuthor: "Developer", committer: "Developer",
          signatureVerificationResult: "valid", commitMessageHash: h64("3"),
          parsedMarker: "Co-authored-by: Example Agent", vendorSessionReference: null,
        }
      : {
          status: "language-only-not-applicable",
          attributionMarkerPolicyVersion: "markers-v1",
          attributionMarkerPolicyHash: h64("5"),
          decision: "language marker evidence is not applicable",
        },
    screeningOutcomes: [{ screen: "SAFE_TEXT", result: "passed" }],
    storage: {
      rawSnapshotIdentifiers: ["snapshot-1"],
      retentionDeadline: "2026-08-26T15:00:01Z",
    },
    rights: {
      fileCoverageDecision: "APPROVED_FILE_COVERAGE",
      noticeDecision: "APPROVED_NOTICE",
      redistributionDecision: "APPROVED_EXCERPT_REDISTRIBUTION",
      attributionTimingDecision: "APPROVED_REVEAL_ONLY",
      embeddedThirdPartyVendorAssessment:
        "APPROVED_NO_UNRESOLVED_EMBEDDED_THIRD_PARTY_VENDOR_MATERIAL",
      presentationDesignApproval:
        "APPROVED_DELAYED_ATTRIBUTION_PRESENTATION",
    },
    lineage: {
      reviewLineage: "review-lineage-1",
      promotionIdentifier: "promotion-1",
      catalogueApprovalHash: catalogueHash(
        purpose === "LANGUAGE_CANDIDATE" ? "language" : "provenance",
      ),
    },
    policyAuthorization: {
      approvedPolicyRegisterVersion: "policies-v1",
      approvedPolicyRegisterHash: h64("1"),
      authorizingEntryIdentifiers: ["repo-entry", "marker-entry"],
    },
    operatorAuthorization: {
      registerVersion: "operators-v1", registerHash: h64("a"),
      entryIdentifier: "operator-entry",
    },
  });
  if (parsed.sourceClass !== "licensed-github") throw new Error("invalid test fixture");
  return parsed;
}

function eligibility(mode: "language" | "provenance") {
  return createPublicationEligibility({
    contentId: "content-1", itemMode: mode, evidenceVersion: "evidence-v1",
    defensibleCompetingAnswers: [],
    approvalChecks: {
      answerIntegrity: true, ambiguity: true, difficulty: true, provenance: true,
      rights: true, attribution: true, secrets: true, personalData: true,
      safety: true, inertRendering: true, accessibility: true,
      evidenceMinimization: true,
    },
    reviews: [
      ["editor", "Editor", "content-editor", ["content-preparation", "evidence-record-training"]],
      ["technical-a", "Technical A", "technical-reviewer-a", [mode]],
      ["technical-b", "Technical B", "technical-reviewer-b", [mode]],
      ["rights", "Rights", "rights-safety-reviewer", ["counsel-status"]],
    ].map(([reviewerId, reviewerName, role, qualifications]) => ({
      reviewerId: reviewerId as string, reviewerName: reviewerName as string,
      role: role as "content-editor" | "technical-reviewer-a" | "technical-reviewer-b" | "rights-safety-reviewer",
      qualifications: qualifications as string[], decision: "approve" as const,
      reviewDate: "2026-07-28", conflictDeclared: false,
      conflictDeclaration: "No conflict", evidenceVersion: "evidence-v1",
    })),
  });
}

function catalogue(mode: "language" | "provenance") {
  return {
    promotionIdentifier: "promotion-1", mode, roundId: `round-${mode}-1`,
    roundVersionId: `round-${mode}-v1`,
    prompt: mode === "language"
      ? "Which language is this?"
      : "Is an AI coding agent durably recorded as participating in this code change?",
    candidates: mode === "language"
      ? [
          { candidateId: "typescript", label: "TypeScript" },
          { candidateId: "javascript", label: "JavaScript" },
        ]
      : [
          { candidateId: "RECORDED_AGENT_PARTICIPATION", label: "RECORDED_AGENT_PARTICIPATION" },
          { candidateId: "PROJECT_CONTROLLED_HUMAN_ONLY", label: "PROJECT_CONTROLLED_HUMAN_ONLY" },
        ],
    correctCandidateId: mode === "language"
      ? "typescript"
      : "RECORDED_AGENT_PARTICIPATION",
    clues: [
      { order: 1, label: "Review the type annotation." },
      { order: 2, label: "The syntax remains JavaScript-compatible." },
    ],
    approvedEvidence: mode === "language"
      ? "Two qualified reviewers approved TypeScript."
      : "The accepted record names an AI coding agent.",
    helpfulSignals: ["A reviewed code signal."],
    misleadingSignals: ["Surface style alone."],
    versions: {
      candidateSet: `candidate-${mode}-v1`, clueSet: `clues-${mode}-v1`,
      scoring: "scoring-v1", rules: "rules-v1", renderer: "renderer-v1",
      reveal: `reveal-${mode}-v1`, modeContract: `contract-${mode}-v1`,
      calibration: `calibration-${mode}-v1`,
      sourceRegime: "licensed-github-vs-project-controlled-v1",
    },
  } as const;
}

function input(mode: "language" | "provenance") {
  const purpose = mode === "language"
    ? "LANGUAGE_CANDIDATE"
    : "RECORDED_AGENT_PARTICIPATION_CANDIDATE";
  return {
    draft: draft(purpose),
    evidence: evidence(purpose),
    publicationEligibility: eligibility(mode),
    catalogue: catalogue(mode),
  };
}

describe("human promotion adapter", () => {
  it("exports promotion only through the normal reviewed content API", () => {
    expect(publicContent.promoteAcquisitionDraft).toBe(promoteAcquisitionDraft);
    expect(publicContent.PromotionRuleError).toBe(PromotionRuleError);
    expect(publicContent.parsePromotionReceipt).toBe(parsePromotionReceipt);
  });

  it("creates a deeply frozen normal H-001 handoff without acquisition internals", () => {
    const promoted = promoteAcquisitionDraft(input("language"));
    expect(promoted.status).toBe("PROMOTED_H001");
    expect(promoted.mode).toBe("language");
    expect(promoted.round.correctCandidateId).toBe("typescript");
    expect(promoted.reveal.attribution).toBe("owner/repo, MIT");
    expect(promoted.promotionReceipt).toEqual({
      status: "PROMOTED_H001",
      promotionIdentifier: "promotion-1",
      mode: "language",
      sourceClass: "licensed-github",
      purpose: "LANGUAGE_CANDIDATE",
      draftHash: input("language").draft.draftHash,
      catalogueHash: catalogueHash("language"),
      roundId: "round-language-1",
      roundVersionId: "round-language-v1",
      contentStableId: "content-1",
      contentHash: excerptHash,
      contentVersionId: "content-version-1",
      evidenceVersionId: "evidence-v1",
    });
    expect(parsePromotionReceipt(promoted.promotionReceipt))
      .toEqual(promoted.promotionReceipt);
    expect(Object.isFrozen(promoted.round.candidates)).toBe(true);
    expect(JSON.stringify({
      ...promoted,
      promotionReceipt: null,
    })).not.toMatch(
      /snapshot|operator|policy|token|rawSha|commitMessage|parsedMarker|draft/iu,
    );
  });

  it("requires the complete distinct four-human approval boundary", () => {
    const value = input("language");
    const mutable = structuredClone(value.publicationEligibility) as unknown as {
      reviews: Array<{ reviewerId: string }>;
    };
    mutable.reviews[2]!.reviewerId = mutable.reviews[1]!.reviewerId;
    expect(() => promoteAcquisitionDraft({
      ...value,
      publicationEligibility: mutable,
    })).toThrow(PromotionRuleError);
  });

  it("rejects pre-guess attribution, conflicting bindings, and mutated drafts", () => {
    const value = input("language");
    expect(() => promoteAcquisitionDraft({
      ...value,
      evidence: {
        ...value.evidence,
        rights: { ...value.evidence.rights, attributionTimingDecision: "REQUIRED_PRE_GUESS" },
      },
    })).toThrow(PromotionRuleError);
    expect(() => promoteAcquisitionDraft({
      ...value,
      evidence: {
        ...value.evidence,
        rights: {
          ...value.evidence.rights,
          embeddedThirdPartyVendorAssessment: "NOT_REVIEWED",
        },
      },
    })).toThrow(PromotionRuleError);
    expect(() => promoteAcquisitionDraft({
      ...value,
      evidence: {
        ...value.evidence,
        rights: {
          ...value.evidence.rights,
          presentationDesignApproval: "NOT_APPROVED",
        },
      },
    })).toThrow(PromotionRuleError);
    expect(() => promoteAcquisitionDraft({
      ...value,
      catalogue: { ...value.catalogue, promotionIdentifier: "other" },
    })).toThrow(PromotionRuleError);
    expect(() => promoteAcquisitionDraft({
      ...value,
      catalogue: { ...value.catalogue, prompt: "Drifted prompt under the same ID" },
    })).toThrow(PromotionRuleError);
    expect(() => promoteAcquisitionDraft({
      ...value,
      draft: { ...value.draft, state: "PROMOTED" },
    })).toThrow(PromotionRuleError);
  });

  it("rejects every draft-to-evidence lineage swap used by promotion", () => {
    const swaps: readonly Readonly<{
      name: string;
      mutate(evidence: Record<string, any>): void;
    }>[] = [
      { name: "child tree", mutate: (item) => { item.revision.childTreeSha = h40("a"); } },
      { name: "parent tree", mutate: (item) => { item.revision.parentTreeSha = h40("b"); } },
      { name: "approved subtree", mutate: (item) => { item.revision.approvedSubtree = "lib"; } },
      { name: "source URL", mutate: (item) => { item.revision.sourceUrl = "https://example.invalid/source"; } },
      { name: "commit URL", mutate: (item) => { item.revision.commitUrl = "https://example.invalid/commit"; } },
      { name: "raw hash", mutate: (item) => { item.revision.childRawSha256 = h64("b"); } },
      { name: "parent raw hash", mutate: (item) => { item.revision.parentRawSha256 = h64("c"); } },
      {
        name: "normalized hash",
        mutate: (item) => { item.revision.childNormalizedSha256 = h64("d"); },
      },
      {
        name: "parent normalized hash",
        mutate: (item) => { item.revision.parentNormalizedSha256 = h64("e"); },
      },
      {
        name: "observation time",
        mutate: (item) => { item.acquisition.observationTime = "2026-07-27T16:00:00Z"; },
      },
      {
        name: "receipt time",
        mutate: (item) => {
          item.acquisition.authoritativeReceiptTime = "2026-07-27T16:00:01Z";
        },
      },
      {
        name: "metadata snapshot",
        mutate: (item) => { item.acquisition.repositoryMetadataSnapshotHash = h64("f"); },
      },
      {
        name: "checkpoint",
        mutate: (item) => { item.acquisition.checkpointHash = h64("0"); },
      },
      { name: "draft hash", mutate: (item) => { item.acquisition.draftHash = h64("3"); } },
      { name: "license path", mutate: (item) => { item.license.filePath = "COPYING"; } },
      { name: "license blob", mutate: (item) => { item.license.blobSha = h40("c"); } },
      {
        name: "repository policy",
        mutate: (item) => { item.license.repositoryAdmissionPolicyVersion = "repo-v2"; },
      },
      {
        name: "repository policy hash",
        mutate: (item) => { item.license.repositoryAdmissionPolicyHash = h64("1"); },
      },
      {
        name: "attribution policy",
        mutate: (item) => { item.marker.attributionMarkerPolicyHash = h64("c"); },
      },
      {
        name: "attribution policy version",
        mutate: (item) => { item.marker.attributionMarkerPolicyVersion = "markers-v2"; },
      },
      {
        name: "snapshot",
        mutate: (item) => { item.storage.rawSnapshotIdentifiers = ["snapshot-2"]; },
      },
      {
        name: "retention",
        mutate: (item) => { item.storage.retentionDeadline = "2026-09-26T15:00:01Z"; },
      },
      {
        name: "screening",
        mutate: (item) => { item.screeningOutcomes = [{ screen: "OTHER", result: "passed" }]; },
      },
      {
        name: "policy register",
        mutate: (item) => { item.policyAuthorization.approvedPolicyRegisterHash = h64("d"); },
      },
      {
        name: "policy register version",
        mutate: (item) => {
          item.policyAuthorization.approvedPolicyRegisterVersion = "policies-v2";
        },
      },
      {
        name: "policy entries",
        mutate: (item) => {
          item.policyAuthorization.authorizingEntryIdentifiers =
            ["other-repository-entry", "marker-entry"];
        },
      },
      {
        name: "operator register",
        mutate: (item) => { item.operatorAuthorization.registerVersion = "operators-v2"; },
      },
      {
        name: "operator register hash",
        mutate: (item) => { item.operatorAuthorization.registerHash = h64("2"); },
      },
      {
        name: "operator entry",
        mutate: (item) => { item.operatorAuthorization.entryIdentifier = "other-operator"; },
      },
    ];
    for (const swap of swaps) {
      const value = input("language");
      const mutable = structuredClone(value.evidence) as unknown as Record<string, any>;
      swap.mutate(mutable);
      expect(() => promoteAcquisitionDraft({
        ...value,
        evidence: mutable,
      })).toThrow(PromotionRuleError);
    }
  });

  it("rejects unbound provenance diff and language proposal claims", () => {
    const provenanceValue = input("provenance");
    const changedDiff = createAcquisitionDraft({
      ...provenanceValue.draft.input,
      diff: {
        ...(provenanceValue.draft.input.diff as Record<string, unknown>),
        excerptHash: h64("1"),
        changedLinesHash: h64("1"),
      },
    });
    const provenanceEvidence = structuredClone(provenanceValue.evidence) as unknown as
      Record<string, any>;
    provenanceEvidence.acquisition.draftIdentifier = changedDiff.draftId;
    provenanceEvidence.acquisition.draftHash = changedDiff.draftHash;
    expect(() => promoteAcquisitionDraft({
      ...provenanceValue,
      draft: changedDiff,
      evidence: provenanceEvidence,
    })).toThrow(PromotionRuleError);

    const languageValue = input("language");
    const changedProposal = createAcquisitionDraft({
      ...languageValue.draft.input,
      languageProposal: {
        ...(languageValue.draft.input.languageProposal as Record<string, unknown>),
        proposedLanguage: "JavaScript",
      },
    });
    const languageEvidence = structuredClone(languageValue.evidence) as unknown as
      Record<string, any>;
    languageEvidence.acquisition.draftIdentifier = changedProposal.draftId;
    languageEvidence.acquisition.draftHash = changedProposal.draftHash;
    expect(() => promoteAcquisitionDraft({
      ...languageValue,
      draft: changedProposal,
      evidence: languageEvidence,
    })).toThrow(PromotionRuleError);
  });

  it("rejects a language excerpt not bound as the exact normalized child", () => {
    const value = input("language");
    const changedDraft = createAcquisitionDraft({
      ...value.draft.input,
      source: {
        ...value.draft.input.source,
        childNormalizedHash: h64("2"),
      },
    });
    const changedEvidence = structuredClone(value.evidence) as unknown as
      Record<string, any>;
    changedEvidence.acquisition.draftIdentifier = changedDraft.draftId;
    changedEvidence.acquisition.draftHash = changedDraft.draftHash;
    changedEvidence.revision.childNormalizedSha256 = h64("2");
    expect(() => promoteAcquisitionDraft({
      ...value,
      draft: changedDraft,
      evidence: changedEvidence,
    })).toThrow(PromotionRuleError);
  });

  it("preserves generic agent evidence without inferring a model name", () => {
    const promoted = promoteAcquisitionDraft(input("provenance"));
    expect(promoted.provenance).toEqual({
      classification: "AGENT_RECORDED",
      recordedModelName: null,
      publicClaim: "AI coding agent",
    });
    expect(promoted.reveal.attribution).toBe("owner/repo, MIT");
  });
});
