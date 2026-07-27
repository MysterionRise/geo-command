import { createLanguageCandidateSet } from "../../../domain/src/language/index.js";
import {
  createPublicationEligibility,
  type PublicationEligibilityInput,
} from "../review/publication-eligibility.js";
import {
  createLanguageAmbiguityEligibility,
  LanguageAmbiguityRuleError,
  type LanguageAmbiguityEligibilityInput,
} from "./language-ambiguity.js";

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}

type MutableTuple<T extends readonly unknown[]> =
  T extends readonly [...infer Elements] ? Elements : never;

interface Each {
  <T extends readonly unknown[]>(cases: readonly T[]): (
    name: string,
    callback: (...values: MutableTuple<T>) => unknown,
  ) => void;
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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function candidateInput() {
  return deepFreeze({
    versionId: "language-set-7",
    presentedCandidateCount: 3,
    correctCandidateId: "typescript",
    candidates: [
      {
        id: "typescript",
        canonicalLabel: "TypeScript",
        aliases: ["ts"],
        distractorRationale: null,
      },
      {
        id: "javascript",
        canonicalLabel: "JavaScript",
        aliases: ["js"],
        distractorRationale: "The syntax overlaps, but the excerpt uses static type annotations.",
      },
      {
        id: "flow",
        canonicalLabel: "Flow",
        aliases: ["flow js"],
        distractorRationale: "Flow has related annotations but different language-specific signals.",
      },
    ],
    orderingPolicy: { versionId: "language-ordering-2", kind: "deterministic" },
    clueSetVersionId: "language-clues-4",
    cluePolicyVersionId: "clue-policy-2",
    scoringVersionId: "scoring-3",
    clues: [
      { clueId: "clue-1", clueVersionId: "clue-1-v2", order: 1 },
      { clueId: "clue-2", clueVersionId: "clue-2-v2", order: 2 },
    ],
    calibration: {
      versionId: "language-calibration-3",
      candidateSetVersionId: "language-set-7",
      presentedCandidateCount: 3,
      chanceBaseline: 1 / 3,
      cluePolicyVersionId: "clue-policy-2",
      configuredClueCount: 2,
      scoringVersionId: "scoring-3",
    },
  });
}

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

function publicationInput(
  overrides: Partial<Pick<PublicationEligibilityInput, "contentId" | "itemMode" | "evidenceVersion">> = {},
): PublicationEligibilityInput {
  const contentId = overrides.contentId ?? "language-content-17";
  const itemMode = overrides.itemMode ?? "language";
  const evidenceVersion = overrides.evidenceVersion ?? "language-evidence-9";
  return {
    contentId,
    itemMode,
    evidenceVersion,
    defensibleCompetingAnswers: [],
    approvalChecks,
    reviews: [
      {
        reviewerId: "editor-1", reviewerName: "Casey Editor", role: "content-editor",
        qualifications: ["content-preparation", "evidence-record-training"], decision: "approve", reviewDate: "2026-07-13",
        conflictDeclared: false, conflictDeclaration: "No conflict", evidenceVersion,
      },
      {
        reviewerId: "technical-a", reviewerName: "Taylor Technical", role: "technical-reviewer-a",
        qualifications: ["language"], decision: "approve", reviewDate: "2026-07-13",
        conflictDeclared: false, conflictDeclaration: "No conflict", evidenceVersion,
      },
      {
        reviewerId: "technical-b", reviewerName: "Morgan Technical", role: "technical-reviewer-b",
        qualifications: ["language", "provenance"], decision: "approve", reviewDate: "2026-07-13",
        conflictDeclared: false, conflictDeclaration: "No conflict", evidenceVersion,
      },
      {
        reviewerId: "rights-1", reviewerName: "Riley Rights", role: "rights-safety-reviewer",
        qualifications: ["don-approved-rights-safety-qualification"], decision: "approve", reviewDate: "2026-07-13",
        conflictDeclared: false, conflictDeclaration: "No conflict", evidenceVersion,
      },
    ],
  };
}

function validInput(): LanguageAmbiguityEligibilityInput {
  const publicationEligibility = createPublicationEligibility(publicationInput());
  const candidateSet = createLanguageCandidateSet(candidateInput());
  return deepFreeze({
    eligibilityVersionId: "language-ambiguity-eligibility-5",
    contentId: publicationEligibility.contentId,
    evidenceVersion: publicationEligibility.evidenceVersion,
    candidateSet,
    publicationEligibility,
    technicalReviews: [
      {
        reviewId: "ambiguity-review-a-5",
        contentId: publicationEligibility.contentId,
        evidenceVersion: publicationEligibility.evidenceVersion,
        candidateSetVersionId: candidateSet.versionId,
        reviewerId: "technical-a",
        reviewerName: "Taylor Technical",
        role: "technical-reviewer-a",
        qualifications: ["language"],
        conflictDeclared: false,
        reviewDate: "2026-07-13",
        defensibleCandidateIds: [candidateSet.correctCandidateId],
      },
      {
        reviewId: "ambiguity-review-b-5",
        contentId: publicationEligibility.contentId,
        evidenceVersion: publicationEligibility.evidenceVersion,
        candidateSetVersionId: candidateSet.versionId,
        reviewerId: "technical-b",
        reviewerName: "Morgan Technical",
        role: "technical-reviewer-b",
        qualifications: ["language", "provenance"],
        conflictDeclared: false,
        reviewDate: "2026-07-13",
        defensibleCandidateIds: [candidateSet.correctCandidateId],
      },
    ],
    deceptiveTextControlReview: {
      decisionId: "text-control-decision-5",
      versionId: "text-control-review-5",
      contentId: publicationEligibility.contentId,
      evidenceVersion: publicationEligibility.evidenceVersion,
      candidateSetVersionId: candidateSet.versionId,
      reviewerId: "rights-1",
      reviewerName: "Riley Rights",
      role: "rights-safety-reviewer",
      disposition: "absent",
      detectedControlClasses: [],
      decision: "approve",
      reviewDate: "2026-07-13",
      visibleAnnotationVersion: null,
    },
  });
}

function changed(
  alter: (input: Record<string, unknown>) => Record<string, unknown>,
): LanguageAmbiguityEligibilityInput {
  return deepFreeze(alter({ ...validInput() })) as unknown as LanguageAmbiguityEligibilityInput;
}

function changedTechnicalReview(
  index: number,
  patch: Record<string, unknown>,
): LanguageAmbiguityEligibilityInput {
  const input = validInput();
  const reviews = input.technicalReviews.map((review, reviewIndex) =>
    reviewIndex === index ? { ...review, ...patch } : review);
  return deepFreeze({ ...input, technicalReviews: reviews });
}

function changedControl(patch: Record<string, unknown>): LanguageAmbiguityEligibilityInput {
  const input = validInput();
  return deepFreeze({
    ...input,
    deceptiveTextControlReview: { ...input.deceptiveTextControlReview, ...patch },
  });
}

describe("language ambiguity eligibility", () => {
  it("creates the exact deeply immutable eligibility artifact", () => {
    const result = createLanguageAmbiguityEligibility(validInput());

    expect(Object.keys(result)).toEqual([
      "eligibilityVersionId", "contentId", "evidenceVersion", "candidateSetVersionId", "correctCandidateId",
      "publicationEligibility", "technicalReviews", "deceptiveTextControlReview", "eligible",
    ]);
    expect(result.eligible).toBe(true);
    expect(result.eligibilityVersionId).toBe("language-ambiguity-eligibility-5");
    expect(result.candidateSetVersionId).toBe("language-set-7");
    expect(result.correctCandidateId).toBe("typescript");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.technicalReviews)).toBe(true);
    expect(Object.isFrozen(result.technicalReviews[0]!)).toBe(true);
    expect(Object.isFrozen(result.technicalReviews[0]!.qualifications)).toBe(true);
    expect(Object.isFrozen(result.technicalReviews[0]!.defensibleCandidateIds)).toBe(true);
    expect(Object.isFrozen(result.deceptiveTextControlReview)).toBe(true);
    expect(Object.isFrozen(result.deceptiveTextControlReview.detectedControlClasses)).toBe(true);
  });

  it("accepts a certified candidate set whose opaque identifiers differ from labels and aliases", () => {
    const baseCandidateInput = candidateInput();
    const candidateSet = createLanguageCandidateSet(deepFreeze({
      ...baseCandidateInput,
      correctCandidateId: "lang-ts-01",
      candidates: [
        { ...baseCandidateInput.candidates[0]!, id: "lang-ts-01" },
        { ...baseCandidateInput.candidates[1]!, id: "lang-js-01" },
        { ...baseCandidateInput.candidates[2]!, id: "lang-flow-01" },
      ],
    }));
    const input = validInput();
    const technicalReviews = input.technicalReviews.map((review) => ({
      ...review,
      defensibleCandidateIds: [candidateSet.correctCandidateId],
    }));

    const result = createLanguageAmbiguityEligibility(deepFreeze({
      ...input,
      candidateSet,
      technicalReviews,
    }));

    expect(result.correctCandidateId).toBe("lang-ts-01");
    expect(result.technicalReviews.map(({ defensibleCandidateIds }) => defensibleCandidateIds))
      .toEqual([["lang-ts-01"], ["lang-ts-01"]]);
  });

  it("reconstructs a detached four-role approval and preserves exact technical continuity", () => {
    const input = validInput();
    const result = createLanguageAmbiguityEligibility(input);

    expect(result.publicationEligibility === input.publicationEligibility).toBe(false);
    expect(result.publicationEligibility.approvalChecks === input.publicationEligibility.approvalChecks).toBe(false);
    expect(result.publicationEligibility.reviews === input.publicationEligibility.reviews).toBe(false);
    expect(result.publicationEligibility.reviews[0] === input.publicationEligibility.reviews[0]).toBe(false);
    expect(Object.isFrozen(result.publicationEligibility)).toBe(true);
    expect(Object.isFrozen(result.publicationEligibility.approvalChecks)).toBe(true);
    expect(Object.isFrozen(result.publicationEligibility.reviews)).toBe(true);
    expect(Object.isFrozen(result.publicationEligibility.reviews[0]!)).toBe(true);
    expect(Object.isFrozen(result.publicationEligibility.reviews[0]!.qualifications)).toBe(true);
    expect(result.technicalReviews.map(({ reviewId, reviewDate }) => ({ reviewId, reviewDate }))).toEqual([
      { reviewId: "ambiguity-review-a-5", reviewDate: "2026-07-13" },
      { reviewId: "ambiguity-review-b-5", reviewDate: "2026-07-13" },
    ]);
    expect({
      decisionId: result.deceptiveTextControlReview.decisionId,
      versionId: result.deceptiveTextControlReview.versionId,
      reviewDate: result.deceptiveTextControlReview.reviewDate,
      candidateSetVersionId: result.deceptiveTextControlReview.candidateSetVersionId,
    }).toEqual({
      decisionId: "text-control-decision-5",
      versionId: "text-control-review-5",
      reviewDate: "2026-07-13",
      candidateSetVersionId: "language-set-7",
    });
    expect(result.technicalReviews.map(({ reviewerId, reviewerName, role, qualifications }) => ({
      reviewerId, reviewerName, role, qualifications,
    }))).toEqual([
      { reviewerId: "technical-a", reviewerName: "Taylor Technical", role: "technical-reviewer-a", qualifications: ["language"] },
      { reviewerId: "technical-b", reviewerName: "Morgan Technical", role: "technical-reviewer-b", qualifications: ["language", "provenance"] },
    ]);
  });

  it("safely reconstructs mutable nested publication records inside a frozen envelope", () => {
    const input = validInput();
    const publicationEligibility = Object.freeze({
      ...input.publicationEligibility,
      approvalChecks: { ...input.publicationEligibility.approvalChecks },
      reviews: input.publicationEligibility.reviews.map((review) => ({
        ...review,
        qualifications: [...review.qualifications],
      })),
    });

    const result = createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      publicationEligibility,
    }));

    expect(Object.isFrozen(result.publicationEligibility.approvalChecks)).toBe(true);
    expect(Object.isFrozen(result.publicationEligibility.reviews)).toBe(true);
    expect(result.publicationEligibility.reviews === publicationEligibility.reviews).toBe(false);
  });

  it("revalidates an exact structural publication record", () => {
    const input = validInput();
    const publicationEligibility = deepFreeze({
      ...input.publicationEligibility,
      defensibleCompetingAnswers: [...input.publicationEligibility.defensibleCompetingAnswers],
      approvalChecks: { ...input.publicationEligibility.approvalChecks },
      reviews: input.publicationEligibility.reviews.map((review) => ({
        ...review,
        qualifications: [...review.qualifications],
      })),
    });

    const result = createLanguageAmbiguityEligibility(
      deepFreeze({ ...input, publicationEligibility }),
    );

    expect(result.publicationEligibility.contentId).toBe(input.contentId);
    expect(result.publicationEligibility === publicationEligibility).toBe(false);
  });

  it("accepts a detected control only with an approved visible-annotation disposition", () => {
    const input = changedControl({
      disposition: "approved-visible-annotation",
      detectedControlClasses: ["bidi", "zero-width"],
      visibleAnnotationVersion: "visible-control-annotation-2",
    });

    const result = createLanguageAmbiguityEligibility(input);

    expect(result.deceptiveTextControlReview.disposition).toBe("approved-visible-annotation");
    expect(result.deceptiveTextControlReview.detectedControlClasses).toEqual(["bidi", "zero-width"]);
    expect(result.deceptiveTextControlReview.visibleAnnotationVersion).toBe("visible-control-annotation-2");
  });

  it.each([
    ["no reviews", []],
    ["one review", [validInput().technicalReviews[0]]],
    ["duplicate A role", [validInput().technicalReviews[0], { ...validInput().technicalReviews[1], role: "technical-reviewer-a" }]],
  ] as const)("rejects %s instead of exactly one technical A and B", (_name, technicalReviews) => {
    expect(() => createLanguageAmbiguityEligibility(changed((input) => ({ ...input, technicalReviews })))).toThrow(
      LanguageAmbiguityRuleError,
    );
  });

  it.each([
    ["a second known candidate", ["typescript", "javascript"]],
    ["an unknown candidate", ["unknown-language"]],
    ["a polyglot answer", ["typescript", "flow"]],
    ["no defensible candidate", []],
  ] as const)("rejects %s in an independent defensibility decision", (_name, defensibleCandidateIds) => {
    expect(() => createLanguageAmbiguityEligibility(
      changedTechnicalReview(0, { defensibleCandidateIds }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects reviewer disagreement", () => {
    expect(() => createLanguageAmbiguityEligibility(
      changedTechnicalReview(1, { defensibleCandidateIds: ["javascript"] }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects when both reviewers agree on the wrong candidate", () => {
    const first = changedTechnicalReview(0, { defensibleCandidateIds: ["javascript"] });
    const reviews = first.technicalReviews.map((review, index) =>
      index === 1 ? { ...review, defensibleCandidateIds: ["javascript"] } : review);
    expect(() => createLanguageAmbiguityEligibility(
      deepFreeze({ ...first, technicalReviews: reviews }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["identity", { reviewerId: "somebody-else" }],
    ["name", { reviewerName: "Somebody Else" }],
    ["role", { role: "technical-reviewer-b" }],
    ["qualification", { qualifications: ["provenance"] }],
    ["extra qualification", { qualifications: ["language", "security"] }],
    ["conflict", { conflictDeclared: true }],
    ["review date", { reviewDate: "2026-07-12" }],
    ["content binding", { contentId: "other-content" }],
    ["evidence binding", { evidenceVersion: "other-evidence" }],
    ["candidate-set binding", { candidateSetVersionId: "other-set" }],
  ] as const)("rejects a technical-review %s mismatch", (_name, patch) => {
    expect(() => createLanguageAmbiguityEligibility(changedTechnicalReview(0, patch))).toThrow(
      LanguageAmbiguityRuleError,
    );
  });

  it("rejects duplicate technical review identifiers", () => {
    expect(() => createLanguageAmbiguityEligibility(
      changedTechnicalReview(1, { reviewId: "ambiguity-review-a-5" }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects duplicate defensible candidate identifiers", () => {
    expect(() => createLanguageAmbiguityEligibility(
      changedTechnicalReview(0, { defensibleCandidateIds: ["typescript", "typescript"] }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["eligibility version", (input: LanguageAmbiguityEligibilityInput) => ({ ...input, eligibilityVersionId: " " })],
    ["technical review id", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input, technicalReviews: [{ ...input.technicalReviews[0], reviewId: " " }, input.technicalReviews[1]],
    })],
    ["technical reviewer id", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input, technicalReviews: [{ ...input.technicalReviews[0], reviewerId: " " }, input.technicalReviews[1]],
    })],
    ["technical candidate-set version", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input, technicalReviews: [{ ...input.technicalReviews[0], candidateSetVersionId: " " }, input.technicalReviews[1]],
    })],
    ["technical review date", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input, technicalReviews: [{ ...input.technicalReviews[0], reviewDate: "not-a-date" }, input.technicalReviews[1]],
    })],
  ] as const)("rejects a blank or malformed %s", (_name, alter) => {
    expect(() => createLanguageAmbiguityEligibility(
      deepFreeze(alter(validInput())) as LanguageAmbiguityEligibilityInput,
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["content", { contentId: "other-content" }],
    ["evidence", { evidenceVersion: "other-evidence" }],
  ] as const)("rejects a publication %s mismatch", (_name, patch) => {
    expect(() => createLanguageAmbiguityEligibility(changed((input) => ({ ...input, ...patch })))).toThrow(
      LanguageAmbiguityRuleError,
    );
  });

  it("rejects a non-language publication approval", () => {
    const provenancePublication = publicationInput({ itemMode: "provenance" });
    provenancePublication.reviews[1] = {
      ...provenancePublication.reviews[1]!,
      qualifications: ["provenance"],
    };
    const publicationEligibility = createPublicationEligibility(provenancePublication);
    expect(() => createLanguageAmbiguityEligibility(
      changed((input) => ({ ...input, publicationEligibility })),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["eligible false", { eligible: false }],
    ["approval false", {
      approvalChecks: { ...validInput().publicationEligibility.approvalChecks, ambiguity: false },
    }],
  ] as const)("rejects a semantically tampered publication with %s", (_name, patch) => {
    const input = validInput();
    const publicationEligibility = deepFreeze({ ...input.publicationEligibility, ...patch });
    expect(() => createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      publicationEligibility,
    }) as LanguageAmbiguityEligibilityInput)).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects a forged candidate-set structural clone", () => {
    const candidateSet = deepFreeze({ ...validInput().candidateSet });
    expect(() => createLanguageAmbiguityEligibility(
      changed((input) => ({ ...input, candidateSet })),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects a tampered publication approval instead of silently trusting it", () => {
    const publicationEligibility = deepFreeze({ ...validInput().publicationEligibility, extra: true });
    expect(() => createLanguageAmbiguityEligibility(
      changed((input) => ({ ...input, publicationEligibility })),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects a mutable candidate-set structural clone", () => {
    const candidateSet = { ...validInput().candidateSet };
    expect(() => createLanguageAmbiguityEligibility(
      Object.freeze({ ...validInput(), candidateSet }) as LanguageAmbiguityEligibilityInput,
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["missing", { deceptiveTextControlReview: undefined }],
    ["mutable", { deceptiveTextControlReview: { ...validInput().deceptiveTextControlReview } }],
  ] as const)("rejects a %s control-character review", (_name, patch) => {
    const input = Object.freeze({ ...validInput(), ...patch }) as unknown as LanguageAmbiguityEligibilityInput;
    expect(() => createLanguageAmbiguityEligibility(input)).toThrow(LanguageAmbiguityRuleError);
  });

  it.each([
    ["unapproved decision", { decision: "reject" }],
    ["wrong reviewer", { reviewerId: "technical-a" }],
    ["wrong reviewer name", { reviewerName: "Taylor Technical" }],
    ["wrong role", { role: "technical-reviewer-a" }],
    ["wrong content binding", { contentId: "other-content" }],
    ["wrong evidence binding", { evidenceVersion: "other-evidence" }],
    ["wrong candidate-set binding", { candidateSetVersionId: "other-set" }],
    ["wrong review date", { reviewDate: "2026-07-12" }],
    ["blank decision id", { decisionId: " " }],
    ["blank version", { versionId: " " }],
    ["malformed review date", { reviewDate: "not-a-date" }],
    ["missing decision", { decision: undefined }],
    ["unknown disposition", { disposition: "manually-reviewed" }],
    ["detected controls without annotation", { disposition: "approved-visible-annotation", detectedControlClasses: ["bidi"], visibleAnnotationVersion: " " }],
    ["detected controls called absent", { disposition: "absent", detectedControlClasses: ["zero-width"] }],
    ["absent controls with an annotation", { disposition: "absent", detectedControlClasses: [], visibleAnnotationVersion: "annotation-1" }],
    ["exception without detected controls", { disposition: "approved-visible-annotation", detectedControlClasses: [], visibleAnnotationVersion: "annotation-1" }],
    ["duplicate detected controls", { disposition: "approved-visible-annotation", detectedControlClasses: ["bidi", "bidi"], visibleAnnotationVersion: "annotation-1" }],
    ["unknown control class", { disposition: "approved-visible-annotation", detectedControlClasses: ["homoglyph"], visibleAnnotationVersion: "annotation-1" }],
  ] as const)("rejects %s in the rights/safety control disposition", (_name, patch) => {
    expect(() => createLanguageAmbiguityEligibility(changedControl(patch))).toThrow(
      LanguageAmbiguityRuleError,
    );
  });

  it.each([
    ["root", (input: LanguageAmbiguityEligibilityInput) => ({ ...input, extra: true })],
    ["technical review", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input,
      technicalReviews: [{ ...input.technicalReviews[0], extra: true }, input.technicalReviews[1]],
    })],
    ["control review", (input: LanguageAmbiguityEligibilityInput) => ({
      ...input,
      deceptiveTextControlReview: { ...input.deceptiveTextControlReview, extra: true },
    })],
  ] as const)("rejects an extra field on the %s shape", (_name, alter) => {
    expect(() => createLanguageAmbiguityEligibility(deepFreeze(alter(validInput())) as LanguageAmbiguityEligibilityInput))
      .toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects mutable root and nested review records", () => {
    const root = { ...validInput() } as LanguageAmbiguityEligibilityInput;
    expect(() => createLanguageAmbiguityEligibility(root)).toThrow(LanguageAmbiguityRuleError);

    const input = validInput();
    const technicalReviews = [
      { ...input.technicalReviews[0] },
      input.technicalReviews[1],
    ] as unknown as LanguageAmbiguityEligibilityInput["technicalReviews"];
    expect(() => createLanguageAmbiguityEligibility(
      Object.freeze({ ...input, technicalReviews }),
    )).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects an isolated mutable technical-review array containing frozen records", () => {
    const input = validInput();
    const technicalReviews = [input.technicalReviews[0], input.technicalReviews[1]];
    expect(() => createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      technicalReviews,
    }))).toThrow(LanguageAmbiguityRuleError);
  });

  it("rejects mutable nested technical arrays and control arrays", () => {
    const input = validInput();
    const qualifications = [...input.technicalReviews[0]!.qualifications];
    const technicalReviewsWithMutableQualifications = Object.freeze([
      Object.freeze({ ...input.technicalReviews[0], qualifications }),
      input.technicalReviews[1],
    ]);
    expect(() => createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      technicalReviews: technicalReviewsWithMutableQualifications,
    }))).toThrow(LanguageAmbiguityRuleError);

    const defensibleCandidateIds = [...input.technicalReviews[0]!.defensibleCandidateIds];
    const technicalReviewsWithMutableAnswers = Object.freeze([
      Object.freeze({ ...input.technicalReviews[0], defensibleCandidateIds }),
      input.technicalReviews[1],
    ]);
    expect(() => createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      technicalReviews: technicalReviewsWithMutableAnswers,
    }))).toThrow(LanguageAmbiguityRuleError);

    const detectedControlClasses = [...input.deceptiveTextControlReview.detectedControlClasses];
    expect(() => createLanguageAmbiguityEligibility(Object.freeze({
      ...input,
      deceptiveTextControlReview: Object.freeze({
        ...input.deceptiveTextControlReview,
        detectedControlClasses,
      }),
    }))).toThrow(LanguageAmbiguityRuleError);
  });
});
