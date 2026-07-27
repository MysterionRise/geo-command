import {
  resolveLanguageCandidateId,
  type LanguageCandidateSet,
} from "../../../domain/src/language/index.js";
import {
  createPublicationEligibility,
  type PublicationEligibility,
  type PublicationEligibilityInput,
  type ReviewerDecisionAudit,
} from "../review/publication-eligibility.js";

export type LanguageTechnicalReviewerRole =
  | "technical-reviewer-a"
  | "technical-reviewer-b";

export interface LanguageTechnicalReviewInput {
  readonly reviewId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSetVersionId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly role: LanguageTechnicalReviewerRole;
  readonly qualifications: readonly string[];
  readonly conflictDeclared: boolean;
  readonly reviewDate: string;
  readonly defensibleCandidateIds: readonly string[];
}

export type DeceptiveTextControlClass = "bidi" | "zero-width";
export type DeceptiveTextControlDisposition =
  | "absent"
  | "approved-visible-annotation";

export interface DeceptiveTextControlReviewInput {
  readonly decisionId: string;
  readonly versionId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSetVersionId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly role: "rights-safety-reviewer";
  readonly disposition: DeceptiveTextControlDisposition;
  readonly detectedControlClasses: readonly DeceptiveTextControlClass[];
  readonly decision: "approve";
  readonly reviewDate: string;
  readonly visibleAnnotationVersion: string | null;
}

export interface LanguageAmbiguityEligibilityInput {
  readonly eligibilityVersionId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSet: LanguageCandidateSet;
  readonly publicationEligibility: PublicationEligibility;
  readonly technicalReviews: readonly LanguageTechnicalReviewInput[];
  readonly deceptiveTextControlReview: DeceptiveTextControlReviewInput;
}

export interface LanguageTechnicalReview {
  readonly reviewId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSetVersionId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly role: LanguageTechnicalReviewerRole;
  readonly qualifications: readonly string[];
  readonly conflictDeclared: false;
  readonly reviewDate: string;
  readonly defensibleCandidateIds: readonly [string];
}

export interface DeceptiveTextControlReview {
  readonly decisionId: string;
  readonly versionId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSetVersionId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly role: "rights-safety-reviewer";
  readonly disposition: DeceptiveTextControlDisposition;
  readonly detectedControlClasses: readonly DeceptiveTextControlClass[];
  readonly decision: "approve";
  readonly reviewDate: string;
  readonly visibleAnnotationVersion: string | null;
}

export interface LanguageAmbiguityEligibility {
  readonly eligibilityVersionId: string;
  readonly contentId: string;
  readonly evidenceVersion: string;
  readonly candidateSetVersionId: string;
  readonly correctCandidateId: string;
  readonly publicationEligibility: PublicationEligibility;
  readonly technicalReviews: readonly LanguageTechnicalReview[];
  readonly deceptiveTextControlReview: DeceptiveTextControlReview;
  readonly eligible: true;
}

export class LanguageAmbiguityRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LanguageAmbiguityRuleError";
  }
}

const ROOT_KEYS = Object.freeze([
  "eligibilityVersionId", "contentId", "evidenceVersion", "candidateSet",
  "publicationEligibility", "technicalReviews", "deceptiveTextControlReview",
]);
const TECHNICAL_REVIEW_KEYS = Object.freeze([
  "reviewId", "contentId", "evidenceVersion", "candidateSetVersionId",
  "reviewerId", "reviewerName", "role", "qualifications",
  "conflictDeclared", "reviewDate", "defensibleCandidateIds",
]);
const CONTROL_REVIEW_KEYS = Object.freeze([
  "decisionId", "versionId", "contentId", "evidenceVersion",
  "candidateSetVersionId", "reviewerId", "reviewerName", "role",
  "disposition", "detectedControlClasses", "decision", "reviewDate",
  "visibleAnnotationVersion",
]);
const PUBLICATION_KEYS = Object.freeze([
  "contentId", "itemMode", "evidenceVersion", "defensibleCompetingAnswers",
  "approvalChecks", "reviews", "eligible",
]);
const APPROVAL_CHECK_KEYS = Object.freeze([
  "answerIntegrity", "ambiguity", "difficulty", "provenance", "rights",
  "attribution", "secrets", "personalData", "safety", "inertRendering",
  "accessibility", "evidenceMinimization",
]);
const PUBLICATION_REVIEW_KEYS = Object.freeze([
  "reviewerId", "reviewerName", "role", "qualifications", "decision",
  "reviewDate", "conflictDeclared", "conflictDeclaration", "evidenceVersion",
]);
const TECHNICAL_ROLES: readonly LanguageTechnicalReviewerRole[] = Object.freeze([
  "technical-reviewer-a", "technical-reviewer-b",
]);
const CONTROL_CLASSES: readonly DeceptiveTextControlClass[] = Object.freeze([
  "bidi", "zero-width",
]);

const fail = (message: string): never => {
  throw new LanguageAmbiguityRuleError(message);
};

const objectRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
): void => {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key) => !actual.includes(key))) {
    fail(`${field} has an invalid shape`);
  }
};

const frozen = (value: object, field: string): void => {
  if (!Object.isFrozen(value)) fail(`${field} must be frozen`);
};

const array = (value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) return fail(`${field} must be an array`);
  return value;
};

const frozenArray = (value: unknown, field: string): readonly unknown[] => {
  const entries = array(value, field);
  frozen(entries, field);
  return entries;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be a non-blank string`);
  }
  return value.trim();
};

const calendarDate = (value: unknown, field: string): string => {
  const date = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${field} must be an ISO calendar date`);
  return date;
};

const equalStringLists = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const publicationInputFrom = (value: PublicationEligibility): PublicationEligibilityInput => {
  const root = objectRecord(value, "publicationEligibility");
  frozen(root, "publicationEligibility");
  exactKeys(root, PUBLICATION_KEYS, "publicationEligibility");
  if (root.eligible !== true) fail("publicationEligibility.eligible must be true");

  const approvalChecks = objectRecord(root.approvalChecks, "publicationEligibility.approvalChecks");
  exactKeys(approvalChecks, APPROVAL_CHECK_KEYS, "publicationEligibility.approvalChecks");
  const reviews = array(root.reviews, "publicationEligibility.reviews");
  const defensibleCompetingAnswers = array(
    root.defensibleCompetingAnswers,
    "publicationEligibility.defensibleCompetingAnswers",
  );

  return {
    contentId: text(root.contentId, "publicationEligibility.contentId"),
    itemMode: root.itemMode as PublicationEligibilityInput["itemMode"],
    evidenceVersion: text(root.evidenceVersion, "publicationEligibility.evidenceVersion"),
    defensibleCompetingAnswers: defensibleCompetingAnswers.map((entry, index) =>
      text(entry, `publicationEligibility.defensibleCompetingAnswers[${index}]`)),
    approvalChecks: {
      answerIntegrity: approvalChecks.answerIntegrity as boolean,
      ambiguity: approvalChecks.ambiguity as boolean,
      difficulty: approvalChecks.difficulty as boolean,
      provenance: approvalChecks.provenance as boolean,
      rights: approvalChecks.rights as boolean,
      attribution: approvalChecks.attribution as boolean,
      secrets: approvalChecks.secrets as boolean,
      personalData: approvalChecks.personalData as boolean,
      safety: approvalChecks.safety as boolean,
      inertRendering: approvalChecks.inertRendering as boolean,
      accessibility: approvalChecks.accessibility as boolean,
      evidenceMinimization: approvalChecks.evidenceMinimization as boolean,
    },
    reviews: reviews.map((entry, index) => {
      const review = objectRecord(entry, `publicationEligibility.reviews[${index}]`);
      exactKeys(review, PUBLICATION_REVIEW_KEYS, `publicationEligibility.reviews[${index}]`);
      const qualifications = array(
        review.qualifications,
        `publicationEligibility.reviews[${index}].qualifications`,
      );
      return {
        reviewerId: review.reviewerId as string,
        reviewerName: review.reviewerName as string,
        role: review.role as ReviewerDecisionAudit["role"],
        qualifications: qualifications.map((qualification) => qualification as string),
        decision: review.decision as ReviewerDecisionAudit["decision"],
        reviewDate: review.reviewDate as string,
        conflictDeclared: review.conflictDeclared as boolean,
        conflictDeclaration: review.conflictDeclaration as string,
        evidenceVersion: review.evidenceVersion as string,
      };
    }),
  };
};

const revalidatePublication = (value: PublicationEligibility): PublicationEligibility => {
  try {
    return createPublicationEligibility(publicationInputFrom(value));
  } catch (error) {
    if (error instanceof LanguageAmbiguityRuleError) throw error;
    return fail("publicationEligibility failed semantic revalidation");
  }
};

const parseTechnicalReview = (
  value: unknown,
  index: number,
  publicationReview: ReviewerDecisionAudit,
  binding: Readonly<{
    contentId: string;
    evidenceVersion: string;
    candidateSetVersionId: string;
    correctCandidateId: string;
  }>,
): LanguageTechnicalReview => {
  const field = `technicalReviews[${index}]`;
  const input = objectRecord(value, field);
  frozen(input, field);
  exactKeys(input, TECHNICAL_REVIEW_KEYS, field);

  const role = input.role;
  if (role !== publicationReview.role) fail(`${field}.role does not preserve publication continuity`);
  const qualificationsInput = frozenArray(input.qualifications, `${field}.qualifications`);
  const qualifications = qualificationsInput.map((entry, qualificationIndex) =>
    text(entry, `${field}.qualifications[${qualificationIndex}]`));
  if (!equalStringLists(qualifications, publicationReview.qualifications)) {
    fail(`${field}.qualifications do not preserve publication continuity`);
  }
  const defensibleInputs = frozenArray(
    input.defensibleCandidateIds,
    `${field}.defensibleCandidateIds`,
  );
  const defensibleCandidateIds = defensibleInputs.map((entry, candidateIndex) =>
    text(entry, `${field}.defensibleCandidateIds[${candidateIndex}]`));
  if (
    defensibleCandidateIds.length !== 1 ||
    defensibleCandidateIds[0] !== binding.correctCandidateId
  ) {
    fail(`${field} must identify exactly the certified correct candidate`);
  }

  const reviewId = text(input.reviewId, `${field}.reviewId`);
  const contentId = text(input.contentId, `${field}.contentId`);
  const evidenceVersion = text(input.evidenceVersion, `${field}.evidenceVersion`);
  const candidateSetVersionId = text(
    input.candidateSetVersionId,
    `${field}.candidateSetVersionId`,
  );
  const reviewerId = text(input.reviewerId, `${field}.reviewerId`);
  const reviewerName = text(input.reviewerName, `${field}.reviewerName`);
  const reviewDate = calendarDate(input.reviewDate, `${field}.reviewDate`);
  if (
    contentId !== binding.contentId ||
    evidenceVersion !== binding.evidenceVersion ||
    candidateSetVersionId !== binding.candidateSetVersionId
  ) fail(`${field} is not bound to the eligibility artifact`);
  if (
    reviewerId !== publicationReview.reviewerId ||
    reviewerName !== publicationReview.reviewerName ||
    input.conflictDeclared !== publicationReview.conflictDeclared ||
    reviewDate !== publicationReview.reviewDate
  ) fail(`${field} does not preserve publication reviewer continuity`);

  return Object.freeze({
    reviewId,
    contentId,
    evidenceVersion,
    candidateSetVersionId,
    reviewerId,
    reviewerName,
    role: role as LanguageTechnicalReviewerRole,
    qualifications: Object.freeze(qualifications),
    conflictDeclared: false,
    reviewDate,
    defensibleCandidateIds: Object.freeze([binding.correctCandidateId] as const),
  });
};

const parseControlReview = (
  value: unknown,
  publicationReview: ReviewerDecisionAudit,
  binding: Readonly<{
    contentId: string;
    evidenceVersion: string;
    candidateSetVersionId: string;
  }>,
): DeceptiveTextControlReview => {
  const field = "deceptiveTextControlReview";
  const input = objectRecord(value, field);
  frozen(input, field);
  exactKeys(input, CONTROL_REVIEW_KEYS, field);
  const controlsInput = frozenArray(input.detectedControlClasses, `${field}.detectedControlClasses`);
  const detectedControlClasses = controlsInput.map((entry, index) => {
    const control = text(entry, `${field}.detectedControlClasses[${index}]`);
    if (!CONTROL_CLASSES.includes(control as DeceptiveTextControlClass)) {
      return fail(`${field}.detectedControlClasses contains an unknown class`);
    }
    return control as DeceptiveTextControlClass;
  });
  if (new Set(detectedControlClasses).size !== detectedControlClasses.length) {
    fail(`${field}.detectedControlClasses must not contain duplicates`);
  }

  const disposition = input.disposition;
  let visibleAnnotationVersion: string | null;
  if (disposition === "absent") {
    if (detectedControlClasses.length !== 0 || input.visibleAnnotationVersion !== null) {
      return fail(`${field}.absent must have no controls or annotation`);
    }
    visibleAnnotationVersion = null;
  } else if (disposition === "approved-visible-annotation") {
    if (detectedControlClasses.length === 0) {
      return fail(`${field}.approved-visible-annotation must identify controls`);
    }
    visibleAnnotationVersion = text(
      input.visibleAnnotationVersion,
      `${field}.visibleAnnotationVersion`,
    );
  } else {
    return fail(`${field}.disposition is unknown`);
  }

  const decisionId = text(input.decisionId, `${field}.decisionId`);
  const versionId = text(input.versionId, `${field}.versionId`);
  const contentId = text(input.contentId, `${field}.contentId`);
  const evidenceVersion = text(input.evidenceVersion, `${field}.evidenceVersion`);
  const candidateSetVersionId = text(
    input.candidateSetVersionId,
    `${field}.candidateSetVersionId`,
  );
  const reviewerId = text(input.reviewerId, `${field}.reviewerId`);
  const reviewerName = text(input.reviewerName, `${field}.reviewerName`);
  const reviewDate = calendarDate(input.reviewDate, `${field}.reviewDate`);
  if (
    contentId !== binding.contentId ||
    evidenceVersion !== binding.evidenceVersion ||
    candidateSetVersionId !== binding.candidateSetVersionId
  ) fail(`${field} is not bound to the eligibility artifact`);
  if (
    input.role !== "rights-safety-reviewer" ||
    input.role !== publicationReview.role ||
    reviewerId !== publicationReview.reviewerId ||
    reviewerName !== publicationReview.reviewerName ||
    reviewDate !== publicationReview.reviewDate ||
    input.decision !== "approve"
  ) fail(`${field} does not preserve approved rights/safety continuity`);

  return Object.freeze({
    decisionId,
    versionId,
    contentId,
    evidenceVersion,
    candidateSetVersionId,
    reviewerId,
    reviewerName,
    role: "rights-safety-reviewer",
    disposition,
    detectedControlClasses: Object.freeze(detectedControlClasses),
    decision: "approve",
    reviewDate,
    visibleAnnotationVersion,
  });
};

export const createLanguageAmbiguityEligibility = (
  value: unknown,
): LanguageAmbiguityEligibility => {
  try {
    const input = objectRecord(value, "languageAmbiguityEligibility");
    frozen(input, "languageAmbiguityEligibility");
    exactKeys(input, ROOT_KEYS, "languageAmbiguityEligibility");
    const eligibilityVersionId = text(input.eligibilityVersionId, "eligibilityVersionId");
    const contentId = text(input.contentId, "contentId");
    const evidenceVersion = text(input.evidenceVersion, "evidenceVersion");

    const candidateSet = input.candidateSet as LanguageCandidateSet;
    const correctCandidate = candidateSet.candidates.find(
      ({ id }) => id === candidateSet.correctCandidateId,
    ) ?? fail("candidateSet does not contain its correct candidate");
    const certifiedCorrectCandidateId = resolveLanguageCandidateId(
      candidateSet,
      correctCandidate.canonicalLabel,
    );
    if (certifiedCorrectCandidateId !== candidateSet.correctCandidateId) {
      fail("candidateSet correct candidate does not match its certified label");
    }
    const correctCandidateId = candidateSet.correctCandidateId;
    const candidateSetVersionId = candidateSet.versionId;
    const publicationEligibility = revalidatePublication(
      input.publicationEligibility as PublicationEligibility,
    );
    if (
      publicationEligibility.itemMode !== "language" ||
      publicationEligibility.contentId !== contentId ||
      publicationEligibility.evidenceVersion !== evidenceVersion
    ) fail("publicationEligibility is not bound to this language item");

    const technicalInputs = frozenArray(input.technicalReviews, "technicalReviews");
    if (technicalInputs.length !== TECHNICAL_ROLES.length) {
      fail("technicalReviews must contain exactly one reviewer A and reviewer B");
    }
    const technicalReviews = Object.freeze(TECHNICAL_ROLES.map((role) => {
      const matches = technicalInputs.filter((entry) =>
        objectRecord(entry, "technicalReview").role === role);
      if (matches.length !== 1) {
        return fail(`technicalReviews must contain exactly one ${role}`);
      }
      const publicationReview = publicationEligibility.reviews.find((review) => review.role === role);
      if (!publicationReview) return fail(`publicationEligibility lacks ${role}`);
      return parseTechnicalReview(
        matches[0],
        technicalInputs.indexOf(matches[0]),
        publicationReview,
        { contentId, evidenceVersion, candidateSetVersionId, correctCandidateId },
      );
    }));
    if (new Set(technicalReviews.map(({ reviewId }) => reviewId)).size !== technicalReviews.length) {
      fail("technicalReviews must have distinct reviewId values");
    }
    if (new Set(technicalReviews.map(({ reviewerId }) => reviewerId)).size !== technicalReviews.length) {
      fail("technicalReviews must have distinct reviewerId values");
    }

    const rightsReview = publicationEligibility.reviews.find(
      (review) => review.role === "rights-safety-reviewer",
    ) ?? fail("publicationEligibility lacks a rights/safety reviewer");
    const deceptiveTextControlReview = parseControlReview(
      input.deceptiveTextControlReview,
      rightsReview,
      { contentId, evidenceVersion, candidateSetVersionId },
    );

    return Object.freeze({
      eligibilityVersionId,
      contentId,
      evidenceVersion,
      candidateSetVersionId,
      correctCandidateId,
      publicationEligibility,
      technicalReviews,
      deceptiveTextControlReview,
      eligible: true,
    });
  } catch (error) {
    if (error instanceof LanguageAmbiguityRuleError) throw error;
    throw new LanguageAmbiguityRuleError("language ambiguity eligibility validation failed");
  }
};
