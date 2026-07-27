import { createHash } from "node:crypto";

export class DraftError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "DraftError";
  }
}
const fail = (code: string): never => {
  throw new DraftError(code);
};
const H40 = /^[0-9a-f]{40}$/u;
const H64 = /^[0-9a-f]{64}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SCREENING_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const ROOT = ["acquisition", "attribution", "diff", "languageProposal", "license", "operator", "policy", "run", "source"];
const GROUPS: Record<string, readonly string[]> = {
  run: ["draftIdempotencyKey", "schemaHash", "schemaVersion", "toolHash", "toolId", "toolVersion"],
  source: [
    "childBlob", "childCommit", "childNormalizedHash", "childRawHash", "childTree",
    "commitUrl", "parentBlob", "parentCommit", "parentNormalizedHash", "parentRawHash",
    "parentTree", "path", "repository", "repositoryId", "repositoryMetadataHash",
    "sourceUrl", "subtree",
  ],
  acquisition: [
    "checkpointHash", "observationTime", "purpose", "receiptTime", "retentionDeadline",
    "screeningOutcomes", "snapshotIds",
  ],
  license: [
    "blobSha", "identifier", "path", "repositoryPolicyHash",
    "repositoryPolicyVersion", "textHash",
  ],
  attribution: ["evidence", "policyHash", "policyVersion"],
  policy: [
    "attributionEntryId", "registerHash", "registerVersion", "repositoryEntryId",
  ],
  operator: ["entryId", "name", "osIdentity", "registerHash", "registerVersion"],
};
const SHA40_FIELDS = [
  "childBlob", "childCommit", "childTree", "parentBlob", "parentCommit", "parentTree", "blobSha",
];
const SHA64_FIELDS = [
  "schemaHash", "toolHash", "childNormalizedHash", "childRawHash", "parentNormalizedHash",
  "parentRawHash", "repositoryMetadataHash", "checkpointHash", "textHash",
  "repositoryPolicyHash", "policyHash", "registerHash",
];

type JsonObject = Record<string, unknown>;
type DraftInput = JsonObject & {
  readonly acquisition: JsonObject;
  readonly attribution: JsonObject;
  readonly source: JsonObject;
  readonly run: JsonObject;
};
export interface AcquisitionDraft {
  readonly state: "DRAFT_REVIEW_REQUIRED";
  readonly draftId: string;
  readonly draftHash: string;
  readonly input: DraftInput;
}
const exact = (value: unknown, fields: readonly string[]): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...fields].sort().join("|");

const validateGroups = (input: JsonObject): void => {
  for (const [group, fields] of Object.entries(GROUPS)) {
    if (!exact(input[group], fields)) fail("DRAFT_FIELDS_REJECTED");
  }
  const values = Object.keys(GROUPS).map((group) => input[group] as JsonObject);
  for (const group of values) {
    for (const [field, value] of Object.entries(group)) {
      if (
        !["evidence", "screeningOutcomes", "snapshotIds"].includes(field)
        && (typeof value !== "string" || value.length === 0)
      ) fail("DRAFT_IDENTITY_REJECTED");
    }
    for (const field of SHA40_FIELDS) {
      if (field in group && !H40.test(group[field] as string)) fail("DRAFT_IDENTITY_REJECTED");
    }
    for (const field of SHA64_FIELDS) {
      if (field in group && !H64.test(group[field] as string)) fail("DRAFT_IDENTITY_REJECTED");
    }
  }
};

const validateSource = (source: JsonObject): void => {
  const repository = source.repository as string;
  const childCommit = source.childCommit as string;
  const subtree = source.subtree as string;
  const path = source.path as string;
  if (
    !/^[a-z0-9._-]+\/[a-z0-9._-]+$/u.test(repository)
    || path !== `${subtree}/${path.slice(subtree.length + 1)}`
    || !path.startsWith(`${subtree}/`)
    || /(?:^|\/)\.{1,2}(?:\/|$)|\\|\/\//u.test(path)
    || source.childCommit === source.parentCommit
    || source.commitUrl !== `https://github.com/${repository}/commit/${childCommit}`
    || source.sourceUrl !== `https://github.com/${repository}/blob/${childCommit}/${path}`
  ) fail("DRAFT_SOURCE_REJECTED");
};

const validateLanguageProposal = (value: unknown): void => {
  const proposal = exact(
    value,
    ["decision", "detectorVersion", "proposalHash", "proposedLanguage"],
  ) ? value : fail("DRAFT_FIELDS_REJECTED");
  if (
    proposal.decision !== "HUMAN_REVIEW_REQUIRED"
    || !H64.test(proposal.proposalHash as string)
    || [proposal.detectorVersion, proposal.proposedLanguage].some(
      (text) => typeof text !== "string" || text.length === 0)
  ) fail("DRAFT_IDENTITY_REJECTED");
};

const validateDiff = (value: unknown, source: JsonObject): void => {
  const fields = [
    "algorithmVersion", "changedLineNumbers", "changedLinesHash", "childBlob",
    "childNormalizedHash", "endLine", "excerptHash", "parentBlob",
    "parentNormalizedHash", "startLine",
  ];
  const diff = exact(value, fields) ? value : fail("DRAFT_FIELDS_REJECTED");
  const changedLines = Array.isArray(diff.changedLineNumbers)
    ? diff.changedLineNumbers : fail("DRAFT_IDENTITY_REJECTED");
  if (
    diff.algorithmVersion !== "line-sequence-v1"
    || !Number.isInteger(diff.startLine) || !Number.isInteger(diff.endLine)
    || (diff.startLine as number) < 1 || (diff.endLine as number) < (diff.startLine as number)
    || (diff.endLine as number) - (diff.startLine as number) + 1 > 21
    || changedLines.length === 0
    || changedLines.some((line, index) =>
      !Number.isInteger(line)
      || (line as number) < (diff.startLine as number)
      || (line as number) > (diff.endLine as number)
      || (index > 0 && (changedLines[index - 1] as number) >= (line as number)))
    || diff.childBlob !== source.childBlob || diff.parentBlob !== source.parentBlob
    || diff.childNormalizedHash !== source.childNormalizedHash
    || diff.parentNormalizedHash !== source.parentNormalizedHash
    || diff.childBlob === diff.parentBlob
    || diff.childNormalizedHash === diff.parentNormalizedHash
    || !H64.test(diff.changedLinesHash as string)
    || !H64.test(diff.excerptHash as string)
  ) fail("DRAFT_IDENTITY_REJECTED");
};

const validateAttribution = (value: unknown, purpose: unknown): void => {
  if (purpose === "LANGUAGE_CANDIDATE") {
    if (!exact(value, ["kind"]) || value.kind !== "LANGUAGE_ONLY_NOT_APPLICABLE") {
      fail("DRAFT_EVIDENCE_INCOMPATIBLE");
    }
    return;
  }
  const common = [
    "author", "classification", "commitMessageHash", "committer", "evidenceHash",
    "kind", "parsedMarker", "publicPhrase", "ruleBindingHash", "ruleId",
    "vendorSessionDecision", "verification",
  ];
  const candidate = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : fail("DRAFT_FIELDS_REJECTED");
  const named = candidate.kind === "NAMED_MODEL_RECORDED";
  const marker = candidate.parsedMarker !== null;
  const fields = named
    ? [...common, "modelName"]
    : marker
      ? common
      : [...common, "accountAttribution"];
  const evidence = exact(candidate, fields) ? candidate : fail("DRAFT_FIELDS_REJECTED");
  const identityFields = ["name", "login"];
  const author = exact(evidence.author, identityFields)
    ? evidence.author : fail("DRAFT_FIELDS_REJECTED");
  const committer = exact(evidence.committer, identityFields)
    ? evidence.committer : fail("DRAFT_FIELDS_REJECTED");
  const verification = exact(evidence.verification, ["reason", "verified"])
    ? evidence.verification : fail("DRAFT_FIELDS_REJECTED");
  const bounded = (text: unknown): text is string =>
    typeof text === "string" && text.length > 0 && text.length <= 1024;
  if (
    evidence.kind !== evidence.classification
    || !["NAMED_MODEL_RECORDED", "AGENT_RECORDED"].includes(evidence.kind as string)
    || ["commitMessageHash", "evidenceHash", "ruleBindingHash"].some(
      (field) => !H64.test(evidence[field] as string))
    || ![evidence.ruleId, author.name, author.login, committer.name, committer.login,
      verification.reason].every(bounded)
    || typeof verification.verified !== "boolean"
    || (named && (!bounded(evidence.modelName)
      || evidence.publicPhrase !== evidence.modelName))
    || (!named && evidence.publicPhrase !== "AI coding agent")
    || (marker && (!bounded(evidence.parsedMarker)
      || evidence.vendorSessionDecision !== "NOT_APPLICABLE"))
    || (!marker && (named || evidence.parsedMarker !== null
      || evidence.vendorSessionDecision !== "VERIFIED_VENDOR_CONTROLLED_SESSION"
      || !bounded(evidence.accountAttribution)))
  ) fail("DRAFT_EVIDENCE_INCOMPATIBLE");
};

const validateInput: (raw: unknown) => asserts raw is DraftInput = (raw) => {
  const input = exact(raw, ROOT) ? raw as DraftInput : fail("DRAFT_FIELDS_REJECTED");
  validateGroups(input);
  validateSource(input.source);
  if (!H64.test(input.run.draftIdempotencyKey as string)) fail("DRAFT_IDENTITY_REJECTED");
  const acquisition = input.acquisition as JsonObject;
  for (const field of ["observationTime", "receiptTime", "retentionDeadline"]) {
    const time = acquisition[field];
    if (
      typeof time !== "string" || !UTC.test(time)
      || new Date(time).toISOString() !== time.replace("Z", ".000Z")
    ) fail("DRAFT_IDENTITY_REJECTED");
  }
  for (const field of ["screeningOutcomes", "snapshotIds"]) {
    const values = acquisition[field];
    const strings = Array.isArray(values) ? values : fail("DRAFT_IDENTITY_REJECTED");
    if (
      strings.length === 0
      || strings.some((value) => typeof value !== "string"
        || !(field === "screeningOutcomes" ? SCREENING_CODE : SAFE_ID).test(value))
    ) {
      fail("DRAFT_IDENTITY_REJECTED");
    }
    if (new Set(strings).size !== strings.length) fail("DUPLICATE_DRAFT_IDENTITY");
  }
  const evidence = (input.attribution as JsonObject).evidence as JsonObject;
  const purpose = acquisition.purpose;
  if (purpose === "LANGUAGE_CANDIDATE") validateLanguageProposal(input.languageProposal);
  else if (purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE") {
    if (input.languageProposal !== null) fail("DRAFT_EVIDENCE_INCOMPATIBLE");
    validateDiff(input.diff, input.source);
  }
  validateAttribution(evidence, purpose);
  if (
    (purpose === "LANGUAGE_CANDIDATE"
      && (input.diff !== null || evidence?.kind !== "LANGUAGE_ONLY_NOT_APPLICABLE"))
    || (purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
      && (input.diff === null
        || !["NAMED_MODEL_RECORDED", "AGENT_RECORDED"].includes(evidence?.kind as string)))
    || !["LANGUAGE_CANDIDATE", "RECORDED_AGENT_PARTICIPATION_CANDIDATE"].includes(
      purpose as string,
    )
  ) fail("DRAFT_EVIDENCE_INCOMPATIBLE");
};

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as JsonObject).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
};
const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(canonical(value));

export const createAcquisitionDraft = (rawInput: unknown): AcquisitionDraft => {
  validateInput(rawInput);
  const input = JSON.parse(canonical(rawInput)) as DraftInput;
  const payload = { state: "DRAFT_REVIEW_REQUIRED" as const, input };
  const draftHash = createHash("sha256").update(bytes(payload)).digest("hex");
  return deepFreeze({
    ...payload,
    draftId: `draft:${input.run.draftIdempotencyKey as string}`,
    draftHash,
  });
};

export const serializeAcquisitionDraft = (draft: AcquisitionDraft): Uint8Array => bytes(draft);
