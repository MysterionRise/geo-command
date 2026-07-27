export type EvidenceSourceClass =
  | "stack-overflow"
  | "model-output"
  | "project-owned-human";

export interface ImmutableEvidenceReference {
  readonly artifactId: string;
  readonly versionId: string;
}

export interface CommonEvidenceRecord {
  readonly stableId: string;
  readonly sourceClass: EvidenceSourceClass;
  readonly contentHash: string;
  readonly excerpt: string;
  readonly acquisitionMethod: string;
  readonly acquisitionDate: string;
  readonly evidenceReference: ImmutableEvidenceReference;
  readonly creatorOrSourceIdentity: string;
  readonly ownershipLicenseAuthorizationBasis: string;
  readonly reviewerIdentities: readonly string[];
  readonly reviewerDates: readonly string[];
  readonly eligibilityDecision: string;
  readonly attributionOrDisclosureText: string;
  readonly correctionState: string;
  readonly publicationStatus: string;
}

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
  | ProjectOwnedHumanEvidenceRecord;

type UnknownRecord = Record<string, unknown>;

const SOURCE_CLASSES: readonly EvidenceSourceClass[] = [
  "stack-overflow",
  "model-output",
  "project-owned-human",
];

function requireObject(value: unknown, field: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value as UnknownRecord;
}

function requireString(
  record: UnknownRecord,
  field: string,
  diagnosticField: string = field,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${diagnosticField} must be a non-blank string`);
  }
  return value;
}

function requireStringList(record: UnknownRecord, field: string): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string list`);
  }

  const copy = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new TypeError(`${field}[${index}] must be a non-blank string`);
    }
    return entry;
  });
  return Object.freeze(copy);
}

function requireSourceClass(record: UnknownRecord): EvidenceSourceClass {
  const sourceClass = requireString(record, "sourceClass");
  if (!SOURCE_CLASSES.includes(sourceClass as EvidenceSourceClass)) {
    throw new TypeError("sourceClass must identify a supported evidence source");
  }
  return sourceClass as EvidenceSourceClass;
}

function requireEvidenceReference(record: UnknownRecord): ImmutableEvidenceReference {
  const reference = requireObject(record.evidenceReference, "evidenceReference");
  return Object.freeze({
    artifactId: requireString(reference, "artifactId", "evidenceReference.artifactId"),
    versionId: requireString(reference, "versionId", "evidenceReference.versionId"),
  });
}

function assertSourceClass(
  record: CommonEvidenceRecord,
  expected: EvidenceSourceClass,
): void {
  if (record.sourceClass !== expected) {
    throw new TypeError(`sourceClass must be ${expected}`);
  }
}

export function parseCommonEvidenceRecord(input: unknown): CommonEvidenceRecord {
  const record = requireObject(input, "evidence record");
  return Object.freeze({
    stableId: requireString(record, "stableId"),
    sourceClass: requireSourceClass(record),
    contentHash: requireString(record, "contentHash"),
    excerpt: requireString(record, "excerpt"),
    acquisitionMethod: requireString(record, "acquisitionMethod"),
    acquisitionDate: requireString(record, "acquisitionDate"),
    evidenceReference: requireEvidenceReference(record),
    creatorOrSourceIdentity: requireString(record, "creatorOrSourceIdentity"),
    ownershipLicenseAuthorizationBasis: requireString(
      record,
      "ownershipLicenseAuthorizationBasis",
    ),
    reviewerIdentities: requireStringList(record, "reviewerIdentities"),
    reviewerDates: requireStringList(record, "reviewerDates"),
    eligibilityDecision: requireString(record, "eligibilityDecision"),
    attributionOrDisclosureText: requireString(record, "attributionOrDisclosureText"),
    correctionState: requireString(record, "correctionState"),
    publicationStatus: requireString(record, "publicationStatus"),
  });
}

export function parseStackOverflowEvidenceRecord(input: unknown): StackOverflowEvidenceRecord {
  const record = requireObject(input, "Stack Overflow evidence record");
  const common = parseCommonEvidenceRecord(record);
  assertSourceClass(common, "stack-overflow");

  return Object.freeze({
    ...common,
    sourceClass: "stack-overflow",
    sourceUrl: requireString(record, "sourceUrl"),
    postId: requireString(record, "postId"),
    revisionId: requireString(record, "revisionId"),
    author: requireString(record, "author"),
    contributionOrRevisionDate: requireString(record, "contributionOrRevisionDate"),
    applicableLicense: requireString(record, "applicableLicense"),
    licenseVersion: requireString(record, "licenseVersion"),
    acquisitionBasis: requireString(record, "acquisitionBasis"),
    firstDisplayAttributionDecision: requireString(
      record,
      "firstDisplayAttributionDecision",
    ),
    approvedRevealAttribution: requireString(record, "approvedRevealAttribution"),
  });
}

export function parseModelOutputEvidenceRecord(input: unknown): ModelOutputEvidenceRecord {
  const record = requireObject(input, "model-output evidence record");
  const common = parseCommonEvidenceRecord(record);
  assertSourceClass(common, "model-output");

  return Object.freeze({
    ...common,
    sourceClass: "model-output",
    provider: requireString(record, "provider"),
    model: requireString(record, "model"),
    generationDate: requireString(record, "generationDate"),
    promptProvenanceOrApprovedRedactedEvidence: requireString(
      record,
      "promptProvenanceOrApprovedRedactedEvidence",
    ),
    availableGenerationParameters: requireString(record, "availableGenerationParameters"),
    rawOutputHash: requireString(record, "rawOutputHash"),
    providerTermsVersion: requireString(record, "providerTermsVersion"),
    generatingAccountOrPlan: requireString(record, "generatingAccountOrPlan"),
    commercialUseBasis: requireString(record, "commercialUseBasis"),
    dataUseOrTrainingSetting: requireString(record, "dataUseOrTrainingSetting"),
    knownProviderRestrictions: requireString(record, "knownProviderRestrictions"),
    similarityOrContaminationReviewResult: requireString(
      record,
      "similarityOrContaminationReviewResult",
    ),
    reviewerThirdPartyRightsDecision: requireString(
      record,
      "reviewerThirdPartyRightsDecision",
    ),
    approvedPublicAttributionOrDisclosureText: requireString(
      record,
      "approvedPublicAttributionOrDisclosureText",
    ),
    acquisitionOrReviewerDecision: requireString(record, "acquisitionOrReviewerDecision"),
  });
}

export function parseProjectOwnedHumanEvidenceRecord(
  input: unknown,
): ProjectOwnedHumanEvidenceRecord {
  const record = requireObject(input, "project-owned-human evidence record");
  const common = parseCommonEvidenceRecord(record);
  assertSourceClass(common, "project-owned-human");

  return Object.freeze({
    ...common,
    sourceClass: "project-owned-human",
    creationOrCommissionBasis: requireString(record, "creationOrCommissionBasis"),
    recordedProjectAuthorization: requireString(record, "recordedProjectAuthorization"),
  });
}

export function parseEvidenceRecord(input: unknown): EvidenceRecord {
  const record = requireObject(input, "evidence record");
  switch (requireSourceClass(record)) {
    case "stack-overflow":
      return parseStackOverflowEvidenceRecord(record);
    case "model-output":
      return parseModelOutputEvidenceRecord(record);
    case "project-owned-human":
      return parseProjectOwnedHumanEvidenceRecord(record);
  }
}
