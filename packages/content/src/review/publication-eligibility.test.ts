import {
  createPublicationEligibility,
  type PublicationEligibilityInput,
} from "./publication-eligibility";

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: string | RegExp): void;
}

interface Each {
  <First, Second>(cases: readonly (readonly [First, Second])[]): (
    name: string,
    callback: (first: First, second: Second) => unknown,
  ) => void;
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

const approvalChecks = {
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
} as const;

function validInput(): PublicationEligibilityInput {
  const evidenceVersion = "evidence-version-7";
  return {
    contentId: "content-17",
    itemMode: "language",
    evidenceVersion,
    defensibleCompetingAnswers: [],
    approvalChecks,
    reviews: [
      {
        reviewerId: "person-1",
        reviewerName: "Casey Editor",
        role: "content-editor",
        qualifications: ["content-preparation", "evidence-record-training"],
        decision: "approve",
        reviewDate: "2026-07-13",
        conflictDeclared: false,
        conflictDeclaration: "No conflict declared",
        evidenceVersion,
      },
      {
        reviewerId: "person-2",
        reviewerName: "Taylor Technical",
        role: "technical-reviewer-a",
        qualifications: ["language"],
        decision: "approve",
        reviewDate: "2026-07-13",
        conflictDeclared: false,
        conflictDeclaration: "No conflict declared",
        evidenceVersion,
      },
      {
        reviewerId: "person-3",
        reviewerName: "Morgan Technical",
        role: "technical-reviewer-b",
        qualifications: ["language", "provenance"],
        decision: "approve",
        reviewDate: "2026-07-13",
        conflictDeclared: false,
        conflictDeclaration: "No conflict declared",
        evidenceVersion,
      },
      {
        reviewerId: "person-4",
        reviewerName: "Riley Rights",
        role: "rights-safety-reviewer",
        qualifications: ["don-approved-rights-safety-qualification"],
        decision: "approve",
        reviewDate: "2026-07-13",
        conflictDeclared: false,
        conflictDeclaration: "No conflict declared",
        evidenceVersion,
      },
    ],
  };
}

describe("publication eligibility", () => {
  it("accepts both exact recorded content-editor qualification claims", () => {
    expect(createPublicationEligibility(validInput()).eligible).toBe(true);
  });

  it.each(["content-preparation", "evidence-record-training"] as const)(
    "rejects a content editor missing the exact %s claim",
    (missing) => {
      const input = validInput();
      input.reviews[0]!.qualifications = input.reviews[0]!.qualifications.filter(
        (qualification) => qualification !== missing,
      );
      expect(() => createPublicationEligibility(input)).toThrow(
        "content-editor.qualifications must include content-preparation and evidence-record-training",
      );
    },
  );

  it("rejects arbitrary aliases for content-editor qualification claims", () => {
    const input = validInput();
    input.reviews[0]!.qualifications = ["content preparation", "evidence-record-trained"];
    expect(() => createPublicationEligibility(input)).toThrow(
      "content-editor.qualifications must include content-preparation and evidence-record-training",
    );
  });

  it("accepts a recorded Don-approved rights/safety qualification claim", () => {
    expect(createPublicationEligibility(validInput()).eligible).toBe(true);
  });

  it("accepts a recorded counsel-status claim", () => {
    const input = validInput();
    input.reviews[3]!.qualifications = ["counsel-status"];
    expect(createPublicationEligibility(input).eligible).toBe(true);
  });

  it.each([
    ["arbitrary rights/safety strings", ["rights", "safety"]],
    ["no recognized rights basis", ["content-preparation"]],
  ] as const)("rejects %s", (_case, qualifications) => {
    const input = validInput();
    input.reviews[3]!.qualifications = [...qualifications];
    expect(() => createPublicationEligibility(input)).toThrow(
      "rights-safety-reviewer.qualifications must include don-approved-rights-safety-qualification or counsel-status",
    );
  });

  it("creates an immutable reviewer decision and conflict audit", () => {
    const result = createPublicationEligibility(validInput());

    expect(result.eligible).toBe(true);
    expect(result.reviews.map(({ reviewerName, role, decision }) => ({
      reviewerName,
      role,
      decision,
    }))).toEqual([
      { reviewerName: "Casey Editor", role: "content-editor", decision: "approve" },
      { reviewerName: "Taylor Technical", role: "technical-reviewer-a", decision: "approve" },
      { reviewerName: "Morgan Technical", role: "technical-reviewer-b", decision: "approve" },
      { reviewerName: "Riley Rights", role: "rights-safety-reviewer", decision: "approve" },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reviews)).toBe(true);
    expect(Object.isFrozen(result.reviews[0])).toBe(true);
    expect(Object.isFrozen(result.approvalChecks)).toBe(true);
  });

  it("rejects a repeated person across independent roles", () => {
    const input = validInput();
    input.reviews[3] = { ...input.reviews[3]!, reviewerId: "person-1" };

    expect(() => createPublicationEligibility(input)).toThrow(
      "reviews must identify four distinct reviewerId values",
    );
  });

  it("rejects a missing or repeated required role", () => {
    const input = validInput();
    input.reviews[3] = { ...input.reviews[3]!, role: "content-editor" };

    expect(() => createPublicationEligibility(input)).toThrow(
      "reviews must contain exactly one rights-safety-reviewer",
    );
  });

  it("rejects a technical reviewer without the item-mode qualification", () => {
    const input = validInput();
    input.reviews[1] = { ...input.reviews[1]!, qualifications: ["provenance"] };

    expect(() => createPublicationEligibility(input)).toThrow(
      "technical-reviewer-a.qualifications must include language",
    );
  });

  it("rejects a defensible competing language answer", () => {
    const input = validInput();
    input.defensibleCompetingAnswers = ["TypeScript"];

    expect(() => createPublicationEligibility(input)).toThrow(
      "defensibleCompetingAnswers must be empty",
    );
  });

  it("rejects a non-approval decision", () => {
    const input = validInput();
    input.reviews[2] = { ...input.reviews[2]!, decision: "reject" };

    expect(() => createPublicationEligibility(input)).toThrow(
      "technical-reviewer-b.decision must be approve",
    );
  });

  it("rejects a declared conflict", () => {
    const input = validInput();
    input.reviews[0] = {
      ...input.reviews[0]!,
      conflictDeclared: true,
      conflictDeclaration: "Commissioned the sample",
    };

    expect(() => createPublicationEligibility(input)).toThrow(
      "content-editor.conflictDeclared must be false",
    );
  });

  it("rejects a review of a different evidence version", () => {
    const input = validInput();
    input.reviews[0] = { ...input.reviews[0]!, evidenceVersion: "evidence-version-6" };

    expect(() => createPublicationEligibility(input)).toThrow(
      "content-editor.evidenceVersion must match evidenceVersion",
    );
  });

  const requiredApprovalChecks = Object.keys(approvalChecks) as Array<keyof typeof approvalChecks>;

  it.each(requiredApprovalChecks)("rejects when %s is not approved", (field) => {
    const input = validInput();
    input.approvalChecks = { ...input.approvalChecks, [field]: false };

    expect(() => createPublicationEligibility(input)).toThrow(
      `approvalChecks.${field} must be true`,
    );
  });

  it.each(["reviewerId", "reviewerName", "reviewDate", "conflictDeclaration"] as const)(
    "rejects a blank %s in a review audit",
    (field) => {
      const input = validInput();
      input.reviews[0] = { ...input.reviews[0]!, [field]: " " };

      expect(() => createPublicationEligibility(input)).toThrow(`content-editor.${field}`);
    },
  );
});
