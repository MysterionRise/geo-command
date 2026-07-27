import {
  requireSection,
  requireStringList,
  requireText,
  type UnknownRecord,
} from "./record-validation";

export type EvidenceSourceClass =
  | "stack-overflow"
  | "model-output"
  | "project-owned-human"
  | "licensed-github";

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

export const COMMON_EVIDENCE_FIELDS = [
  "stableId", "sourceClass", "contentHash", "excerpt", "acquisitionMethod",
  "acquisitionDate", "evidenceReference", "creatorOrSourceIdentity",
  "ownershipLicenseAuthorizationBasis", "reviewerIdentities", "reviewerDates",
  "eligibilityDecision", "attributionOrDisclosureText", "correctionState",
  "publicationStatus",
] as const;

const SOURCE_CLASSES: readonly EvidenceSourceClass[] = [
  "stack-overflow",
  "model-output",
  "project-owned-human",
  "licensed-github",
];

export function parseCommonEvidenceFields(record: UnknownRecord): CommonEvidenceRecord {
  const reference = requireSection(
    record,
    "evidenceReference",
    ["artifactId", "versionId"],
  );
  const sourceClass = requireText(record, "sourceClass") as EvidenceSourceClass;
  if (!SOURCE_CLASSES.includes(sourceClass)) {
    throw new TypeError("sourceClass must identify a supported evidence source");
  }
  return Object.freeze({
    stableId: requireText(record, "stableId"),
    sourceClass,
    contentHash: requireText(record, "contentHash"),
    excerpt: requireText(record, "excerpt"),
    acquisitionMethod: requireText(record, "acquisitionMethod"),
    acquisitionDate: requireText(record, "acquisitionDate"),
    evidenceReference: Object.freeze({
      artifactId: requireText(reference, "artifactId", "evidenceReference."),
      versionId: requireText(reference, "versionId", "evidenceReference."),
    }),
    creatorOrSourceIdentity: requireText(record, "creatorOrSourceIdentity"),
    ownershipLicenseAuthorizationBasis: requireText(
      record,
      "ownershipLicenseAuthorizationBasis",
    ),
    reviewerIdentities: requireStringList(record, "reviewerIdentities"),
    reviewerDates: requireStringList(record, "reviewerDates"),
    eligibilityDecision: requireText(record, "eligibilityDecision"),
    attributionOrDisclosureText: requireText(record, "attributionOrDisclosureText"),
    correctionState: requireText(record, "correctionState"),
    publicationStatus: requireText(record, "publicationStatus"),
  });
}
