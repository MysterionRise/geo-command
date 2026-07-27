import {
  COMMON_EVIDENCE_FIELDS,
  parseCommonEvidenceFields,
  type CommonEvidenceRecord,
  type EvidenceSourceClass,
} from "./common-evidence";
import {
  parseLicensedGitHubEvidenceRecord,
  type LicensedGitHubEvidenceRecord,
} from "./licensed-github-record";
import {
  requireExact,
  requireObject,
  requireText,
} from "./record-validation";

export type {
  CommonEvidenceRecord,
  EvidenceSourceClass,
  ImmutableEvidenceReference,
} from "./common-evidence";
export type {
  AcquisitionPurpose,
  LanguageMarkerDecision,
  LicensedGitHubEvidenceRecord,
  RecordedMarkerEvidence,
} from "./licensed-github-record";

export interface StackOverflowEvidenceRecord extends CommonEvidenceRecord {
  readonly sourceClass: "stack-overflow";
  readonly sourceUrl: string;
  readonly postId: string;
  readonly revisionId: string;
  readonly author: string;
  readonly contributionOrRevisionDate: string;
  readonly applicableLicense: string;
  readonly licenseVersion: string;
  readonly acquisitionBasis: string;
  readonly firstDisplayAttributionDecision: string;
  readonly approvedRevealAttribution: string;
}

export interface ModelOutputEvidenceRecord extends CommonEvidenceRecord {
  readonly sourceClass: "model-output";
  readonly provider: string;
  readonly model: string;
  readonly generationDate: string;
  readonly promptProvenanceOrApprovedRedactedEvidence: string;
  readonly availableGenerationParameters: string;
  readonly rawOutputHash: string;
  readonly providerTermsVersion: string;
  readonly generatingAccountOrPlan: string;
  readonly commercialUseBasis: string;
  readonly dataUseOrTrainingSetting: string;
  readonly knownProviderRestrictions: string;
  readonly similarityOrContaminationReviewResult: string;
  readonly reviewerThirdPartyRightsDecision: string;
  readonly approvedPublicAttributionOrDisclosureText: string;
  readonly acquisitionOrReviewerDecision: string;
}

export interface ProjectOwnedHumanEvidenceRecord extends CommonEvidenceRecord {
  readonly sourceClass: "project-owned-human";
  readonly creationOrCommissionBasis: string;
  readonly recordedProjectAuthorization: string;
}

export type EvidenceRecord =
  | StackOverflowEvidenceRecord
  | ModelOutputEvidenceRecord
  | ProjectOwnedHumanEvidenceRecord
  | LicensedGitHubEvidenceRecord;

const STACK = ["sourceUrl", "postId", "revisionId", "author", "contributionOrRevisionDate",
  "applicableLicense", "licenseVersion", "acquisitionBasis",
  "firstDisplayAttributionDecision", "approvedRevealAttribution"] as const;
const MODEL = ["provider", "model", "generationDate", "promptProvenanceOrApprovedRedactedEvidence",
  "availableGenerationParameters", "rawOutputHash", "providerTermsVersion",
  "generatingAccountOrPlan", "commercialUseBasis", "dataUseOrTrainingSetting",
  "knownProviderRestrictions", "similarityOrContaminationReviewResult",
  "reviewerThirdPartyRightsDecision", "approvedPublicAttributionOrDisclosureText",
  "acquisitionOrReviewerDecision"] as const;
const HUMAN = ["creationOrCommissionBasis", "recordedProjectAuthorization"] as const;
function historical<T extends CommonEvidenceRecord>(
  input: unknown, expected: EvidenceSourceClass, fields: readonly string[],
): T {
  const record = requireObject(input, `${expected} evidence record`);
  requireExact(record, [...COMMON_EVIDENCE_FIELDS, ...fields]);
  const base = parseCommonEvidenceFields(record);
  if (base.sourceClass !== expected) throw new TypeError(`sourceClass must be ${expected}`);
  const additions = Object.fromEntries(fields.map((field) => [
    field,
    requireText(record, field),
  ]));
  return Object.freeze({ ...base, sourceClass: expected, ...additions }) as T;
}

export function parseCommonEvidenceRecord(input: unknown): CommonEvidenceRecord {
  const record = requireObject(input, "evidence record");
  requireExact(record, COMMON_EVIDENCE_FIELDS);
  return parseCommonEvidenceFields(record);
}

export const parseStackOverflowEvidenceRecord = (input: unknown): StackOverflowEvidenceRecord =>
  historical(input, "stack-overflow", STACK);
export const parseModelOutputEvidenceRecord = (input: unknown): ModelOutputEvidenceRecord =>
  historical(input, "model-output", MODEL);
export const parseProjectOwnedHumanEvidenceRecord = (
  input: unknown,
): ProjectOwnedHumanEvidenceRecord => historical(input, "project-owned-human", HUMAN);

export function parseEvidenceRecord(input: unknown): EvidenceRecord {
  const record = requireObject(input, "evidence record");
  switch (requireText(record, "sourceClass")) {
    case "stack-overflow": return parseStackOverflowEvidenceRecord(record);
    case "model-output": return parseModelOutputEvidenceRecord(record);
    case "project-owned-human": return parseProjectOwnedHumanEvidenceRecord(record);
    case "licensed-github": return parseLicensedGitHubEvidenceRecord(record);
    default: throw new TypeError("sourceClass must identify a supported evidence source");
  }
}
