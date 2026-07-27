import { parseEvidenceRecord, createPublicationEligibility } from "../../../../packages/content/src/index.js";
import { SourceRegimeControl } from "../../../../packages/content/src/rights/source-regime.js";
import { createProvenanceRegime, RoundPlay } from "../../../../packages/domain/src/index.js";
import { RevealAuthority } from "../../src/server/reveal/index.js";
import { createProvenanceCalibration } from "../../src/modes/provenance/server/provenance-calibration.js";

export const transitionId = "accepted-transition-flow-1";
export const request = Object.freeze({
  participantLineageId: "participant-flow", betaDay: "2026-08-02",
  manifestLineageId: "lineage-flow", manifestVersionId: "manifest-flow-v1",
  sessionId: "session-flow", roundId: "round-flow", acceptedAnswerId: transitionId,
  requestedAt: "2026-08-02T10:01:00.000Z",
});
export const guards = Object.freeze({
  inputValid: true, authenticated: true, authorized: true,
  credentialValid: true, antiForgeryValid: true, rateLimitAllowed: true,
});

export function fixture(correctness = false, versionOverrides: Partial<{
  content: string; candidateSet: string; scoring: string; rules: string; evidence: string; reveal: string;
}> = {}, excerpt = "const sum = values.reduce((total, value) => total + value, 0);") {
  const evidence = parseEvidenceRecord({
    stableId: "content-flow", sourceClass: "project-owned-human", contentHash: "content-flow-v1",
    excerpt,
    acquisitionMethod: "project commission", acquisitionDate: "2026-07-10",
    evidenceReference: { artifactId: "evidence-flow", versionId: "evidence-flow-v1" },
    creatorOrSourceIdentity: "creator-flow", ownershipLicenseAuthorizationBasis: "project authorization",
    reviewerIdentities: ["reviewer-a", "reviewer-b"], reviewerDates: ["2026-07-11", "2026-07-11"],
    eligibilityDecision: "eligible", attributionOrDisclosureText: "Created for this project.",
    correctionState: "current", publicationStatus: "approved",
    creationOrCommissionBasis: "commissioned", recordedProjectAuthorization: "authorization-flow",
  });
  const eligibility = createPublicationEligibility({
    contentId: evidence.stableId, itemMode: "provenance", evidenceVersion: evidence.evidenceReference.versionId,
    defensibleCompetingAnswers: [], approvalChecks: {
      answerIntegrity: true, ambiguity: true, difficulty: true, provenance: true, rights: true, attribution: true,
      secrets: true, personalData: true, safety: true, inertRendering: true, accessibility: true, evidenceMinimization: true,
    },
    reviews: [
      ["editor", "Editor", "content-editor", ["content-preparation", "evidence-record-training"]],
      ["technical-a", "Technical A", "technical-reviewer-a", ["provenance"]],
      ["technical-b", "Technical B", "technical-reviewer-b", ["provenance"]],
      ["rights", "Rights", "rights-safety-reviewer", ["don-approved-rights-safety-qualification"]],
    ].map(([reviewerId, reviewerName, role, qualifications]) => ({
      reviewerId: reviewerId as string, reviewerName: reviewerName as string,
      role: role as "content-editor" | "technical-reviewer-a" | "technical-reviewer-b" | "rights-safety-reviewer",
      qualifications: qualifications as string[], decision: "approve" as const, reviewDate: "2026-07-11",
      conflictDeclared: false, conflictDeclaration: "No conflict", evidenceVersion: evidence.evidenceReference.versionId,
    })),
  });
  const regime = createProvenanceRegime({
    sourceRegime: SourceRegimeControl.select({ versionId: "regime-flow-v1", selectedAt: "2026-08-01T09:00:00Z", selection: "project-owned-fallback" }).active,
    candidates: [
      { id: "candidate-human", sourceClass: "project-owned-human", label: "Project-owned human sample" },
      { id: "candidate-model", sourceClass: "model-output", label: "Recorded model output" },
    ],
  });
  const roundPlay = RoundPlay.create({
    roundVersionId: "round-flow-v1", scoringVersionId: "scoring-flow-v1",
    baseExcerpt: { referenceId: "excerpt-flow", versionId: "excerpt-flow-v1" }, clueSetVersionId: "clues-flow-v1",
    clues: [{ clueId: "clue-one", clueVersionId: "clue-one-v1", order: 1 }, { clueId: "clue-two", clueVersionId: "clue-two-v1", order: 2 }],
  });
  const calibration = createProvenanceCalibration(Object.freeze({
    versionId: "provenance-calibration-v1",
    sourceRegimeVersionId: regime.versionId,
    presentedCandidateCount: regime.candidates.length,
    chanceBaseline: 1 / regime.candidates.length,
    clueSetVersionId: roundPlay.definition.clueSetVersionId,
    configuredClueCount: roundPlay.definition.clues.length,
    scoringVersionId: roundPlay.definition.scoringVersionId,
  }));
  const authority = RevealAuthority.issue({
    ...request, acceptedAt: "2026-08-02T10:00:00Z", expiresAt: "2026-08-03T10:00:00Z",
    correctionStatus: "ACTIVE", revealBlocked: false,
  }, { load: () => ({
    correctness, requiredAttribution: evidence.attributionOrDisclosureText,
    displayApprovedSourceEvidence: "evidence-flow@evidence-flow-v1",
    explanation: { helpfulSignals: ["regular formatting"], misleadingSignals: ["generic names"] },
    versions: { content: evidence.contentHash, candidateSet: regime.versionId, scoring: "scoring-flow-v1", rules: "rules-flow-v1", evidence: evidence.evidenceReference.versionId, reveal: "reveal-flow-v1", ...versionOverrides },
  }) });
  return { evidence, eligibility, regime, roundPlay, calibration, authority };
}
