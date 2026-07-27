import {
  parseCommonEvidenceRecord,
  parseEvidenceRecord,
  parseModelOutputEvidenceRecord,
  parseProjectOwnedHumanEvidenceRecord,
  parseStackOverflowEvidenceRecord,
} from "./records";

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: string | RegExp): void;
}

interface Each {
  <T extends readonly unknown[]>(
    cases: readonly T[],
  ): (name: string, callback: (...value: [...T]) => unknown) => void;
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

const commonRecord = {
  stableId: "content-001",
  sourceClass: "project-owned-human",
  contentHash: `sha256:${"a".repeat(64)}`,
  excerpt: "function add(a, b) { return a + b; }",
  acquisitionMethod: "project commission",
  acquisitionDate: "2026-07-13",
  evidenceReference: {
    artifactId: "evidence-001",
    versionId: `sha256:${"b".repeat(64)}`,
  },
  creatorOrSourceIdentity: "creator-001",
  ownershipLicenseAuthorizationBasis: "exclusive project authorization",
  reviewerIdentities: ["reviewer-001", "reviewer-002"],
  reviewerDates: ["2026-07-13", "2026-07-13"],
  eligibilityDecision: "eligible",
  attributionOrDisclosureText: "Created for this project.",
  correctionState: "current",
  publicationStatus: "approved",
} as const;

const stackOverflowRecord = {
  ...commonRecord,
  sourceClass: "stack-overflow",
  sourceUrl: "https://stackoverflow.com/questions/1/example",
  postId: "1",
  revisionId: "revision-3",
  author: "author-001",
  contributionOrRevisionDate: "2026-06-01",
  applicableLicense: "CC BY-SA",
  licenseVersion: "4.0",
  acquisitionBasis: "approved archive export",
  firstDisplayAttributionDecision: "not required by approved determination",
  approvedRevealAttribution: "Author on Stack Overflow, CC BY-SA 4.0",
} as const;

const modelOutputRecord = {
  ...commonRecord,
  sourceClass: "model-output",
  provider: "provider-001",
  model: "model-001",
  generationDate: "2026-07-01",
  promptProvenanceOrApprovedRedactedEvidence: "evidence://prompts/prompt-001@v1",
  availableGenerationParameters: "temperature=0.2; seed=17",
  rawOutputHash: `sha256:${"c".repeat(64)}`,
  providerTermsVersion: "2026-06-01",
  generatingAccountOrPlan: "commercial-plan-001",
  commercialUseBasis: "provider terms permit commercial use",
  dataUseOrTrainingSetting: "training disabled",
  knownProviderRestrictions: "none recorded",
  similarityOrContaminationReviewResult: "no material match found",
  reviewerThirdPartyRightsDecision: "approved",
  approvedPublicAttributionOrDisclosureText: "Generated with model-001.",
  acquisitionOrReviewerDecision: "acquired and approved",
} as const;

const projectOwnedHumanRecord = {
  ...commonRecord,
  sourceClass: "project-owned-human",
  creationOrCommissionBasis: "commissioned under contributor agreement",
  recordedProjectAuthorization: "authorization-001",
} as const;

const gitSha = (character: string): string => character.repeat(40);
const sha256 = (character: string): string => character.repeat(64);

const licensedGitHubRecord = {
  ...commonRecord,
  sourceClass: "licensed-github",
  repository: {
    owner: "example-owner",
    name: "example-repository",
    immutableId: "repository-123",
  },
  revision: {
    childCommitSha: gitSha("1"),
    parentCommitSha: gitSha("2"),
    childTreeSha: gitSha("3"),
    parentTreeSha: gitSha("4"),
    approvedSubtree: "src",
    path: "src/example.ts",
    childBlobSha: gitSha("5"),
    parentBlobSha: gitSha("6"),
    sourceUrl: `https://github.com/example-owner/example-repository/blob/${gitSha("1")}/src/example.ts`,
    commitUrl: `https://github.com/example-owner/example-repository/commit/${gitSha("1")}`,
    childRawSha256: sha256("a"),
    parentRawSha256: sha256("b"),
    childNormalizedSha256: sha256("c"),
    parentNormalizedSha256: sha256("d"),
  },
  acquisition: {
    purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    observationTime: "2026-07-27T12:00:00Z",
    authoritativeReceiptTime: "2026-07-27T12:00:01Z",
    repositoryMetadataSnapshotHash: sha256("e"),
    draftIdentifier: "draft-001",
  },
  license: {
    identifier: "MIT",
    filePath: "LICENSE",
    blobSha: gitSha("7"),
    textHash: sha256("f"),
    repositoryAdmissionPolicyVersion: "repository-policy-v1",
    repositoryAdmissionPolicyHash: sha256("8"),
  },
  marker: {
    status: "accepted",
    attributionMarkerPolicyVersion: "marker-policy-v1",
    attributionMarkerPolicyHash: sha256("9"),
    classification: "AGENT_RECORDED",
    recordedModelName: null,
    policyRule: "vendor-agent-trailer-v1",
    commitAuthor: "Example Author <author@example.invalid>",
    committer: "Example Committer <committer@example.invalid>",
    signatureVerificationResult: "verified",
    commitMessageHash: sha256("0"),
    parsedMarker: "Co-Authored-By: Example Agent",
    vendorSessionReference: "https://vendor.example/sessions/123",
  },
  screeningOutcomes: [
    { screen: "binary", result: "passed" },
    { screen: "secret-like-material", result: "passed" },
  ],
  storage: {
    rawSnapshotIdentifiers: ["snapshot-commit-001", "snapshot-blob-001"],
    retentionDeadline: "2026-08-26T12:00:01Z",
  },
  rights: {
    fileCoverageDecision: "approved",
    noticeDecision: "include approved MIT notice at reveal",
    redistributionDecision: "approved for excerpt display",
    attributionTimingDecision: "approved for reveal",
  },
  lineage: {
    reviewLineage: "review-lineage-001",
    promotionIdentifier: "promotion-001",
  },
  policyAuthorization: {
    approvedPolicyRegisterVersion: "approved-policy-register-v1",
    approvedPolicyRegisterHash: sha256("1"),
    authorizingEntryIdentifiers: [
      "repository-policy-entry-001",
      "marker-policy-entry-001",
    ],
  },
  operatorAuthorization: {
    registerVersion: "operator-register-v1",
    registerHash: sha256("2"),
    entryIdentifier: "operator-entry-001",
  },
} as const;

const commonRequiredFields = [
  "stableId",
  "sourceClass",
  "contentHash",
  "excerpt",
  "acquisitionMethod",
  "acquisitionDate",
  "evidenceReference",
  "creatorOrSourceIdentity",
  "ownershipLicenseAuthorizationBasis",
  "reviewerIdentities",
  "reviewerDates",
  "eligibilityDecision",
  "attributionOrDisclosureText",
  "correctionState",
  "publicationStatus",
] as const;

const stackOverflowRequiredFields = [
  ...commonRequiredFields,
  "sourceUrl",
  "postId",
  "revisionId",
  "author",
  "contributionOrRevisionDate",
  "applicableLicense",
  "licenseVersion",
  "acquisitionBasis",
  "firstDisplayAttributionDecision",
  "approvedRevealAttribution",
] as const;

const modelOutputRequiredFields = [
  ...commonRequiredFields,
  "provider",
  "model",
  "generationDate",
  "promptProvenanceOrApprovedRedactedEvidence",
  "availableGenerationParameters",
  "rawOutputHash",
  "providerTermsVersion",
  "generatingAccountOrPlan",
  "commercialUseBasis",
  "dataUseOrTrainingSetting",
  "knownProviderRestrictions",
  "similarityOrContaminationReviewResult",
  "reviewerThirdPartyRightsDecision",
  "approvedPublicAttributionOrDisclosureText",
  "acquisitionOrReviewerDecision",
] as const;

const projectOwnedHumanRequiredFields = [
  ...commonRequiredFields,
  "creationOrCommissionBasis",
  "recordedProjectAuthorization",
] as const;

type Parser = (input: unknown) => unknown;

function withoutField(record: object, field: string): Record<string, unknown> {
  const copy = { ...record } as Record<string, unknown>;
  delete copy[field];
  return copy;
}

function withBlankField(record: object, field: string): Record<string, unknown> {
  const copy = { ...record } as Record<string, unknown>;
  const value = copy[field];
  copy[field] = Array.isArray(value) ? [] : typeof value === "object" ? {} : "   ";
  return copy;
}

function requiredFieldContract(
  label: string,
  parser: Parser,
  validRecord: object,
  requiredFields: readonly string[],
): void {
  describe(`${label} required fields`, () => {
    it.each(requiredFields)("rejects a missing %s", (field) => {
      expect(() => parser(withoutField(validRecord, field))).toThrow(field);
    });

    it.each(requiredFields)("rejects a blank %s", (field) => {
      expect(() => parser(withBlankField(validRecord, field))).toThrow(field);
    });
  });
}

describe("evidence records", () => {
  it("parses valid common evidence as an immutable record", () => {
    const parsed = parseCommonEvidenceRecord(commonRecord);

    expect(parsed).toEqual(commonRecord);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.evidenceReference)).toBe(true);
    expect(Object.isFrozen(parsed.reviewerIdentities)).toBe(true);
    expect(Object.isFrozen(parsed.reviewerDates)).toBe(true);
  });

  it.each([
    {
      label: "Stack Overflow",
      parser: parseStackOverflowEvidenceRecord as Parser,
      record: stackOverflowRecord,
    },
    {
      label: "model output",
      parser: parseModelOutputEvidenceRecord as Parser,
      record: modelOutputRecord,
    },
    {
      label: "project-owned human",
      parser: parseProjectOwnedHumanEvidenceRecord as Parser,
      record: projectOwnedHumanRecord,
    },
  ] as const)("parses valid $label evidence as an immutable record", ({ parser, record }) => {
    const parsed = parser(record);

    expect(parsed).toEqual(record);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    stackOverflowRecord,
    modelOutputRecord,
    projectOwnedHumanRecord,
  ] as const)("dispatches a supported source-specific record", (record) => {
    expect(parseEvidenceRecord(record)).toEqual(record);
  });

  it("parses a complete licensed GitHub record and deeply freezes it", () => {
    const parsed = parseEvidenceRecord(licensedGitHubRecord);

    expect(parsed).toEqual(licensedGitHubRecord);
    for (const value of [
      parsed,
      parsed.evidenceReference,
      parsed.reviewerIdentities,
      parsed.reviewerDates,
      "repository" in parsed ? parsed.repository : null,
      "revision" in parsed ? parsed.revision : null,
      "acquisition" in parsed ? parsed.acquisition : null,
      "license" in parsed ? parsed.license : null,
      "marker" in parsed ? parsed.marker : null,
      "screeningOutcomes" in parsed ? parsed.screeningOutcomes : null,
      "screeningOutcomes" in parsed ? parsed.screeningOutcomes[0] : null,
      "storage" in parsed ? parsed.storage : null,
      "storage" in parsed ? parsed.storage.rawSnapshotIdentifiers : null,
      "rights" in parsed ? parsed.rights : null,
      "lineage" in parsed ? parsed.lineage : null,
      "policyAuthorization" in parsed ? parsed.policyAuthorization : null,
      "policyAuthorization" in parsed
        ? parsed.policyAuthorization.authorizingEntryIdentifiers
        : null,
      "operatorAuthorization" in parsed ? parsed.operatorAuthorization : null,
    ]) {
      expect(value === null || Object.isFrozen(value)).toBe(true);
    }
  });

  it.each([
    "repository",
    "revision",
    "acquisition",
    "license",
    "marker",
    "screeningOutcomes",
    "storage",
    "rights",
    "lineage",
    "policyAuthorization",
    "operatorAuthorization",
  ] as const)("rejects licensed GitHub evidence missing %s", (field) => {
    expect(() => parseEvidenceRecord(withoutField(licensedGitHubRecord, field))).toThrow(field);
  });

  it.each([
    ...["owner", "name", "immutableId"].map((field) => ["repository", field] as const),
    ...[
      "childCommitSha", "parentCommitSha", "childTreeSha", "parentTreeSha",
      "approvedSubtree", "path", "childBlobSha", "parentBlobSha", "sourceUrl",
      "commitUrl", "childRawSha256", "parentRawSha256", "childNormalizedSha256",
      "parentNormalizedSha256",
    ].map((field) => ["revision", field] as const),
    ...[
      "purpose", "observationTime", "authoritativeReceiptTime",
      "repositoryMetadataSnapshotHash", "draftIdentifier",
    ].map((field) => ["acquisition", field] as const),
    ...[
      "identifier", "filePath", "blobSha", "textHash",
      "repositoryAdmissionPolicyVersion", "repositoryAdmissionPolicyHash",
    ].map((field) => ["license", field] as const),
    ...[
      "status", "attributionMarkerPolicyVersion", "attributionMarkerPolicyHash",
      "classification", "recordedModelName", "policyRule", "commitAuthor", "committer",
      "signatureVerificationResult", "commitMessageHash", "parsedMarker",
      "vendorSessionReference",
    ].map((field) => ["marker", field] as const),
    ...["rawSnapshotIdentifiers", "retentionDeadline"].map(
      (field) => ["storage", field] as const,
    ),
    ...[
      "fileCoverageDecision", "noticeDecision", "redistributionDecision",
      "attributionTimingDecision",
    ].map((field) => ["rights", field] as const),
    ...["reviewLineage", "promotionIdentifier"].map(
      (field) => ["lineage", field] as const,
    ),
    ...[
      "approvedPolicyRegisterVersion", "approvedPolicyRegisterHash",
      "authorizingEntryIdentifiers",
    ].map((field) => ["policyAuthorization", field] as const),
    ...["registerVersion", "registerHash", "entryIdentifier"].map(
      (field) => ["operatorAuthorization", field] as const,
    ),
  ] as const)("rejects licensed GitHub evidence missing %s.%s", (section, field) => {
    const nested = licensedGitHubRecord[section];
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      [section]: withoutField(nested, field),
    })).toThrow(`${section}.${field}`);
  });

  it.each(["screen", "result"] as const)(
    "rejects licensed GitHub evidence missing screeningOutcomes[0].%s",
    (field) => {
      expect(() => parseEvidenceRecord({
        ...licensedGitHubRecord,
        screeningOutcomes: [
          withoutField(licensedGitHubRecord.screeningOutcomes[0], field),
        ],
      })).toThrow(`screeningOutcomes[0].${field}`);
    },
  );

  it("rejects unknown fields instead of silently changing the evidence shape", () => {
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      branch: "main",
    })).toThrow("unexpected field branch");
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      revision: { ...licensedGitHubRecord.revision, ref: "main" },
    })).toThrow("unexpected field revision.ref");
    expect(() => parseEvidenceRecord({
      ...projectOwnedHumanRecord,
      repository: licensedGitHubRecord.repository,
    })).toThrow("unexpected field repository");
  });

  it.each([
    {
      section: "revision",
      field: "childCommitSha",
      value: "main",
    },
    {
      section: "revision",
      field: "childTreeSha",
      value: gitSha("A"),
    },
    {
      section: "revision",
      field: "sourceUrl",
      value: "https://github.com/example-owner/example-repository/blob/main/src/example.ts",
    },
    {
      section: "acquisition",
      field: "purpose",
      value: "DISCOVER_REPOSITORIES",
    },
  ] as const)("rejects mutable or unsupported $section.$field", ({ section, field, value }) => {
    const nested = licensedGitHubRecord[section];
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      [section]: { ...nested, [field]: value },
    })).toThrow(`${section}.${field}`);
  });

  it("rejects a source path outside its approved subtree", () => {
    const path = "packages/example.ts";
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      revision: {
        ...licensedGitHubRecord.revision,
        path,
        sourceUrl: `https://github.com/example-owner/example-repository/blob/${gitSha("1")}/${path}`,
      },
    })).toThrow("revision.path must be inside revision.approvedSubtree");
  });

  it("rejects a license path that escapes the pinned tree", () => {
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      license: {
        ...licensedGitHubRecord.license,
        filePath: "../LICENSE",
      },
    })).toThrow("license.filePath");
  });

  it("preserves the language-only marker non-applicability decision", () => {
    const marker = {
      status: "language-only-not-applicable",
      attributionMarkerPolicyVersion: "marker-policy-v1",
      attributionMarkerPolicyHash: sha256("9"),
      decision: "Marker evidence is not applicable to this language candidate.",
    } as const;

    const parsed = parseEvidenceRecord({
      ...licensedGitHubRecord,
      acquisition: {
        ...licensedGitHubRecord.acquisition,
        purpose: "LANGUAGE_CANDIDATE",
      },
      marker,
    });

    expect("marker" in parsed ? parsed.marker : null).toEqual(marker);
  });

  it("preserves the exact recorded model name only for named-model evidence", () => {
    const marker = {
      ...licensedGitHubRecord.marker,
      classification: "NAMED_MODEL_RECORDED",
      recordedModelName: "Claude Sonnet 4",
    } as const;

    const parsed = parseEvidenceRecord({ ...licensedGitHubRecord, marker });

    expect("marker" in parsed ? parsed.marker : null).toEqual(marker);
  });

  it.each([
    {
      classification: "AGENT_RECORDED",
      recordedModelName: "Claude Sonnet 4",
    },
    {
      classification: "NAMED_MODEL_RECORDED",
      recordedModelName: null,
    },
  ] as const)(
    "rejects a model-name claim inconsistent with $classification",
    ({ classification, recordedModelName }) => {
      expect(() => parseEvidenceRecord({
        ...licensedGitHubRecord,
        marker: {
          ...licensedGitHubRecord.marker,
          classification,
          recordedModelName,
        },
      })).toThrow("marker.recordedModelName");
    },
  );

  it("rejects marker evidence that does not match the acquisition purpose", () => {
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      acquisition: {
        ...licensedGitHubRecord.acquisition,
        purpose: "LANGUAGE_CANDIDATE",
      },
    })).toThrow("marker.status does not match acquisition.purpose");
    expect(() => parseEvidenceRecord({
      ...licensedGitHubRecord,
      marker: {
        status: "language-only-not-applicable",
        attributionMarkerPolicyVersion: "marker-policy-v1",
        attributionMarkerPolicyHash: sha256("9"),
        decision: "Not applicable.",
      },
    })).toThrow("marker.status does not match acquisition.purpose");
  });

  it("rejects a common evidence reference without an immutable version identifier", () => {
    expect(() =>
      parseCommonEvidenceRecord({
        ...commonRecord,
        evidenceReference: { ...commonRecord.evidenceReference, versionId: " " },
      }),
    ).toThrow("evidenceReference.versionId");
  });

  it("rejects blank values inside the common reviewer identity list", () => {
    expect(() =>
      parseCommonEvidenceRecord({ ...commonRecord, reviewerIdentities: [" "] }),
    ).toThrow("reviewerIdentities[0]");
  });

  it("rejects blank values inside the common reviewer date list", () => {
    expect(() => parseCommonEvidenceRecord({ ...commonRecord, reviewerDates: [" "] })).toThrow(
      "reviewerDates[0]",
    );
  });
});

requiredFieldContract(
  "common evidence",
  parseCommonEvidenceRecord,
  commonRecord,
  commonRequiredFields,
);
requiredFieldContract(
  "Stack Overflow evidence",
  parseStackOverflowEvidenceRecord,
  stackOverflowRecord,
  stackOverflowRequiredFields,
);
requiredFieldContract(
  "model-output evidence",
  parseModelOutputEvidenceRecord,
  modelOutputRecord,
  modelOutputRequiredFields,
);
requiredFieldContract(
  "project-owned-human evidence",
  parseProjectOwnedHumanEvidenceRecord,
  projectOwnedHumanRecord,
  projectOwnedHumanRequiredFields,
);
