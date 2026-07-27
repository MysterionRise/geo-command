import {
  COMMON_EVIDENCE_FIELDS,
  parseCommonEvidenceFields,
} from "./common-evidence";
import {
  requireExact,
  requireGitSha,
  requireInstant,
  requireMatch,
  requireObject,
  requireSection,
  requireSha256,
  requireStringList,
  requireText,
  type UnknownRecord,
} from "./record-validation";
import type {
  AcquisitionPurpose,
  LanguageMarkerDecision,
  LicensedGitHubEvidenceRecord,
  RecordedMarkerEvidence,
} from "./licensed-github-types";
export type {
  AcquisitionPurpose,
  LanguageMarkerDecision,
  LicensedGitHubEvidenceRecord,
  RecordedMarkerEvidence,
} from "./licensed-github-types";

const LICENSED_SECTIONS = [
  "repository", "revision", "acquisition", "license", "marker",
  "screeningOutcomes", "storage", "rights", "lineage", "policyAuthorization",
  "operatorAuthorization",
] as const;
const REVISION_FIELDS = [
  "childCommitSha", "parentCommitSha", "childTreeSha", "parentTreeSha",
  "approvedSubtree", "path", "childBlobSha", "parentBlobSha", "sourceUrl",
  "commitUrl", "childRawSha256", "parentRawSha256", "childNormalizedSha256",
  "parentNormalizedSha256",
] as const;
const NORMALIZED_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/u;

function parseRepository(record: UnknownRecord): LicensedGitHubEvidenceRecord["repository"] {
  const value = requireSection(record, "repository", ["owner", "name", "immutableId"]);
  return Object.freeze({
    owner: requireMatch(value, "owner", /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u, "repository."),
    name: requireMatch(value, "name", /^[a-z0-9._-]+$/u, "repository."),
    immutableId: requireText(value, "immutableId", "repository."),
  });
}

function parseRevision(
  record: UnknownRecord,
  repository: LicensedGitHubEvidenceRecord["repository"],
): LicensedGitHubEvidenceRecord["revision"] {
  const value = requireSection(record, "revision", REVISION_FIELDS);
  const child = requireGitSha(value, "childCommitSha", "revision.");
  for (const field of ["parentCommitSha", "childTreeSha", "parentTreeSha",
    "childBlobSha", "parentBlobSha"]) requireGitSha(value, field, "revision.");
  for (const field of ["childRawSha256", "parentRawSha256",
    "childNormalizedSha256", "parentNormalizedSha256"]) {
    requireSha256(value, field, "revision.");
  }
  const subtree = requireMatch(value, "approvedSubtree", NORMALIZED_PATH, "revision.");
  const path = requireMatch(value, "path", NORMALIZED_PATH, "revision.");
  if (path !== subtree && !path.startsWith(`${subtree}/`)) {
    throw new TypeError("revision.path must be inside revision.approvedSubtree");
  }
  const root = `https://github.com/${repository.owner}/${repository.name}`;
  if (requireText(value, "sourceUrl", "revision.") !== `${root}/blob/${child}/${path}`) {
    throw new TypeError("revision.sourceUrl has an invalid immutable value");
  }
  if (requireText(value, "commitUrl", "revision.") !== `${root}/commit/${child}`) {
    throw new TypeError("revision.commitUrl has an invalid immutable value");
  }
  return Object.freeze(Object.fromEntries(
    REVISION_FIELDS.map((field) => [field, value[field]]),
  )) as LicensedGitHubEvidenceRecord["revision"];
}

function parseAcquisition(
  record: UnknownRecord,
): LicensedGitHubEvidenceRecord["acquisition"] {
  const value = requireSection(record, "acquisition", [
    "purpose", "observationTime", "authoritativeReceiptTime",
    "repositoryMetadataSnapshotHash", "checkpointHash", "draftIdentifier", "draftHash",
  ]);
  const purpose = requireText(value, "purpose", "acquisition.") as AcquisitionPurpose;
  if (!["LANGUAGE_CANDIDATE", "RECORDED_AGENT_PARTICIPATION_CANDIDATE"].includes(purpose)) {
    throw new TypeError("acquisition.purpose has an invalid immutable value");
  }
  return Object.freeze({
    purpose,
    observationTime: requireInstant(value, "observationTime", "acquisition."),
    authoritativeReceiptTime: requireInstant(
      value,
      "authoritativeReceiptTime",
      "acquisition.",
    ),
    repositoryMetadataSnapshotHash: requireSha256(
      value,
      "repositoryMetadataSnapshotHash",
      "acquisition.",
    ),
    checkpointHash: requireSha256(value, "checkpointHash", "acquisition."),
    draftIdentifier: requireText(value, "draftIdentifier", "acquisition."),
    draftHash: requireSha256(value, "draftHash", "acquisition."),
  });
}

function parseLicense(record: UnknownRecord): LicensedGitHubEvidenceRecord["license"] {
  const value = requireSection(record, "license", [
    "identifier", "filePath", "blobSha", "textHash",
    "repositoryAdmissionPolicyVersion", "repositoryAdmissionPolicyHash",
  ]);
  return Object.freeze({
    identifier: requireText(value, "identifier", "license."),
    filePath: requireMatch(value, "filePath", NORMALIZED_PATH, "license."),
    blobSha: requireGitSha(value, "blobSha", "license."),
    textHash: requireSha256(value, "textHash", "license."),
    repositoryAdmissionPolicyVersion: requireText(
      value,
      "repositoryAdmissionPolicyVersion",
      "license.",
    ),
    repositoryAdmissionPolicyHash: requireSha256(
      value,
      "repositoryAdmissionPolicyHash",
      "license.",
    ),
  });
}

function parseLanguageMarker(marker: UnknownRecord): LanguageMarkerDecision {
  requireExact(marker, [
    "status", "attributionMarkerPolicyVersion", "attributionMarkerPolicyHash", "decision",
  ], "marker.");
  return Object.freeze({
    status: "language-only-not-applicable",
    attributionMarkerPolicyVersion: requireText(
      marker,
      "attributionMarkerPolicyVersion",
      "marker.",
    ),
    attributionMarkerPolicyHash: requireSha256(
      marker,
      "attributionMarkerPolicyHash",
      "marker.",
    ),
    decision: requireText(marker, "decision", "marker."),
  });
}

function parseRecordedMarker(marker: UnknownRecord): RecordedMarkerEvidence {
  requireExact(marker, [
    "status", "attributionMarkerPolicyVersion", "attributionMarkerPolicyHash",
    "classification", "recordedModelName", "policyRule", "commitAuthor", "committer",
    "signatureVerificationResult", "commitMessageHash", "parsedMarker",
    "vendorSessionReference",
  ], "marker.");
  const classification = requireText(marker, "classification", "marker.");
  if (!["NAMED_MODEL_RECORDED", "AGENT_RECORDED"].includes(classification)) {
    throw new TypeError("marker.classification has an invalid value");
  }
  const recordedModelName = marker.recordedModelName;
  if (classification === "NAMED_MODEL_RECORDED") {
    requireText(marker, "recordedModelName", "marker.");
  } else if (recordedModelName !== null) {
    throw new TypeError("marker.recordedModelName must be null for generic agent evidence");
  }
  const session = marker.vendorSessionReference;
  if (session !== null && typeof session !== "string") {
    throw new TypeError("marker.vendorSessionReference must be a string or null");
  }
  return Object.freeze({
    status: "accepted", classification, recordedModelName,
    attributionMarkerPolicyVersion: requireText(marker, "attributionMarkerPolicyVersion", "marker."),
    attributionMarkerPolicyHash: requireSha256(marker, "attributionMarkerPolicyHash", "marker."),
    policyRule: requireText(marker, "policyRule", "marker."),
    commitAuthor: requireText(marker, "commitAuthor", "marker."),
    committer: requireText(marker, "committer", "marker."),
    signatureVerificationResult: requireText(marker, "signatureVerificationResult", "marker."),
    commitMessageHash: requireSha256(marker, "commitMessageHash", "marker."),
    parsedMarker: requireText(marker, "parsedMarker", "marker."),
    vendorSessionReference: session,
  } as RecordedMarkerEvidence);
}

function parseMarker(
  value: unknown,
  purpose: AcquisitionPurpose,
): LicensedGitHubEvidenceRecord["marker"] {
  const marker = requireObject(value, "marker");
  const status = requireText(marker, "status", "marker.");
  if (status === "language-only-not-applicable" && purpose === "LANGUAGE_CANDIDATE") {
    return parseLanguageMarker(marker);
  }
  if (status === "accepted" && purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE") {
    return parseRecordedMarker(marker);
  }
  throw new TypeError("marker.status does not match acquisition.purpose");
}

function parseScreening(value: unknown): LicensedGitHubEvidenceRecord["screeningOutcomes"] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("screeningOutcomes must be a non-empty list");
  }
  return Object.freeze(value.map((entry, index) => {
    const item = requireObject(entry, `screeningOutcomes[${index}]`);
    requireExact(item, ["screen", "result"], `screeningOutcomes[${index}].`);
    return Object.freeze({
      screen: requireText(item, "screen", `screeningOutcomes[${index}].`),
      result: requireText(item, "result", `screeningOutcomes[${index}].`),
    });
  }));
}

function textSection(
  record: UnknownRecord,
  field: string,
  fields: readonly string[],
): Readonly<UnknownRecord> {
  const value = requireSection(record, field, fields);
  return Object.freeze(Object.fromEntries(fields.map((name) => [
    name,
    requireText(value, name, `${field}.`),
  ])));
}

function parseAuthorization(
  record: UnknownRecord,
  field: string,
  fields: readonly string[],
): Readonly<UnknownRecord> {
  const value = requireSection(record, field, fields);
  return Object.freeze(Object.fromEntries(fields.map((name) => {
    if (name.endsWith("Hash")) return [name, requireSha256(value, name, `${field}.`)];
    if (name.endsWith("Identifiers")) {
      return [name, requireStringList(value, name, `${field}.`)];
    }
    return [name, requireText(value, name, `${field}.`)];
  })));
}

export function parseLicensedGitHubEvidenceRecord(
  input: unknown,
): LicensedGitHubEvidenceRecord {
  const record = requireObject(input, "licensed GitHub evidence record");
  requireExact(record, [...COMMON_EVIDENCE_FIELDS, ...LICENSED_SECTIONS]);
  const base = parseCommonEvidenceFields(record);
  if (base.sourceClass !== "licensed-github") {
    throw new TypeError("sourceClass must be licensed-github");
  }
  const repository = parseRepository(record);
  const acquisition = parseAcquisition(record);
  const storage = requireSection(record, "storage", [
    "rawSnapshotIdentifiers", "retentionDeadline",
  ]);
  return Object.freeze({
    ...base, sourceClass: "licensed-github", repository,
    revision: parseRevision(record, repository),
    acquisition,
    license: parseLicense(record),
    marker: parseMarker(record.marker, acquisition.purpose),
    screeningOutcomes: parseScreening(record.screeningOutcomes),
    storage: Object.freeze({
      rawSnapshotIdentifiers: requireStringList(
        storage,
        "rawSnapshotIdentifiers",
        "storage.",
      ),
      retentionDeadline: requireInstant(storage, "retentionDeadline", "storage."),
    }),
    rights: textSection(record, "rights", [
      "fileCoverageDecision", "noticeDecision",
      "redistributionDecision", "attributionTimingDecision",
      "embeddedThirdPartyVendorAssessment", "presentationDesignApproval",
    ]) as LicensedGitHubEvidenceRecord["rights"],
    lineage: textSection(record, "lineage", [
      "reviewLineage", "promotionIdentifier", "catalogueApprovalHash",
    ]) as LicensedGitHubEvidenceRecord["lineage"],
    policyAuthorization: parseAuthorization(record, "policyAuthorization", [
      "approvedPolicyRegisterVersion", "approvedPolicyRegisterHash",
      "authorizingEntryIdentifiers",
    ]) as LicensedGitHubEvidenceRecord["policyAuthorization"],
    operatorAuthorization: parseAuthorization(record, "operatorAuthorization", [
      "registerVersion", "registerHash", "entryIdentifier",
    ]) as LicensedGitHubEvidenceRecord["operatorAuthorization"],
  });
}
