import { createHash } from "node:crypto";

import { parseEvidenceRecord, type EvidenceRecord } from "../evidence/records";
import {
  createPublicationEligibility,
  type PublicationEligibility,
  type PublicationEligibilityInput,
} from "../review/publication-eligibility";
import { parsePromotionReceipt } from "../acquisition/promotion/promotion-receipt";
import {
  SourceRegimeControl,
  type SourceRegimeSelectionInput,
  type StackOverflowItemIdentity,
} from "../rights/source-regime";

type UnknownRecord = Record<string, unknown>;
type Mode = "provenance" | "language";
type DifficultyBand = "easy" | "medium" | "hard";

const TOP_FIELDS = ["fixtureKind", "inventoryVersionId", "difficultyPolicyVersionId", "sourceRegime", "scheduled", "reserves"] as const;
const ENTRY_FIELDS = ["slot", "day", "position", "mode", "difficultyBand", "status", "roundId", "roundVersionId", "contentStableId", "contentHash", "contentVersionId", "evidenceVersionId", "candidateSetVersionId", "clueSetVersionId", "correctionVersionId", "rendererVersionId", "sourceRegimeVersionId", "evidence", "publicationEligibility", "promotionReceipt", "stackOverflowIdentity"] as const;
const VERSION_FIELDS = ["roundVersionId", "contentVersionId", "evidenceVersionId", "candidateSetVersionId", "clueSetVersionId", "correctionVersionId", "rendererVersionId", "sourceRegimeVersionId"] as const;
const UNIQUE_FIELDS = ["roundId", "roundVersionId", "contentStableId", "contentHash", "contentVersionId"] as const;
const COMMON_EVIDENCE = ["stableId", "sourceClass", "contentHash", "excerpt", "acquisitionMethod", "acquisitionDate", "evidenceReference", "creatorOrSourceIdentity", "ownershipLicenseAuthorizationBasis", "reviewerIdentities", "reviewerDates", "eligibilityDecision", "attributionOrDisclosureText", "correctionState", "publicationStatus"] as const;
const SOURCE_EVIDENCE = {
  "project-owned-human": ["creationOrCommissionBasis", "recordedProjectAuthorization"],
  "stack-overflow": ["sourceUrl", "postId", "revisionId", "author", "contributionOrRevisionDate", "applicableLicense", "licenseVersion", "acquisitionBasis", "firstDisplayAttributionDecision", "approvedRevealAttribution"],
  "model-output": ["provider", "model", "generationDate", "promptProvenanceOrApprovedRedactedEvidence", "availableGenerationParameters", "rawOutputHash", "providerTermsVersion", "generatingAccountOrPlan", "commercialUseBasis", "dataUseOrTrainingSetting", "knownProviderRestrictions", "similarityOrContaminationReviewResult", "reviewerThirdPartyRightsDecision", "approvedPublicAttributionOrDisclosureText", "acquisitionOrReviewerDecision"],
  "licensed-github": [
    "repository", "revision", "acquisition", "license", "marker",
    "screeningOutcomes", "storage", "rights", "lineage",
    "policyAuthorization", "operatorAuthorization",
  ],
} as const;
const APPROVAL_FIELDS = ["answerIntegrity", "ambiguity", "difficulty", "provenance", "rights", "attribution", "secrets", "personalData", "safety", "inertRendering", "accessibility", "evidenceMinimization"] as const;
const REVIEW_FIELDS = ["reviewerId", "reviewerName", "role", "qualifications", "decision", "reviewDate", "conflictDeclared", "conflictDeclaration", "evidenceVersion"] as const;

export class CorpusReadinessRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CorpusReadinessRuleError";
  }
}

function fail(message: string): never {
  throw new CorpusReadinessRuleError(message);
}

function record(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as UnknownRecord;
}

function exact<T = UnknownRecord>(value: unknown, fields: readonly string[], label: string): T {
  const parsed = record(value, label);
  const actual = Object.keys(parsed).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) fail(`${label} has an invalid shape`);
  return parsed as T;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${field} must be a non-blank string`);
  return value;
}

function strictSourceRegime(value: unknown): SourceRegimeSelectionInput {
  const source = record(value, "sourceRegime");
  const fields = source.selection === "stack-overflow-enabled"
    ? ["versionId", "selectedAt", "selection", "determination"]
    : ["versionId", "selectedAt", "selection"];
  exact(source, fields, "sourceRegime");
  if (source.determination !== undefined) {
    const determination = exact(source.determination, ["determinationId", "writtenText", "reviewerId", "reviewerName", "scope", "contributionRevisionDateTreatment", "consideredLicenseVersions", "attributionFormat", "shareAlikeTreatment", "effectiveDate", "presentationDesignVersion", "interactionDesignVersion", "attributionAtRevealSatisfiesLicense", "firstDisplayAttributionRequired", "coveredItems", "approval"], "sourceRegime.determination");
    if (!Array.isArray(determination.coveredItems)) fail("coveredItems must be an array");
    for (const item of determination.coveredItems) exact(item, ["postId", "revisionId", "licenseName", "licenseVersion"], "coveredItem");
    exact(determination.approval, ["role", "signerId", "signedAt", "signature"], "approval");
  }
  return exact<SourceRegimeSelectionInput>(source, fields, "sourceRegime");
}

function strictEvidence(value: unknown): EvidenceRecord {
  const source = record(value, "evidence");
  if (typeof source.sourceClass !== "string" || !(source.sourceClass in SOURCE_EVIDENCE)) fail("unsupported evidence sourceClass");
  const sourceClass = source.sourceClass as keyof typeof SOURCE_EVIDENCE;
  const revision7Human = sourceClass === "project-owned-human"
    && "noAgentParticipationAttestation" in source
      ? ["noAgentParticipationAttestation"]
      : [];
  exact(source, [
    ...COMMON_EVIDENCE,
    ...SOURCE_EVIDENCE[sourceClass],
    ...revision7Human,
  ], "evidence");
  exact(source.evidenceReference, ["artifactId", "versionId"], "evidenceReference");
  return parseEvidenceRecord(source);
}

function strictEligibility(value: unknown): PublicationEligibility {
  const input = exact<PublicationEligibilityInput>(value, ["contentId", "itemMode", "evidenceVersion", "defensibleCompetingAnswers", "approvalChecks", "reviews"], "publicationEligibility");
  exact(input.approvalChecks, APPROVAL_FIELDS, "approvalChecks");
  if (!Array.isArray(input.reviews)) fail("reviews must be an array");
  for (const review of input.reviews) exact(review, REVIEW_FIELDS, "review");
  return createPublicationEligibility(input);
}

interface CheckedEntry {
  readonly source: UnknownRecord;
  readonly evidence: EvidenceRecord;
  readonly eligibility: PublicationEligibility;
  readonly mode: Mode;
  readonly difficultyBand: DifficultyBand;
}

function stackIdentity(value: unknown): StackOverflowItemIdentity {
  return exact<StackOverflowItemIdentity>(value, ["postId", "revisionId", "licenseName", "licenseVersion", "presentationDesignVersion", "interactionDesignVersion", "firstDisplayAttributionRequired"], "stackOverflowIdentity");
}

function continuity(entry: UnknownRecord, evidence: EvidenceRecord, eligibility: PublicationEligibility): void {
  if (evidence.stableId !== entry.contentStableId || evidence.contentHash !== entry.contentHash) fail("evidence content binding drift");
  if (evidence.contentHash !== createHash("sha256").update(evidence.excerpt).digest("hex")) fail("evidence content hash mismatch");
  if (evidence.evidenceReference.artifactId !== entry.contentVersionId || evidence.evidenceReference.versionId !== entry.evidenceVersionId) fail("evidence reference binding drift");
  if (eligibility.contentId !== entry.contentStableId || eligibility.itemMode !== entry.mode || eligibility.evidenceVersion !== entry.evidenceVersionId) fail("publication eligibility binding drift");
  const identities = eligibility.reviews.map(({ reviewerId }) => reviewerId);
  const dates = eligibility.reviews.map(({ reviewDate }) => reviewDate);
  if (identities.join("\0") !== evidence.reviewerIdentities.join("\0") || dates.join("\0") !== evidence.reviewerDates.join("\0")) fail("evidence review binding drift");
  if (evidence.eligibilityDecision !== "eligible" || evidence.publicationStatus !== "ELIGIBLE" || evidence.correctionState !== "ACTIVE") fail("evidence is not active and eligible");
}

function checkedEntry(value: unknown, expectedSlot: "scheduled" | "reserve", regime: SourceRegimeControl): CheckedEntry {
  const entry = exact(value, ENTRY_FIELDS, `${expectedSlot} entry`);
  if (entry.slot !== expectedSlot || entry.status !== "ACTIVE") fail("entry slot/status is invalid");
  const mode = entry.mode;
  if (mode !== "provenance" && mode !== "language") fail("entry mode is invalid");
  const difficultyBand = entry.difficultyBand;
  if (difficultyBand !== "easy" && difficultyBand !== "medium" && difficultyBand !== "hard") fail("difficultyBand is invalid");
  text(entry.roundId, "roundId");
  text(entry.contentStableId, "contentStableId");
  text(entry.contentHash, "contentHash");
  for (const field of VERSION_FIELDS) text(entry[field], field);
  if (entry.sourceRegimeVersionId !== regime.active.versionId) fail("source regime binding drift");
  const evidence = strictEvidence(entry.evidence);
  if (!regime.allowsSourceClass(evidence.sourceClass)) fail("evidence source is excluded by the regime");
  if (evidence.sourceClass === "stack-overflow") {
    const identity = stackIdentity(entry.stackOverflowIdentity);
    if (
      evidence.postId !== identity.postId ||
      evidence.revisionId !== identity.revisionId ||
      evidence.applicableLicense !== identity.licenseName ||
      evidence.licenseVersion !== identity.licenseVersion
    ) fail("Stack Overflow evidence does not match its covered identity");
    if (!regime.stackOverflowItemEligible(identity)) fail("Stack Overflow item is not covered");
  } else if (entry.stackOverflowIdentity !== null) fail("non-Stack Overflow entry has an identity");
  const eligibility = strictEligibility(entry.publicationEligibility);
  continuity(entry, evidence, eligibility);
  return { source: entry, evidence, eligibility, mode, difficultyBand };
}

function revision7Class(
  checked: CheckedEntry,
  fixtureKind: unknown,
): void {
  if (fixtureKind === "SYNTHETIC_TEST_ONLY") return;
  const { evidence, mode } = checked;
  if (fixtureKind !== "REVISION_7_AUTHENTIC") fail("fixtureKind is invalid");
  if (mode === "language") {
    if (evidence.sourceClass !== "licensed-github"
      || evidence.acquisition.purpose !== "LANGUAGE_CANDIDATE"
      || evidence.marker.status !== "language-only-not-applicable") {
      fail("language item is outside the Revision 7 active class");
    }
    promotedReceipt(checked);
    return;
  }
  if (evidence.sourceClass === "licensed-github") {
    if (evidence.acquisition.purpose !== "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
      || evidence.marker.status !== "accepted") {
      fail("positive provenance item is outside the Revision 7 active class");
    }
    promotedReceipt(checked);
    return;
  }
  if (evidence.sourceClass !== "project-owned-human"
    || !evidence.noAgentParticipationAttestation?.trim()
    || checked.source.promotionReceipt !== null) {
    fail("negative provenance item lacks affirmative project-controlled evidence");
  }
}

function promotedReceipt(checked: CheckedEntry): void {
  const evidence = checked.evidence;
  if (evidence.sourceClass !== "licensed-github") {
    return fail("promotion receipt requires licensed-GitHub evidence");
  }
  const receipt = parsePromotionReceipt(checked.source.promotionReceipt);
  if (receipt.status !== "PROMOTED_H001"
    || receipt.promotionIdentifier !== evidence.lineage.promotionIdentifier
    || receipt.mode !== checked.mode
    || receipt.sourceClass !== "licensed-github"
    || receipt.purpose !== evidence.acquisition.purpose
    || receipt.draftHash !== evidence.acquisition.draftHash
    || receipt.catalogueHash !== evidence.lineage.catalogueApprovalHash
    || receipt.roundId !== checked.source.roundId
    || receipt.roundVersionId !== checked.source.roundVersionId
    || receipt.contentStableId !== checked.source.contentStableId
    || receipt.contentHash !== checked.source.contentHash
    || receipt.contentVersionId !== checked.source.contentVersionId
    || receipt.evidenceVersionId !== checked.source.evidenceVersionId) {
    fail("promotion receipt binding drift");
  }
}

function scheduleShape(entries: readonly CheckedEntry[]): void {
  for (let day = 1; day <= 14; day += 1) {
    const daily = entries.filter(({ source }) => source.day === day);
    const positions = daily.map(({ source }) => source.position);
    if (daily.length !== 5 || new Set(positions).size !== 5 || ![1, 2, 3, 4, 5].every((position) => positions.includes(position))) fail("daily positions are invalid");
    if (daily.filter(({ mode }) => mode === "provenance").length !== 3 || daily.filter(({ mode }) => mode === "language").length !== 2) fail("daily mode ratio is invalid");
  }
  if (entries.some(({ source }) => !Number.isInteger(source.day) || !Number.isInteger(source.position))) fail("scheduled day/position is invalid");
}

function uniqueness(entries: readonly CheckedEntry[]): void {
  for (const field of UNIQUE_FIELDS) {
    const values = entries.map(({ source }) => source[field]);
    if (new Set(values).size !== values.length) fail(`${field} must be globally unique`);
  }
}

function modeCounts(entries: readonly CheckedEntry[]): [number, number] {
  return [entries.filter(({ mode }) => mode === "provenance").length, entries.filter(({ mode }) => mode === "language").length];
}

function compatibility(scheduled: readonly CheckedEntry[], reserves: readonly CheckedEntry[]): string[] {
  const scheduledPairs = new Set(scheduled.map(({ mode, difficultyBand }) => `${mode}:${difficultyBand}`));
  const reservePairs = new Set(reserves.map(({ mode, difficultyBand }) => `${mode}:${difficultyBand}`));
  if ([...scheduledPairs].some((pair) => !reservePairs.has(pair)) || [...reservePairs].some((pair) => !scheduledPairs.has(pair))) fail("reserve compatibility is incomplete");
  return [...scheduledPairs].sort();
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as UnknownRecord)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function assess(input: unknown) {
  const root = exact(input, TOP_FIELDS, "corpus readiness input");
  if (root.fixtureKind !== "SYNTHETIC_TEST_ONLY"
    && root.fixtureKind !== "REVISION_7_AUTHENTIC") {
    fail("fixtureKind is invalid");
  }
  const inventoryVersionId = text(root.inventoryVersionId, "inventoryVersionId");
  const difficultyPolicyVersionId = text(root.difficultyPolicyVersionId, "difficultyPolicyVersionId");
  if (!Array.isArray(root.scheduled) || !Array.isArray(root.reserves)) fail("inventory collections must be arrays");
  if (root.scheduled.length !== 70 || root.reserves.length !== 15) fail("inventory counts must be 70/15");
  const regime = SourceRegimeControl.select(strictSourceRegime(root.sourceRegime));
  const scheduled = root.scheduled.map((entry) => checkedEntry(entry, "scheduled", regime));
  const reserves = root.reserves.map((entry) => checkedEntry(entry, "reserve", regime));
  [...scheduled, ...reserves].forEach((entry) =>
    revision7Class(entry, root.fixtureKind));
  if (reserves.some(({ source }) => source.day !== null || source.position !== null)) fail("reserve day/position must be null");
  scheduleShape(scheduled);
  uniqueness([...scheduled, ...reserves]);
  const [provenanceScheduled, languageScheduled] = modeCounts(scheduled);
  const [provenanceReserves, languageReserves] = modeCounts(reserves);
  if (provenanceScheduled !== 42 || languageScheduled !== 28 || provenanceReserves !== 9 || languageReserves !== 6) fail("aggregate mode ratios are invalid");
  return deepFreeze({
    technicalStatus: "PASS" as const,
    operationalStatus: root.fixtureKind === "REVISION_7_AUTHENTIC"
      ? "READY_FOR_CONTROLLED_BETA" as const
      : "BLOCKED_PENDING_AUTHENTIC_CORPUS" as const,
    inventoryVersionId,
    difficultyPolicyVersionId,
    sourceRegimeVersionId: regime.active.versionId,
    counts: { scheduled: 70, reserves: 15, total: 85, provenanceScheduled, languageScheduled, provenanceReserves, languageReserves },
    compatibleModeDifficultyPairs: compatibility(scheduled, reserves),
  });
}

export function evaluateCorpusReadiness(input: unknown): ReturnType<typeof assess> {
  try {
    return assess(input);
  } catch (error) {
    if (error instanceof CorpusReadinessRuleError) throw error;
    const message = error instanceof Error ? error.message : "invalid corpus readiness input";
    throw new CorpusReadinessRuleError(message);
  }
}
