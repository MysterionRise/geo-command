export type ItemMode = "provenance" | "language";

export type ReviewerRole =
  | "content-editor"
  | "technical-reviewer-a"
  | "technical-reviewer-b"
  | "rights-safety-reviewer";

export type ReviewDecision = "approve" | "reject";

export interface ApprovalChecksInput {
  answerIntegrity: boolean;
  ambiguity: boolean;
  difficulty: boolean;
  provenance: boolean;
  rights: boolean;
  attribution: boolean;
  secrets: boolean;
  personalData: boolean;
  safety: boolean;
  inertRendering: boolean;
  accessibility: boolean;
  evidenceMinimization: boolean;
}

export interface ReviewerDecisionInput {
  reviewerId: string;
  reviewerName: string;
  role: ReviewerRole;
  qualifications: string[];
  decision: ReviewDecision;
  reviewDate: string;
  conflictDeclared: boolean;
  conflictDeclaration: string;
  evidenceVersion: string;
}

export interface PublicationEligibilityInput {
  contentId: string;
  itemMode: ItemMode;
  evidenceVersion: string;
  defensibleCompetingAnswers: string[];
  approvalChecks: ApprovalChecksInput;
  reviews: ReviewerDecisionInput[];
}

export interface ReviewerDecisionAudit {
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly role: ReviewerRole;
  readonly qualifications: readonly string[];
  readonly decision: "approve";
  readonly reviewDate: string;
  readonly conflictDeclared: false;
  readonly conflictDeclaration: string;
  readonly evidenceVersion: string;
}

export interface PublicationEligibility {
  readonly contentId: string;
  readonly itemMode: ItemMode;
  readonly evidenceVersion: string;
  readonly defensibleCompetingAnswers: readonly string[];
  readonly approvalChecks: Readonly<ApprovalChecksInput>;
  readonly reviews: readonly ReviewerDecisionAudit[];
  readonly eligible: true;
}

const REQUIRED_ROLES: readonly ReviewerRole[] = [
  "content-editor",
  "technical-reviewer-a",
  "technical-reviewer-b",
  "rights-safety-reviewer",
];

const TECHNICAL_ROLES: readonly ReviewerRole[] = [
  "technical-reviewer-a",
  "technical-reviewer-b",
];

const CONTENT_EDITOR_QUALIFICATIONS = [
  "content-preparation",
  "evidence-record-training",
] as const;

const RIGHTS_SAFETY_QUALIFICATIONS = [
  "don-approved-rights-safety-qualification",
  "counsel-status",
] as const;

const APPROVAL_FIELDS = [
  "answerIntegrity",
  "ambiguity",
  "difficulty",
  "provenance",
  "rights",
  "attribution",
  "secrets",
  "personalData",
  "safety",
  "inertRendering",
  "accessibility",
  "evidenceMinimization",
] as const satisfies readonly (keyof ApprovalChecksInput)[];

function nonBlank(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-blank string`);
  }
  return value.trim();
}

function parseQualifications(
  review: ReviewerDecisionInput,
  role: ReviewerRole,
  itemMode: ItemMode,
): readonly string[] {
  if (!Array.isArray(review.qualifications) || review.qualifications.length === 0) {
    throw new TypeError(`${role}.qualifications must be a non-empty string list`);
  }
  const qualifications = Object.freeze(
    review.qualifications.map((qualification, index) =>
      nonBlank(qualification, `${role}.qualifications[${index}]`),
    ),
  );
  if (
    role === "content-editor" &&
    CONTENT_EDITOR_QUALIFICATIONS.some(
      (qualification) => !qualifications.includes(qualification),
    )
  ) {
    throw new TypeError(
      "content-editor.qualifications must include content-preparation and evidence-record-training",
    );
  }
  if (
    role === "rights-safety-reviewer" &&
    !RIGHTS_SAFETY_QUALIFICATIONS.some((qualification) =>
      qualifications.includes(qualification),
    )
  ) {
    throw new TypeError(
      "rights-safety-reviewer.qualifications must include don-approved-rights-safety-qualification or counsel-status",
    );
  }
  if (TECHNICAL_ROLES.includes(role) && !qualifications.includes(itemMode)) {
    throw new TypeError(`${role}.qualifications must include ${itemMode}`);
  }
  return qualifications;
}

function parseReview(
  review: ReviewerDecisionInput,
  itemMode: ItemMode,
  evidenceVersion: string,
): ReviewerDecisionAudit {
  const role = review.role;
  if (!REQUIRED_ROLES.includes(role)) {
    throw new TypeError("review.role must identify a required role");
  }

  const reviewerId = nonBlank(review.reviewerId, `${role}.reviewerId`);
  const reviewerName = nonBlank(review.reviewerName, `${role}.reviewerName`);
  const reviewDate = nonBlank(review.reviewDate, `${role}.reviewDate`);
  const conflictDeclaration = nonBlank(
    review.conflictDeclaration,
    `${role}.conflictDeclaration`,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) {
    throw new TypeError(`${role}.reviewDate must be an ISO calendar date`);
  }
  const qualifications = parseQualifications(review, role, itemMode);
  if (review.decision !== "approve") {
    throw new TypeError(`${role}.decision must be approve`);
  }
  if (review.conflictDeclared !== false) {
    throw new TypeError(`${role}.conflictDeclared must be false`);
  }
  if (review.evidenceVersion !== evidenceVersion) {
    throw new TypeError(`${role}.evidenceVersion must match evidenceVersion`);
  }

  return Object.freeze({
    reviewerId,
    reviewerName,
    role,
    qualifications,
    decision: "approve",
    reviewDate,
    conflictDeclared: false,
    conflictDeclaration,
    evidenceVersion,
  });
}

function validateApprovalChecks(approvalChecks: ApprovalChecksInput): void {
  if (!approvalChecks || typeof approvalChecks !== "object") {
    throw new TypeError("approvalChecks must be an object");
  }
  for (const field of APPROVAL_FIELDS) {
    if (approvalChecks[field] !== true) {
      throw new TypeError(`approvalChecks.${field} must be true`);
    }
  }
}

function validateReviewSet(reviews: ReviewerDecisionInput[]): void {
  if (!Array.isArray(reviews) || reviews.length !== REQUIRED_ROLES.length) {
    throw new TypeError("reviews must contain exactly four entries");
  }
  for (const role of REQUIRED_ROLES) {
    if (!reviews.some((review) => review.role === role)) {
      throw new TypeError(`reviews must contain exactly one ${role}`);
    }
  }
  for (const role of REQUIRED_ROLES) {
    if (reviews.filter((review) => review.role === role).length !== 1) {
      throw new TypeError(`reviews must contain exactly one ${role}`);
    }
  }
}

function parseReviews(
  input: PublicationEligibilityInput,
  evidenceVersion: string,
): readonly ReviewerDecisionAudit[] {
  validateReviewSet(input.reviews);
  const reviews = Object.freeze(
    input.reviews.map((review) =>
      parseReview(review, input.itemMode, evidenceVersion),
    ),
  );
  if (new Set(reviews.map((review) => review.reviewerId)).size !== reviews.length) {
    throw new TypeError("reviews must identify four distinct reviewerId values");
  }
  if (
    new Set(reviews.map((review) => review.reviewerName.toLocaleLowerCase())).size !==
    reviews.length
  ) {
    throw new TypeError("reviews must identify four distinct reviewerName values");
  }
  return reviews;
}

export function createPublicationEligibility(
  input: PublicationEligibilityInput,
): PublicationEligibility {
  const contentId = nonBlank(input.contentId, "contentId");
  const evidenceVersion = nonBlank(input.evidenceVersion, "evidenceVersion");
  if (input.itemMode !== "language" && input.itemMode !== "provenance") {
    throw new TypeError("itemMode must be language or provenance");
  }
  if (!Array.isArray(input.defensibleCompetingAnswers)) {
    throw new TypeError("defensibleCompetingAnswers must be an array");
  }
  if (input.defensibleCompetingAnswers.length !== 0) {
    throw new TypeError("defensibleCompetingAnswers must be empty");
  }
  validateApprovalChecks(input.approvalChecks);
  const reviews = parseReviews(input, evidenceVersion);
  const approvalChecks = Object.freeze({ ...input.approvalChecks });
  return Object.freeze({
    contentId,
    itemMode: input.itemMode,
    evidenceVersion,
    defensibleCompetingAnswers: Object.freeze([]),
    approvalChecks,
    reviews,
    eligible: true,
  });
}
