import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { parseEvidenceRecord, createPublicationEligibility } from "../../../packages/content/src/index.js";
import { SourceRegimeControl } from "../../../packages/content/src/rights/source-regime.js";
import { createProvenanceRegime } from "../../../packages/domain/src/index.js";
import {
  RevealAuthority,
  type AcceptedAnswerEntitlement,
  type RevealGuards,
  type RevealRequest,
} from "../src/server/reveal/index.js";
import { createProvenancePublicProjection } from "../src/modes/provenance/server/provenance-projection.js";

const evidenceVersion = "evidence-v7";
const contentHash = "content-v5";
const disclosure = "Generated with recorded model model-7.";

const evidenceInput = {
  stableId: "content-17",
  sourceClass: "model-output",
  contentHash,
  excerpt: "const total = values.reduce((sum, value) => sum + value, 0);",
  acquisitionMethod: "recorded generation",
  acquisitionDate: "2026-07-10",
  evidenceReference: { artifactId: "evidence-17", versionId: evidenceVersion },
  creatorOrSourceIdentity: "provider-account-7",
  ownershipLicenseAuthorizationBasis: "recorded commercial-use review",
  reviewerIdentities: ["reviewer-1", "reviewer-2"],
  reviewerDates: ["2026-07-11", "2026-07-11"],
  eligibilityDecision: "eligible",
  attributionOrDisclosureText: disclosure,
  correctionState: "current",
  publicationStatus: "approved",
  provider: "provider-7",
  model: "model-7",
  generationDate: "2026-07-09",
  promptProvenanceOrApprovedRedactedEvidence: "restricted://prompt-17",
  availableGenerationParameters: "temperature=0.2",
  rawOutputHash: "sha256:restricted-raw-output",
  providerTermsVersion: "terms-2026-07",
  generatingAccountOrPlan: "commercial-plan",
  commercialUseBasis: "commercial use approved",
  dataUseOrTrainingSetting: "training disabled",
  knownProviderRestrictions: "none recorded",
  similarityOrContaminationReviewResult: "no material match recorded",
  reviewerThirdPartyRightsDecision: "approved",
  approvedPublicAttributionOrDisclosureText: disclosure,
  acquisitionOrReviewerDecision: "acquired and approved",
} as const;

const entitlement: AcceptedAnswerEntitlement = {
  participantLineageId: "participant-1",
  betaDay: "2026-08-02",
  manifestLineageId: "manifest-lineage-1",
  manifestVersionId: "manifest-v3",
  sessionId: "session-1",
  roundId: "round-4",
  acceptedAnswerId: "accepted-transition-9",
  acceptedAt: "2026-08-02T10:00:00.000Z",
  expiresAt: "2026-08-03T10:00:00.000Z",
  correctionStatus: "ACTIVE",
  revealBlocked: false,
};

const request: RevealRequest = {
  participantLineageId: entitlement.participantLineageId,
  betaDay: entitlement.betaDay,
  manifestLineageId: entitlement.manifestLineageId,
  manifestVersionId: entitlement.manifestVersionId,
  sessionId: entitlement.sessionId,
  roundId: entitlement.roundId,
  acceptedAnswerId: entitlement.acceptedAnswerId,
  requestedAt: "2026-08-02T10:01:00.000Z",
};

const eligibility = (evidence = parseEvidenceRecord(evidenceInput)) => createPublicationEligibility({
  contentId: evidence.stableId,
  itemMode: "provenance",
  evidenceVersion,
  defensibleCompetingAnswers: [],
  approvalChecks: {
    answerIntegrity: true, ambiguity: true, difficulty: true, provenance: true,
    rights: true, attribution: true, secrets: true, personalData: true,
    safety: true, inertRendering: true, accessibility: true, evidenceMinimization: true,
  },
  reviews: [
    ["editor", "Editor", "content-editor", ["content-preparation", "evidence-record-training"]],
    ["tech-a", "Technical A", "technical-reviewer-a", ["provenance"]],
    ["tech-b", "Technical B", "technical-reviewer-b", ["provenance"]],
    ["rights", "Rights", "rights-safety-reviewer", ["don-approved-rights-safety-qualification"]],
  ].map(([reviewerId, reviewerName, role, qualifications]) => ({
    reviewerId: reviewerId as string,
    reviewerName: reviewerName as string,
    role: role as "content-editor" | "technical-reviewer-a" | "technical-reviewer-b" | "rights-safety-reviewer",
    qualifications: qualifications as string[],
    decision: "approve" as const,
    reviewDate: "2026-07-11",
    conflictDeclared: false,
    conflictDeclaration: "No conflict declared",
    evidenceVersion,
  })),
});

const regime = (stackOverflow = false) => createProvenanceRegime({
  sourceRegime: SourceRegimeControl.select({
    versionId: "regime-v2",
    selectedAt: "2026-08-01T09:00:00.000Z",
    selection: stackOverflow ? "stack-overflow-enabled" : "project-owned-fallback",
    ...(stackOverflow ? { determination: {
      determinationId: "determination-1", writtenText: "Reveal attribution satisfies the license.",
      reviewerId: "rights-reviewer", reviewerName: "Rights Reviewer", scope: "Delayed reveal",
      contributionRevisionDateTreatment: "Use the recorded revision date.",
      consideredLicenseVersions: ["CC BY-SA 4.0"], attributionFormat: "Author, post, revision, license.",
      shareAlikeTreatment: "Retain notice.", effectiveDate: "2026-08-01",
      presentationDesignVersion: "presentation-v1", interactionDesignVersion: "interaction-v1",
      attributionAtRevealSatisfiesLicense: true as const, firstDisplayAttributionRequired: false as const,
      coveredItems: [{ postId: "17", revisionId: "revision-3", licenseName: "CC BY-SA", licenseVersion: "4.0" }],
      approval: { role: "Don" as const, signerId: "don-1", signedAt: "2026-08-01T08:00:00.000Z", signature: "signed-1" },
    } } : {}),
  }).active,
  candidates: stackOverflow ? [
    { id: "answer-model", sourceClass: "model-output", label: "Recorded model output" },
    { id: "answer-stack", sourceClass: "stack-overflow", label: "Recorded Stack Overflow publication" },
  ] : [
    { id: "answer-human", sourceClass: "project-owned-human", label: "Project-owned human sample" },
    { id: "answer-model", sourceClass: "model-output", label: "Recorded model output" },
  ],
});

const guards: RevealGuards = {
  inputValid: true, authenticated: true, authorized: true,
  credentialValid: true, antiForgeryValid: true, rateLimitAllowed: true,
};

type PayloadPatch = Partial<{
  correctness: boolean;
  requiredAttribution: string;
  displayApprovedSourceEvidence: string;
  versions: Partial<{ content: string; candidateSet: string; evidence: string }>;
}>;

const authority = (evidence = parseEvidenceRecord(evidenceInput), answerId = entitlement.acceptedAnswerId, patch: PayloadPatch = {}) => RevealAuthority.issue(
  { ...entitlement, acceptedAnswerId: answerId },
  { load: () => {
    const versions = {
      content: contentHash, candidateSet: "regime-v2", scoring: "scoring-v1", rules: "rules-v4",
      evidence: evidenceVersion, reveal: "reveal-v3", ...patch.versions,
    };
    return ({
    correctness: patch.correctness ?? true,
    requiredAttribution: patch.requiredAttribution ?? evidence.attributionOrDisclosureText,
    displayApprovedSourceEvidence: patch.displayApprovedSourceEvidence ?? `${evidence.evidenceReference.artifactId}@${evidence.evidenceReference.versionId}`,
    explanation: { helpfulSignals: ["regular formatting"], misleadingSignals: ["generic names"] },
    versions,
  }); } },
);

const input = (revealRequest: RevealRequest = request, evidence = parseEvidenceRecord(evidenceInput), sourceRegime = regime()) => ({
  evidence,
  eligibility: eligibility(evidence),
  regime: sourceRegime,
  authority: authority(evidence),
  request: revealRequest,
  guards,
});

describe("provenance public projection", () => {
  it("exposes the public projector only through a server-only entry", () => {
    const entry = readFileSync("apps/game/src/modes/provenance/server/index.ts", "utf8");
    expect(entry).toMatch(/^import "server-only";/);
    expect(entry).toContain('export { createProvenancePublicProjection } from "./provenance-projection.js";');
  });

  it("reveals only approved recorded facts after exact accepted-answer authorization", () => {
    const projection = createProvenancePublicProjection(input());

    expect(projection).toEqual({
      state: "REVEALED",
      mode: "provenance",
      correctSource: { candidateId: "answer-model", sourceClass: "model-output", label: "Recorded model output" },
      approvedAttribution: disclosure,
      evidenceReference: { artifactId: "evidence-17", versionId: evidenceVersion },
      correctness: true,
      helpfulSignals: ["regular formatting"],
      misleadingSignals: ["generic names"],
      versions: {
        content: contentHash, candidateSet: "regime-v2", scoring: "scoring-v1",
        rules: "rules-v4", evidence: evidenceVersion, reveal: "reveal-v3", sourceRegime: "regime-v2",
      },
    });
    expect(JSON.stringify(projection)).not.toMatch(/provider-7|provider-account-7|prompt|rawOutput|restricted:\/\//i);
    expect(Object.isFrozen(projection)).toBe(true);
    if (projection.state !== "REVEALED") throw new Error("expected revealed projection");
    expect(Object.isFrozen(projection.evidenceReference)).toBe(true);
    expect(Object.isFrozen(projection.helpfulSignals)).toBe(true);
    expect(Object.isFrozen(projection.misleadingSignals)).toBe(true);
  });

  it("fails closed to candidates when reveal authorization is denied", () => {
    const mismatched = { ...request, roundId: "other-round" };
    const projection = createProvenancePublicProjection(input(mismatched));
    expect(projection).toEqual({
      state: "PRE_REVEAL",
      mode: "provenance",
      sourceRegimeVersionId: "regime-v2",
      candidates: [
        { id: "answer-human", label: "Project-owned human sample" },
        { id: "answer-model", label: "Recorded model output" },
      ],
    });
    expect(JSON.stringify(projection)).not.toMatch(/correct|evidence|prompt|raw|answer-model.*true/i);
  });

  it("rejects unknown fields and mismatched evidence, content, or regime identity", () => {
    expect(() => createProvenancePublicProjection({ ...input(), restrictedEvidence: {} })).toThrow(/unknown field/i);
    expect(() => createProvenancePublicProjection({ ...input(), request: { ...request, extra: true } })).toThrow(/unknown field/i);
    expect(() => createProvenancePublicProjection({ ...input(), guards: { ...guards, extra: true } })).toThrow(/unknown field/i);
    expect(() => createProvenancePublicProjection({
      ...input(),
      evidence: parseEvidenceRecord({ ...evidenceInput, stableId: "other-content" }),
    })).toThrow(/content/i);
    expect(() => createProvenancePublicProjection({
      ...input(),
      evidence: parseEvidenceRecord({ ...evidenceInput, evidenceReference: { artifactId: "evidence-17", versionId: "other" } }),
    })).toThrow(/evidence/i);
  });

  it("rejects missing approved disclosure and authorization payload version drift", () => {
    const base = input();
    const missingDisclosure = Object.freeze({ ...base.evidence, approvedPublicAttributionOrDisclosureText: "" });
    expect(() => createProvenancePublicProjection({ ...base, evidence: missingDisclosure })).toThrow(/disclosure/i);
    expect(() => createProvenancePublicProjection({ ...base, authority: { authorize: () => ({}) } })).toThrow(/authority/i);
  });

  it.each([
    "participantLineageId", "betaDay", "manifestLineageId", "manifestVersionId",
    "sessionId", "roundId", "acceptedAnswerId",
  ] as const)("fails closed without protected output for mismatched %s", (field) => {
    const changed = { ...request, [field]: `wrong-${field}` };
    const projection = createProvenancePublicProjection({ ...input(), request: changed });
    expect(projection.state).toBe("PRE_REVEAL");
    expect(JSON.stringify(projection)).not.toMatch(/correctSource|correctness|approvedAttribution|evidenceReference|helpfulSignals|misleadingSignals|revealVersion/i);
  });

  it("fails closed for a premature request", () => {
    const premature = { ...request, requestedAt: "2026-08-02T09:59:00.000Z" };
    expect(createProvenancePublicProjection({ ...input(), request: premature }).state).toBe("PRE_REVEAL");
  });

  it("fails closed on replay without loading protected payload twice", () => {
    const evidence = parseEvidenceRecord(evidenceInput);
    let loads = 0;
    const replayAuthority = RevealAuthority.issue(entitlement, { load: () => {
      loads += 1;
      return {
        correctness: true, requiredAttribution: disclosure,
        displayApprovedSourceEvidence: `evidence-17@${evidenceVersion}`,
        explanation: { helpfulSignals: ["regular formatting"], misleadingSignals: ["generic names"] },
        versions: { content: contentHash, candidateSet: "regime-v2", scoring: "scoring-v1", rules: "rules-v4", evidence: evidenceVersion, reveal: "reveal-v3" },
      };
    } });
    const replayInput = { ...input(), authority: replayAuthority };
    expect(createProvenancePublicProjection(replayInput).state).toBe("REVEALED");
    const replay = createProvenancePublicProjection(replayInput);
    expect(replay.state).toBe("PRE_REVEAL");
    expect(JSON.stringify(replay)).not.toMatch(/correctSource|approvedAttribution|evidenceReference|helpfulSignals|revealVersion/i);
    expect(loads).toBe(1);
  });

  it.each(["evidence", "eligibility", "regime"] as const)("rejects mutable accepted-boundary %s", (field) => {
    const base = input();
    expect(() => createProvenancePublicProjection({ ...base, [field]: { ...base[field] } })).toThrow(/frozen|accepted boundary/i);
  });

  it.each(["evidenceReference", "approvalChecks", "reviews", "candidates"] as const)("rejects shallow-frozen boundary with mutable nested %s", (field) => {
    const base = input();
    const changed = field === "evidenceReference"
      ? { evidence: Object.freeze({ ...base.evidence, evidenceReference: { ...base.evidence.evidenceReference } }) }
      : field === "approvalChecks"
        ? { eligibility: Object.freeze({ ...base.eligibility, approvalChecks: { ...base.eligibility.approvalChecks } }) }
        : field === "reviews"
          ? { eligibility: Object.freeze({ ...base.eligibility, reviews: [...base.eligibility.reviews] }) }
          : { regime: Object.freeze({ ...base.regime, candidates: [...base.regime.candidates] }) };
    expect(() => createProvenancePublicProjection({ ...base, ...changed })).toThrow(/deeply frozen|accepted boundary/i);
  });

  it("rejects shallow-frozen Stack determination and covered items", () => {
    const base = input();
    const accepted = regime(true);
    const determination = accepted.sourceRegime.determination!;
    const mutableDetermination = Object.freeze({ ...determination, coveredItems: [...determination.coveredItems] });
    const changed = Object.freeze({
      ...accepted,
      sourceRegime: Object.freeze({ ...accepted.sourceRegime, determination: mutableDetermination }),
    });
    expect(() => createProvenancePublicProjection({ ...base, regime: changed })).toThrow(/deeply frozen|accepted boundary/i);
  });

  it.each(["project-owned-human", "stack-overflow"] as const)("projects approved evidence reference for %s without raw source facts", (sourceClass) => {
    const sourceSpecific = sourceClass === "project-owned-human"
      ? { sourceClass, creationOrCommissionBasis: "commission", recordedProjectAuthorization: "authorization-1" }
      : {
          sourceClass, sourceUrl: "https://stackoverflow.com/questions/17", postId: "17", revisionId: "revision-3",
          author: "author-1", contributionOrRevisionDate: "2026-06-01", applicableLicense: "CC BY-SA", licenseVersion: "4.0",
          acquisitionBasis: "approved export", firstDisplayAttributionDecision: "not required",
          approvedRevealAttribution: "Author, post 17, revision 3, CC BY-SA 4.0",
        };
    const approved = sourceClass === "stack-overflow" ? sourceSpecific.approvedRevealAttribution : "Created for this project.";
    const evidence = parseEvidenceRecord({ ...evidenceInput, ...sourceSpecific, attributionOrDisclosureText: approved });
    const projection = createProvenancePublicProjection(input(request, evidence, regime(sourceClass === "stack-overflow")));
    expect(projection.state).toBe("REVEALED");
    if (projection.state !== "REVEALED") throw new Error("expected revealed projection");
    expect(JSON.stringify(projection)).not.toMatch(/stackoverflow\.com|author-1|commission|authorization-1/);
    expect(projection.evidenceReference).toEqual({ artifactId: "evidence-17", versionId: evidenceVersion });
  });

  it.each(["model-output", "stack-overflow"] as const)("rejects common disclosure drift for %s", (sourceClass) => {
    const source = sourceClass === "model-output" ? evidenceInput : {
      ...evidenceInput, sourceClass, sourceUrl: "https://stackoverflow.com/questions/17", postId: "17", revisionId: "revision-3",
      author: "author-1", contributionOrRevisionDate: "2026-06-01", applicableLicense: "CC BY-SA", licenseVersion: "4.0",
      acquisitionBasis: "approved export", firstDisplayAttributionDecision: "not required", approvedRevealAttribution: "approved stack attribution",
    };
    const evidence = parseEvidenceRecord({ ...source, attributionOrDisclosureText: "different common disclosure" });
    expect(() => createProvenancePublicProjection(input(
      request, evidence, regime(sourceClass === "stack-overflow"),
    ))).toThrow(/disclosure/i);
  });

  it.each([
    ["attribution", { requiredAttribution: "wrong" }],
    ["display evidence", { displayApprovedSourceEvidence: "wrong" }],
    ["evidence version", { versions: { evidence: "wrong" } }],
    ["candidate set", { versions: { candidateSet: "wrong" } }],
    ["content version", { versions: { content: "wrong" } }],
  ] as const)("rejects actual authority payload drift: %s", (_name, patch) => {
    const base = input();
    expect(() => createProvenancePublicProjection({ ...base, authority: authority(base.evidence, entitlement.acceptedAnswerId, patch) })).toThrow();
  });

  it.each([
    ["postId", "wrong-post"], ["revisionId", "wrong-revision"],
    ["applicableLicense", "wrong-license"], ["licenseVersion", "wrong-version"],
  ] as const)("rejects Stack Overflow determination coverage drift in %s", (field, value) => {
    const evidence = parseEvidenceRecord({
      ...evidenceInput, sourceClass: "stack-overflow", sourceUrl: "https://stackoverflow.com/questions/17",
      postId: "17", revisionId: "revision-3", author: "author-1", contributionOrRevisionDate: "2026-06-01",
      applicableLicense: "CC BY-SA", licenseVersion: "4.0", acquisitionBasis: "approved export",
      firstDisplayAttributionDecision: "not required", approvedRevealAttribution: "approved stack attribution",
      attributionOrDisclosureText: "approved stack attribution", [field]: value,
    });
    expect(() => createProvenancePublicProjection(input(
      request, evidence, regime(true),
    ))).toThrow(/covered|determination/i);
  });

  it.each(["required", "", "not needed"])("rejects Stack Overflow first-display decision %j", (decision) => {
    const valid = parseEvidenceRecord({
      ...evidenceInput, sourceClass: "stack-overflow", sourceUrl: "https://stackoverflow.com/questions/17",
      postId: "17", revisionId: "revision-3", author: "author-1", contributionOrRevisionDate: "2026-06-01",
      applicableLicense: "CC BY-SA", licenseVersion: "4.0", acquisitionBasis: "approved export",
      firstDisplayAttributionDecision: "not required", approvedRevealAttribution: "approved stack attribution",
      attributionOrDisclosureText: "approved stack attribution",
    });
    const evidence = Object.freeze({ ...valid, firstDisplayAttributionDecision: decision });
    expect(() => createProvenancePublicProjection(input(
      request, evidence, regime(true),
    ))).toThrow(/first-display/i);
  });

  it("accepts the recorded approved-determination first-display wording with trim and case differences", () => {
    const valid = parseEvidenceRecord({
      ...evidenceInput, sourceClass: "stack-overflow", sourceUrl: "https://stackoverflow.com/questions/17",
      postId: "17", revisionId: "revision-3", author: "author-1", contributionOrRevisionDate: "2026-06-01",
      applicableLicense: "CC BY-SA", licenseVersion: "4.0", acquisitionBasis: "approved export",
      firstDisplayAttributionDecision: "  NOT REQUIRED BY APPROVED DETERMINATION  ", approvedRevealAttribution: "approved stack attribution",
      attributionOrDisclosureText: "approved stack attribution",
    });
    expect(createProvenancePublicProjection(input(
      request, valid, regime(true),
    ))).toMatchObject({ state: "REVEALED" });
  });

  it("reveals the evidence-derived correct source after an authorized incorrect answer", () => {
    const base = input();
    const projection = createProvenancePublicProjection({
      ...base,
      authority: authority(base.evidence, entitlement.acceptedAnswerId, { correctness: false }),
    });
    expect(projection).toMatchObject({
      state: "REVEALED",
      correctness: false,
      correctSource: { candidateId: "answer-model", sourceClass: "model-output" },
    });
  });
});
