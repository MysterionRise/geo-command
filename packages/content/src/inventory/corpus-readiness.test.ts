import { createHash } from "node:crypto";

import type {
  ApprovalChecksInput,
  PublicationEligibilityInput,
  ReviewerDecisionInput,
  SourceRegimeSelectionInput,
  StackOverflowItemIdentity,
} from "../index";
import {
  CorpusReadinessRuleError as PublicCorpusReadinessRuleError,
  evaluateCorpusReadiness as publicEvaluateCorpusReadiness,
} from "../index";
import { CorpusReadinessRuleError, evaluateCorpusReadiness } from "./corpus-readiness";

interface Expectation {
  readonly not: Expectation;
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatch(expected: RegExp): void;
  toThrow(expected?: unknown): void;
}

interface Each {
  <First, Second>(cases: readonly (readonly [First, Second])[]): (name: string, callback: (first: First, second: Second) => unknown) => void;
  <T>(cases: readonly T[]): (name: string, callback: (value: T) => unknown) => void;
}

interface TestFunction {
  (name: string, callback: () => unknown): void;
  readonly each: Each;
}

interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => Expectation;
  readonly it: TestFunction;
}

const testModuleName: string = "vitest";
const { describe, expect, it } = (await import(testModuleName)) as TestApi;

type Mode = "provenance" | "language";
type DifficultyBand = "easy" | "medium" | "hard";
type Slot = "scheduled" | "reserve";

interface InventoryEntryInput {
  slot: Slot;
  day: number | null;
  position: number | null;
  mode: Mode;
  difficultyBand: DifficultyBand;
  status: "ACTIVE" | "QUARANTINED" | "CONTENT_WITHDRAWN" | "LEGALLY_EXCLUDED";
  roundId: string;
  roundVersionId: string;
  contentStableId: string;
  contentHash: string;
  contentVersionId: string;
  evidenceVersionId: string;
  candidateSetVersionId: string;
  clueSetVersionId: string;
  correctionVersionId: string;
  rendererVersionId: string;
  sourceRegimeVersionId: string;
  evidence: Record<string, unknown>;
  publicationEligibility: PublicationEligibilityInput;
  promotionReceipt: Record<string, unknown> | null;
  stackOverflowIdentity: StackOverflowItemIdentity | null;
}

interface CorpusReadinessInput {
  fixtureKind: "SYNTHETIC_TEST_ONLY" | "REVISION_7_AUTHENTIC";
  inventoryVersionId: string;
  difficultyPolicyVersionId: string;
  sourceRegime: SourceRegimeSelectionInput;
  scheduled: InventoryEntryInput[];
  reserves: InventoryEntryInput[];
}

const MODES: readonly Mode[] = ["provenance", "language"];
const BANDS: readonly DifficultyBand[] = ["easy", "medium", "hard"];
const APPROVAL_CHECKS: ApprovalChecksInput = {
  answerIntegrity: true,
  ambiguity: true,
  difficulty: true,
  provenance: true,
  rights: true,
  attribution: true,
  secrets: true,
  personalData: true,
  safety: true,
  inertRendering: true,
  accessibility: true,
  evidenceMinimization: true,
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

function reviews(mode: Mode, evidenceVersion: string): ReviewerDecisionInput[] {
  const roles = [
    "content-editor",
    "technical-reviewer-a",
    "technical-reviewer-b",
    "rights-safety-reviewer",
  ] as const;
  return roles.map((role, index) => ({
    reviewerId: `synthetic-reviewer-${index}`,
    reviewerName: `Synthetic Reviewer ${index}`,
    role,
    qualifications: role === "content-editor"
      ? ["content-preparation", "evidence-record-training"]
      : role === "rights-safety-reviewer"
        ? ["don-approved-rights-safety-qualification"]
        : [mode],
    decision: "approve",
    reviewDate: "2026-07-01",
    conflictDeclared: false,
    conflictDeclaration: "Synthetic fixture declares no conflict",
    evidenceVersion,
  }));
}

function evidence(index: number, mode: Mode, contentId: string, contentVersionId: string, evidenceVersion: string) {
  const excerpt = `synthetic ${mode} excerpt ${index}`;
  const reviewerInputs = reviews(mode, evidenceVersion);
  return {
    stableId: contentId,
    sourceClass: "project-owned-human",
    contentHash: hash(excerpt),
    excerpt,
    acquisitionMethod: "synthetic test fixture",
    acquisitionDate: "2026-07-01",
    evidenceReference: { artifactId: contentVersionId, versionId: evidenceVersion },
    creatorOrSourceIdentity: "synthetic-fixture-author",
    ownershipLicenseAuthorizationBasis: "synthetic fixture only",
    reviewerIdentities: reviewerInputs.map(({ reviewerId }) => reviewerId),
    reviewerDates: reviewerInputs.map(() => "2026-07-01"),
    eligibilityDecision: "eligible",
    attributionOrDisclosureText: "Synthetic fixture",
    correctionState: "ACTIVE",
    publicationStatus: "ELIGIBLE",
    creationOrCommissionBasis: "synthetic fixture construction",
    recordedProjectAuthorization: "synthetic-test-only",
  };
}

function entry(index: number, slot: Slot, mode: Mode, difficultyBand: DifficultyBand, day: number | null, position: number | null): InventoryEntryInput {
  const contentStableId = `synthetic-content-${index}`;
  const contentVersionId = `content-version-${index}`;
  const evidenceVersionId = `evidence-version-${index}`;
  const record = evidence(index, mode, contentStableId, contentVersionId, evidenceVersionId);
  return {
    slot,
    day,
    position,
    mode,
    difficultyBand,
    status: "ACTIVE",
    roundId: `round-${index}`,
    roundVersionId: `round-version-${index}`,
    contentStableId,
    contentHash: record.contentHash,
    contentVersionId,
    evidenceVersionId,
    candidateSetVersionId: `candidate-set-${mode}-${index}`,
    clueSetVersionId: `clue-set-${index}`,
    correctionVersionId: "correction-policy-v1",
    rendererVersionId: "renderer-v1",
    sourceRegimeVersionId: "source-regime-v1",
    evidence: record,
    publicationEligibility: {
      contentId: contentStableId,
      itemMode: mode,
      evidenceVersion: evidenceVersionId,
      defensibleCompetingAnswers: [],
      approvalChecks: { ...APPROVAL_CHECKS },
      reviews: reviews(mode, evidenceVersionId),
    },
    promotionReceipt: null,
    stackOverflowIdentity: null,
  };
}

function fixture(): CorpusReadinessInput {
  let index = 0;
  const scheduled: InventoryEntryInput[] = [];
  for (let day = 1; day <= 14; day += 1) {
    for (let position = 1; position <= 5; position += 1) {
      const mode: Mode = position <= 3 ? "provenance" : "language";
      scheduled.push(entry(index++, "scheduled", mode, BANDS[(day + position) % BANDS.length]!, day, position));
    }
  }
  const reserves: InventoryEntryInput[] = [];
  for (const mode of MODES) {
    const perBand = mode === "provenance" ? 3 : 2;
    for (const band of BANDS) for (let count = 0; count < perBand; count += 1) {
      reserves.push(entry(index++, "reserve", mode, band, null, null));
    }
  }
  return {
    fixtureKind: "SYNTHETIC_TEST_ONLY",
    inventoryVersionId: "inventory-v1",
    difficultyPolicyVersionId: "difficulty-policy-v1",
    sourceRegime: {
      versionId: "source-regime-v1",
      selectedAt: "2026-07-01T00:00:00Z",
      selection: "project-owned-fallback",
    },
    scheduled,
    reserves,
  };
}

function expectRuleError(input: unknown): void {
  expect(() => evaluateCorpusReadiness(input)).toThrow(CorpusReadinessRuleError);
}

function deepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

function stackOverflowEvidence(source: InventoryEntryInput): Record<string, unknown> {
  const { creationOrCommissionBasis: _creation, recordedProjectAuthorization: _authorization, ...common } = source.evidence;
  return {
    ...common,
    sourceClass: "stack-overflow",
    sourceUrl: "https://stackoverflow.invalid/questions/1",
    postId: "post-1",
    revisionId: "revision-1",
    author: "Synthetic Author",
    contributionOrRevisionDate: "2026-07-01",
    applicableLicense: "CC BY-SA",
    licenseVersion: "4.0",
    acquisitionBasis: "synthetic fixture",
    firstDisplayAttributionDecision: "not required",
    approvedRevealAttribution: "Synthetic attribution",
  };
}

function modelOutputEvidence(source: InventoryEntryInput): Record<string, unknown> {
  const { creationOrCommissionBasis: _creation, recordedProjectAuthorization: _authorization, ...common } = source.evidence;
  return {
    ...common,
    sourceClass: "model-output",
    provider: "synthetic-provider",
    model: "synthetic-model",
    generationDate: "2026-07-01",
    promptProvenanceOrApprovedRedactedEvidence: "synthetic prompt evidence",
    availableGenerationParameters: "synthetic parameters",
    rawOutputHash: source.contentHash,
    providerTermsVersion: "synthetic-terms-v1",
    generatingAccountOrPlan: "synthetic-plan",
    commercialUseBasis: "synthetic fixture authorization",
    dataUseOrTrainingSetting: "synthetic setting",
    knownProviderRestrictions: "none in synthetic fixture",
    similarityOrContaminationReviewResult: "synthetic review complete",
    reviewerThirdPartyRightsDecision: "eligible",
    approvedPublicAttributionOrDisclosureText: "Synthetic fixture",
    acquisitionOrReviewerDecision: "eligible",
  };
}

const gitSha = (value: number): string => (value % 10).toString().repeat(40);
const sha256 = (value: number): string =>
  ((value % 9) + 1).toString().repeat(64);

function licensedEvidence(
  source: InventoryEntryInput,
  purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
  index: number,
): Record<string, unknown> {
  const { creationOrCommissionBasis: _creation, recordedProjectAuthorization: _authorization, ...common } =
    source.evidence;
  const child = gitSha(index + 1);
  const path = `src/example-${index}.ts`;
  return {
    ...common,
    sourceClass: "licensed-github",
    creatorOrSourceIdentity: `owner/repo-${index}`,
    ownershipLicenseAuthorizationBasis: "approved file-level MIT review",
    attributionOrDisclosureText: `owner/repo-${index}, MIT`,
    repository: { owner: "owner", name: `repo-${index}`, immutableId: `R_${index}` },
    revision: {
      childCommitSha: child, parentCommitSha: gitSha(index + 2),
      childTreeSha: gitSha(index + 3), parentTreeSha: gitSha(index + 4),
      approvedSubtree: "src", path, childBlobSha: gitSha(index + 5),
      parentBlobSha: gitSha(index + 6),
      sourceUrl: `https://github.com/owner/repo-${index}/blob/${child}/${path}`,
      commitUrl: `https://github.com/owner/repo-${index}/commit/${child}`,
      childRawSha256: sha256(index + 1), parentRawSha256: sha256(index + 2),
      childNormalizedSha256: sha256(index + 3),
      parentNormalizedSha256: sha256(index + 4),
    },
    acquisition: {
      purpose, observationTime: "2026-07-27T12:00:00Z",
      authoritativeReceiptTime: "2026-07-27T12:00:01Z",
      repositoryMetadataSnapshotHash: sha256(index + 5),
      checkpointHash: sha256(index + 15),
      draftIdentifier: `draft-${index}`,
      draftHash: sha256(index + 25),
    },
    license: {
      identifier: "MIT", filePath: "LICENSE", blobSha: gitSha(index + 7),
      textHash: sha256(index + 6),
      repositoryAdmissionPolicyVersion: "repository-policy-v1",
      repositoryAdmissionPolicyHash: sha256(index + 7),
    },
    marker: purpose === "LANGUAGE_CANDIDATE"
      ? {
          status: "language-only-not-applicable",
          attributionMarkerPolicyVersion: "marker-policy-v1",
          attributionMarkerPolicyHash: sha256(index + 8),
          decision: "language-only marker decision",
        }
      : {
          status: "accepted", attributionMarkerPolicyVersion: "marker-policy-v1",
          attributionMarkerPolicyHash: sha256(index + 8),
          classification: "AGENT_RECORDED", recordedModelName: null,
          policyRule: "vendor-agent-v1", commitAuthor: "Fixture Author",
          committer: "Fixture Committer", signatureVerificationResult: "verified",
          commitMessageHash: sha256(index + 9),
          parsedMarker: "Co-authored-by: Fixture Agent",
          vendorSessionReference: null,
        },
    screeningOutcomes: [{ screen: "safe-text", result: "passed" }],
    storage: {
      rawSnapshotIdentifiers: [`snapshot-${index}`],
      retentionDeadline: "2026-08-26T12:00:01Z",
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
      reviewLineage: `review-lineage-${index}`,
      promotionIdentifier: `promotion-${index}`,
      catalogueApprovalHash: sha256(index + 12),
    },
    policyAuthorization: {
      approvedPolicyRegisterVersion: "approved-policy-v1",
      approvedPolicyRegisterHash: sha256(index + 1),
      authorizingEntryIdentifiers: ["repository-entry", "marker-entry"],
    },
    operatorAuthorization: {
      registerVersion: "operator-register-v1",
      registerHash: sha256(index + 2),
      entryIdentifier: "operator-entry",
    },
  };
}

function revision7Fixture(): CorpusReadinessInput {
  const input = fixture();
  input.fixtureKind = "REVISION_7_AUTHENTIC";
  input.sourceRegime = {
    versionId: "source-regime-v7",
    selectedAt: "2026-07-27T12:00:00Z",
    selection: "licensed-github-vs-project-controlled",
  };
  for (const [index, item] of [...input.scheduled, ...input.reserves].entries()) {
    item.sourceRegimeVersionId = "source-regime-v7";
    if (item.mode === "language") {
      item.evidence = licensedEvidence(item, "LANGUAGE_CANDIDATE", index);
      item.promotionReceipt = promotionReceipt(item);
    } else if (index % 2 === 0) {
      item.evidence = licensedEvidence(
        item,
        "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
        index,
      );
      item.promotionReceipt = promotionReceipt(item);
    } else {
      item.evidence.noAgentParticipationAttestation =
        "The identified creator affirmatively attests no AI coding agent participated.";
    }
  }
  return input;
}

function promotionReceipt(item: InventoryEntryInput): Record<string, unknown> {
  const acquisition = item.evidence.acquisition as Record<string, unknown>;
  const lineage = item.evidence.lineage as Record<string, unknown>;
  return {
    status: "PROMOTED_H001",
    promotionIdentifier: lineage.promotionIdentifier,
    mode: item.mode,
    sourceClass: "licensed-github",
    purpose: acquisition.purpose,
    draftHash: acquisition.draftHash,
    catalogueHash: lineage.catalogueApprovalHash,
    roundId: item.roundId,
    roundVersionId: item.roundVersionId,
    contentStableId: item.contentStableId,
    contentHash: item.contentHash,
    contentVersionId: item.contentVersionId,
    evidenceVersionId: item.evidenceVersionId,
  };
}

function stackOverflowFixture(): CorpusReadinessInput {
  const input = fixture();
  const item = input.scheduled[0]!;
  const coveredEvidence = stackOverflowEvidence(item);
  for (const item of [...input.scheduled, ...input.reserves]) item.evidence = modelOutputEvidence(item);
  item.evidence = coveredEvidence;
  item.stackOverflowIdentity = {
    postId: "post-1",
    revisionId: "revision-1",
    licenseName: "CC BY-SA",
    licenseVersion: "4.0",
    presentationDesignVersion: "presentation-v1",
    interactionDesignVersion: "interaction-v1",
    firstDisplayAttributionRequired: false,
  };
  input.sourceRegime = {
    versionId: "source-regime-v1",
    selectedAt: "2026-07-02T00:00:00Z",
    selection: "stack-overflow-enabled",
    determination: {
      determinationId: "synthetic-determination-v1",
      writtenText: "Synthetic affirmative determination for the exact covered fixture.",
      reviewerId: "synthetic-rights-reviewer",
      reviewerName: "Synthetic Rights Reviewer",
      scope: "Exact synthetic Stack Overflow fixture",
      contributionRevisionDateTreatment: "Use the covered synthetic revision date.",
      consideredLicenseVersions: ["CC BY-SA 4.0"],
      attributionFormat: "Synthetic author, post, revision, and license at reveal.",
      shareAlikeTreatment: "Synthetic reveal retains the license notice.",
      effectiveDate: "2026-07-01",
      presentationDesignVersion: "presentation-v1",
      interactionDesignVersion: "interaction-v1",
      attributionAtRevealSatisfiesLicense: true,
      firstDisplayAttributionRequired: false,
      coveredItems: [{ postId: "post-1", revisionId: "revision-1", licenseName: "CC BY-SA", licenseVersion: "4.0" }],
      approval: {
        role: "Don",
        signerId: "synthetic-don",
        signedAt: "2026-07-01T00:00:00Z",
        signature: "synthetic-test-signature",
      },
    },
  };
  return input;
}

function setMode(round: InventoryEntryInput, mode: Mode): void {
  round.mode = mode;
  round.publicationEligibility.itemMode = mode;
  for (const review of round.publicationEligibility.reviews) {
    if (review.role.startsWith("technical-")) review.qualifications = [mode];
  }
}

describe("corpus readiness", () => {
  it("exports the evaluator and rule error through the public content API", () => {
    expect(publicEvaluateCorpusReadiness).toBe(evaluateCorpusReadiness);
    expect(PublicCorpusReadinessRuleError).toBe(CorpusReadinessRuleError);
  });

  it("technically validates exact synthetic inventory while remaining operationally blocked", () => {
    const result = evaluateCorpusReadiness(fixture());
    expect(result).toEqual({
      technicalStatus: "PASS",
      operationalStatus: "BLOCKED_PENDING_AUTHENTIC_CORPUS",
      inventoryVersionId: "inventory-v1",
      difficultyPolicyVersionId: "difficulty-policy-v1",
      sourceRegimeVersionId: "source-regime-v1",
      counts: { scheduled: 70, reserves: 15, total: 85, provenanceScheduled: 42, languageScheduled: 28, provenanceReserves: 9, languageReserves: 6 },
      compatibleModeDifficultyPairs: ["language:easy", "language:hard", "language:medium", "provenance:easy", "provenance:hard", "provenance:medium"],
    });
    expect(deepFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/excerpt|reviewer|signature|READY|APPROVED|invitation|deployment/iu);
  });

  it("marks a complete Revision 7 active-class inventory ready", () => {
    const result = evaluateCorpusReadiness(revision7Fixture());
    expect(result.technicalStatus).toBe("PASS");
    expect(result.operationalStatus).toBe("READY_FOR_CONTROLLED_BETA");
    expect(result.counts).toEqual({
      scheduled: 70, reserves: 15, total: 85,
      provenanceScheduled: 42, languageScheduled: 28,
      provenanceReserves: 9, languageReserves: 6,
    });
  });

  it("rejects reviewed licensed evidence that has no promoted H-001 receipt", () => {
    const input = revision7Fixture();
    const licensed = input.scheduled.find(
      ({ evidence: record }) => record.sourceClass === "licensed-github",
    )!;
    licensed.promotionReceipt = null;
    expectRuleError(input);
  });

  it.each([
    "status", "promotionIdentifier", "mode", "sourceClass", "purpose",
    "draftHash", "catalogueHash", "roundId", "roundVersionId", "contentStableId",
    "contentHash", "contentVersionId", "evidenceVersionId",
  ] as const)("rejects promoted receipt %s drift", (field) => {
    const input = revision7Fixture();
    const licensed = input.scheduled.find(
      ({ evidence: record }) => record.sourceClass === "licensed-github",
    )!;
    licensed.promotionReceipt![field] = "drift";
    expectRuleError(input);
  });

  it("rejects inactive and incomplete Revision 7 evidence classes", () => {
    const historical = revision7Fixture();
    historical.scheduled[0]!.evidence = modelOutputEvidence(historical.scheduled[0]!);
    expectRuleError(historical);

    const missingAttestation = revision7Fixture();
    const negative = missingAttestation.scheduled.find(({ mode, evidence }) =>
      mode === "provenance" && evidence.sourceClass === "project-owned-human")!;
    delete negative.evidence.noAgentParticipationAttestation;
    expectRuleError(missingAttestation);

    const wrongPurpose = revision7Fixture();
    const language = wrongPurpose.scheduled.find(({ mode }) => mode === "language")!;
    language.evidence = licensedEvidence(
      language,
      "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
      999,
    );
    expectRuleError(wrongPurpose);
  });

  it("detaches the frozen assessment from mutable synthetic input", () => {
    const input = fixture();
    const result = evaluateCorpusReadiness(input);
    const before = JSON.stringify(result);
    input.inventoryVersionId = "mutated";
    input.scheduled[0]!.evidence.excerpt = "mutated";
    expect(JSON.stringify(result)).toBe(before);
  });

  it.each([[69, 15], [71, 15], [70, 14], [70, 16]])("rejects scheduled/reserve count %i/%i", (scheduled, reserves) => {
    const input = fixture();
    if (scheduled < 70) input.scheduled.pop();
    if (scheduled > 70) input.scheduled.push(entry(900, "scheduled", "provenance", "easy", 14, 5));
    if (reserves < 15) input.reserves.pop();
    if (reserves > 15) input.reserves.push(entry(901, "reserve", "provenance", "easy", null, null));
    expectRuleError(input);
  });

  it.each([
    ["duplicate day/position", (input: CorpusReadinessInput) => { input.scheduled[1]!.position = 1; }],
    ["daily ratio", (input: CorpusReadinessInput) => { setMode(input.scheduled[3]!, "provenance"); setMode(input.scheduled[5]!, "language"); }],
    ["reserve ratio", (input: CorpusReadinessInput) => { setMode(input.reserves[0]!, "language"); }],
  ])("rejects %s drift", (_name, mutate) => { const input = fixture(); mutate(input); expectRuleError(input); });

  it.each(["roundId", "roundVersionId", "contentStableId", "contentHash", "contentVersionId"] as const)("rejects duplicate %s across all entries", (field) => {
    const input = fixture();
    input.reserves[0]![field] = input.scheduled[0]![field];
    expectRuleError(input);
  });

  it.each(["inventoryVersionId", "difficultyPolicyVersionId"] as const)("rejects blank top-level %s", (field) => {
    const input = fixture(); input[field] = " "; expectRuleError(input);
  });

  it.each(["inventoryVersionId", "difficultyPolicyVersionId"] as const)("rejects missing top-level %s", (field) => {
    const input = fixture(); delete (input as Partial<CorpusReadinessInput>)[field]; expectRuleError(input);
  });

  it.each(["roundVersionId", "contentVersionId", "evidenceVersionId", "candidateSetVersionId", "clueSetVersionId", "correctionVersionId", "rendererVersionId", "sourceRegimeVersionId"] as const)("rejects blank entry %s", (field) => {
    const input = fixture(); input.scheduled[0]![field] = " "; expectRuleError(input);
  });

  it.each(["roundVersionId", "contentVersionId", "evidenceVersionId", "candidateSetVersionId", "clueSetVersionId", "correctionVersionId", "rendererVersionId", "sourceRegimeVersionId"] as const)("rejects missing entry %s", (field) => {
    const input = fixture(); delete (input.scheduled[0] as Partial<InventoryEntryInput>)[field]; expectRuleError(input);
  });

  it("rejects blank source-regime version", () => { const input = fixture(); (input.sourceRegime as unknown as { versionId: string }).versionId = " "; expectRuleError(input); });
  it("rejects missing source-regime version", () => { const input = fixture(); delete (input.sourceRegime as unknown as { versionId?: string }).versionId; expectRuleError(input); });

  it.each([
    ["content identity", (round: InventoryEntryInput) => { round.contentStableId = "other"; }],
    ["content hash", (round: InventoryEntryInput) => { round.contentHash = "other"; }],
    ["content version", (round: InventoryEntryInput) => { (round.evidence.evidenceReference as Record<string, unknown>).artifactId = "other"; }],
    ["evidence version", (round: InventoryEntryInput) => { (round.evidence.evidenceReference as Record<string, unknown>).versionId = "other"; }],
    ["eligibility content", (round: InventoryEntryInput) => { round.publicationEligibility.contentId = "other"; }],
    ["eligibility mode", (round: InventoryEntryInput) => { round.publicationEligibility.itemMode = round.mode === "language" ? "provenance" : "language"; }],
    ["eligibility evidence", (round: InventoryEntryInput) => { round.publicationEligibility.evidenceVersion = "other"; }],
    ["source-regime version", (round: InventoryEntryInput) => { round.sourceRegimeVersionId = "other"; }],
  ])("rejects %s binding drift", (_name, mutate) => { const input = fixture(); mutate(input.scheduled[0]!); expectRuleError(input); });

  it.each([
    ["approval check", (round: InventoryEntryInput) => { round.publicationEligibility.approvalChecks.rights = false; }],
    ["competing answer", (round: InventoryEntryInput) => { round.publicationEligibility.defensibleCompetingAnswers.push("other"); }],
    ["review count", (round: InventoryEntryInput) => { round.publicationEligibility.reviews.pop(); }],
    ["duplicate reviewer", (round: InventoryEntryInput) => { round.publicationEligibility.reviews[1]!.reviewerId = round.publicationEligibility.reviews[0]!.reviewerId; }],
    ["review conflict", (round: InventoryEntryInput) => { round.publicationEligibility.reviews[0]!.conflictDeclared = true; }],
    ["review rejection", (round: InventoryEntryInput) => { round.publicationEligibility.reviews[0]!.decision = "reject"; }],
    ["mode qualification", (round: InventoryEntryInput) => { round.publicationEligibility.reviews[1]!.qualifications = ["other"]; }],
    ["review evidence version", (round: InventoryEntryInput) => { round.publicationEligibility.reviews[0]!.evidenceVersion = "other"; }],
  ])("revalidates real four-role eligibility: %s", (_name, mutate) => { const input = fixture(); mutate(input.scheduled[0]!); expectRuleError(input); });

  it.each([0, 1, 2, 3])("requires exact review role at index %i without changing review count", (index) => {
    const input = fixture();
    const reviews = input.scheduled[0]!.publicationEligibility.reviews;
    const replacement = reviews[(index + 1) % reviews.length]!.role;
    reviews[index]!.role = replacement;
    reviews[index]!.qualifications = replacement === "content-editor"
      ? ["content-preparation", "evidence-record-training"]
      : replacement === "rights-safety-reviewer"
        ? ["don-approved-rights-safety-qualification"]
        : [input.scheduled[0]!.mode];
    expectRuleError(input);
  });

  it.each([
    ["evidence stable ID", (round: InventoryEntryInput) => { round.evidence.stableId = "other"; }],
    ["evidence content hash", (round: InventoryEntryInput) => { round.evidence.contentHash = "other"; }],
    ["excerpt integrity", (round: InventoryEntryInput) => { round.evidence.excerpt = "tampered"; }],
    ["eligibility decision", (round: InventoryEntryInput) => { round.evidence.eligibilityDecision = "ineligible"; }],
    ["publication status", (round: InventoryEntryInput) => { round.evidence.publicationStatus = "QUARANTINED"; }],
    ["extra evidence field", (round: InventoryEntryInput) => { round.evidence.claimedEligible = true; }],
  ])("revalidates accepted evidence contract: %s", (_name, mutate) => { const input = fixture(); mutate(input.scheduled[0]!); expectRuleError(input); });

  it("rejects Stack Overflow evidence under project-owned fallback", () => {
    const input = fixture(); input.scheduled[0]!.evidence = stackOverflowEvidence(input.scheduled[0]!); expectRuleError(input);
  });

  it("accepts an exactly covered Stack Overflow item while remaining operationally blocked", () => {
    const result = evaluateCorpusReadiness(stackOverflowFixture());
    expect(result.technicalStatus).toBe("PASS");
    expect(result.operationalStatus).toBe("BLOCKED_PENDING_AUTHENTIC_CORPUS");
  });

  it.each(["postId", "revisionId", "applicableLicense", "licenseVersion"] as const)(
    "rejects Stack Overflow evidence-only %s drift from its covered identity",
    (field) => {
      const input = stackOverflowFixture();
      input.scheduled[0]!.evidence[field] = "drifted-evidence-value";
      expectRuleError(input);
    },
  );

  it.each([
    ["missing scheduled compatibility", (input: CorpusReadinessInput) => { for (const reserve of input.reserves) if (reserve.mode === "provenance" && reserve.difficultyBand === "hard") reserve.difficultyBand = "easy"; }],
    ["unusable reserve", (input: CorpusReadinessInput) => { input.reserves[0]!.difficultyBand = "hard"; for (const scheduled of input.scheduled) if (scheduled.mode === "provenance" && scheduled.difficultyBand === "hard") scheduled.difficultyBand = "easy"; }],
  ])("rejects %s", (_name, mutate) => { const input = fixture(); mutate(input); expectRuleError(input); });

  it.each(["QUARANTINED", "CONTENT_WITHDRAWN", "LEGALLY_EXCLUDED"] as const)("rejects non-active status %s", (status) => {
    const input = fixture(); input.scheduled[0]!.status = status; expectRuleError(input);
  });

  it.each([null, [], "bad", 7, {}, { fixtureKind: "SYNTHETIC_TEST_ONLY" }])("rejects malformed input %# with its own rule error", (input) => expectRuleError(input));

  it("rejects unknown top-level and entry fields", () => {
    const top = fixture() as CorpusReadinessInput & { deployment?: string }; top.deployment = "READY"; expectRuleError(top);
    const nested = fixture(); (nested.scheduled[0] as InventoryEntryInput & { claimedEligible?: boolean }).claimedEligible = true; expectRuleError(nested);
  });
});
