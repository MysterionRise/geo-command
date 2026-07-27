import {
  createLanguageAmbiguityEligibility,
  createPublicationEligibility,
  parseEvidenceRecord,
} from "../../../../packages/content/src/index.js";
import {
  createLanguageCandidatePresentation,
  createLanguageCandidateSet,
  RoundPlay,
} from "../../../../packages/domain/src/index.js";
import { RevealAuthority } from "../../src/server/reveal/index.js";

export const transitionId = "language-transition-17";
export const request = Object.freeze({
  participantLineageId: "participant-language",
  betaDay: "2026-08-03",
  manifestLineageId: "lineage-language",
  manifestVersionId: "manifest-language-v1",
  sessionId: "session-language",
  roundId: "round-language",
  acceptedAnswerId: transitionId,
  requestedAt: "2026-08-03T10:01:00.000Z",
});
export const guards = Object.freeze({
  inputValid: true,
  authenticated: true,
  authorized: true,
  credentialValid: true,
  antiForgeryValid: true,
  rateLimitAllowed: true,
});

export const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
};

type FixtureOptions = Readonly<{
  clueCount?: 0 | 1 | 2;
  correctness?: boolean;
  annotatedControls?: boolean;
  detectedControlClasses?: readonly ("bidi" | "zero-width")[];
  excerpt?: string;
  versionOverrides?: Partial<{
    content: string;
    candidateSet: string;
    scoring: string;
    rules: string;
    evidence: string;
    reveal: string;
  }>;
}>;

export function languageFixture(options: FixtureOptions = {}) {
  const clueCount = options.clueCount ?? 2;
  const excerpt = options.excerpt ?? "const total: number = values.reduce((sum, value) => sum + value, 0);";
  const evidence = parseEvidenceRecord({
    stableId: "content-language",
    sourceClass: "project-owned-human",
    contentHash: "content-language-v1",
    excerpt,
    acquisitionMethod: "project commission",
    acquisitionDate: "2026-07-10",
    evidenceReference: { artifactId: "evidence-language", versionId: "evidence-language-v1" },
    creatorOrSourceIdentity: "creator-language",
    ownershipLicenseAuthorizationBasis: "project authorization",
    reviewerIdentities: ["editor-language", "technical-language-a", "technical-language-b", "rights-language"],
    reviewerDates: ["2026-07-11", "2026-07-11", "2026-07-11", "2026-07-11"],
    eligibilityDecision: "eligible",
    attributionOrDisclosureText: "Created for this project.",
    correctionState: "current",
    publicationStatus: "approved",
    creationOrCommissionBasis: "commissioned",
    recordedProjectAuthorization: "authorization-language",
  });
  const clues = [
    { clueId: "language-clue-one", clueVersionId: "language-clue-one-v1", order: 1 as const },
    { clueId: "language-clue-two", clueVersionId: "language-clue-two-v1", order: 2 as const },
  ].slice(0, clueCount);
  const candidateSet = createLanguageCandidateSet(deepFreeze({
    versionId: "language-set-v1",
    presentedCandidateCount: 3,
    correctCandidateId: "lang-ts-01",
    candidates: [
      { id: "lang-ts-01", canonicalLabel: "TypeScript", aliases: ["ts"], distractorRationale: null },
      { id: "lang-js-01", canonicalLabel: "JavaScript", aliases: ["js"], distractorRationale: "Similar syntax without static type annotations." },
      { id: "lang-flow-01", canonicalLabel: "Flow", aliases: ["flowtype"], distractorRationale: "Related annotations with different language-specific signals." },
    ],
    orderingPolicy: { versionId: "language-ordering-policy-v1", kind: "deterministic" as const },
    clueSetVersionId: "language-clue-set-v1",
    cluePolicyVersionId: "language-clue-policy-v1",
    scoringVersionId: "language-scoring-v1",
    clues,
    calibration: {
      versionId: "language-calibration-v1",
      candidateSetVersionId: "language-set-v1",
      presentedCandidateCount: 3,
      chanceBaseline: 1 / 3,
      cluePolicyVersionId: "language-clue-policy-v1",
      configuredClueCount: clueCount,
      scoringVersionId: "language-scoring-v1",
    },
  }));
  const presentation = createLanguageCandidatePresentation(candidateSet, deepFreeze({
    recordId: "language-ordering-record-v1",
    sessionId: request.sessionId,
    candidateSetVersionId: candidateSet.versionId,
    policyVersionId: candidateSet.orderingPolicy.versionId,
    kind: "deterministic" as const,
    presentedCandidateIds: ["lang-ts-01", "lang-js-01", "lang-flow-01"],
  }));
  const reviews = [
    ["editor-language", "Editor Language", "content-editor", ["content-preparation", "evidence-record-training"]],
    ["technical-language-a", "Technical Language A", "technical-reviewer-a", ["language"]],
    ["technical-language-b", "Technical Language B", "technical-reviewer-b", ["language", "provenance"]],
    ["rights-language", "Rights Language", "rights-safety-reviewer", ["don-approved-rights-safety-qualification"]],
  ].map(([reviewerId, reviewerName, role, qualifications]) => ({
    reviewerId: reviewerId as string,
    reviewerName: reviewerName as string,
    role: role as "content-editor" | "technical-reviewer-a" | "technical-reviewer-b" | "rights-safety-reviewer",
    qualifications: qualifications as string[],
    decision: "approve" as const,
    reviewDate: "2026-07-11",
    conflictDeclared: false,
    conflictDeclaration: "No conflict",
    evidenceVersion: evidence.evidenceReference.versionId,
  }));
  const publicationEligibility = createPublicationEligibility({
    contentId: evidence.stableId,
    itemMode: "language",
    evidenceVersion: evidence.evidenceReference.versionId,
    defensibleCompetingAnswers: [],
    approvalChecks: {
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
    },
    reviews,
  });
  const technicalReviews = reviews.slice(1, 3).map((review, index) => deepFreeze({
    reviewId: `language-technical-decision-${index + 1}`,
    contentId: evidence.stableId,
    evidenceVersion: evidence.evidenceReference.versionId,
    candidateSetVersionId: candidateSet.versionId,
    reviewerId: review.reviewerId,
    reviewerName: review.reviewerName,
    role: review.role as "technical-reviewer-a" | "technical-reviewer-b",
    qualifications: [...review.qualifications],
    conflictDeclared: false,
    reviewDate: review.reviewDate,
    defensibleCandidateIds: [candidateSet.correctCandidateId],
  }));
  const annotatedControls = options.annotatedControls ?? false;
  const detectedControlClasses = options.detectedControlClasses ?? (annotatedControls ? ["bidi" as const] : []);
  const controlReview = deepFreeze({
    decisionId: "language-control-decision-v1",
    versionId: "language-control-review-v1",
    contentId: evidence.stableId,
    evidenceVersion: evidence.evidenceReference.versionId,
    candidateSetVersionId: candidateSet.versionId,
    reviewerId: reviews[3]!.reviewerId,
    reviewerName: reviews[3]!.reviewerName,
    role: "rights-safety-reviewer" as const,
    disposition: annotatedControls ? "approved-visible-annotation" as const : "absent" as const,
    detectedControlClasses: [...detectedControlClasses],
    decision: "approve" as const,
    reviewDate: reviews[3]!.reviewDate,
    visibleAnnotationVersion: annotatedControls ? "language-control-annotation-v1" : null,
  });
  const eligibility = createLanguageAmbiguityEligibility(deepFreeze({
    eligibilityVersionId: "language-ambiguity-v1",
    contentId: evidence.stableId,
    evidenceVersion: evidence.evidenceReference.versionId,
    candidateSet,
    publicationEligibility,
    technicalReviews,
    deceptiveTextControlReview: controlReview,
  }));
  const roundPlay = RoundPlay.create({
    roundVersionId: "language-round-v1",
    scoringVersionId: candidateSet.scoringVersionId,
    baseExcerpt: { referenceId: evidence.stableId, versionId: evidence.contentHash },
    clueSetVersionId: candidateSet.clueSetVersionId,
    clues,
  });
  const authority = RevealAuthority.issue({
    ...request,
    acceptedAt: "2026-08-03T10:00:00Z",
    expiresAt: "2026-08-04T10:00:00Z",
    correctionStatus: "ACTIVE",
    revealBlocked: false,
  }, { load: () => ({
    correctness: options.correctness ?? true,
    requiredAttribution: evidence.attributionOrDisclosureText,
    displayApprovedSourceEvidence: "evidence-language@evidence-language-v1",
    explanation: {
      helpfulSignals: ["explicit type annotation"],
      misleadingSignals: ["JavaScript-compatible runtime syntax"],
    },
    versions: {
      content: evidence.contentHash,
      candidateSet: candidateSet.versionId,
      scoring: candidateSet.scoringVersionId,
      rules: "language-rules-v1",
      evidence: evidence.evidenceReference.versionId,
      reveal: "language-reveal-v1",
      ...options.versionOverrides,
    },
  }) });
  return { evidence, candidateSet, presentation, eligibility, roundPlay, authority };
}
