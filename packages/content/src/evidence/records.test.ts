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
