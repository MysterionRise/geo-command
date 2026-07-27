import type { EvidenceSourceClass } from "../evidence/records";
export type ProvenanceSourceClass = EvidenceSourceClass;
export type SourceRegimeSelection = "project-owned-fallback" | "stack-overflow-enabled"
  | "licensed-github-vs-project-controlled";
export interface StackOverflowItemIdentity {
  readonly postId: string;
  readonly revisionId: string;
  readonly licenseName: string;
  readonly licenseVersion: string;
  readonly presentationDesignVersion: string;
  readonly interactionDesignVersion: string;
  readonly firstDisplayAttributionRequired: boolean;
}
export interface CoveredStackOverflowItem {
  readonly postId: string;
  readonly revisionId: string;
  readonly licenseName: string;
  readonly licenseVersion: string;
}
export interface DonApproval {
  readonly role: "Don";
  readonly signerId: string;
  readonly signedAt: string;
  readonly signature: string;
}
export interface RightsDeterminationInput {
  readonly determinationId: string;
  readonly writtenText: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly scope: string;
  readonly contributionRevisionDateTreatment: string;
  readonly consideredLicenseVersions: readonly string[];
  readonly attributionFormat: string;
  readonly shareAlikeTreatment: string;
  readonly effectiveDate: string;
  readonly presentationDesignVersion: string;
  readonly interactionDesignVersion: string;
  readonly attributionAtRevealSatisfiesLicense: boolean;
  readonly firstDisplayAttributionRequired: boolean;
  readonly coveredItems: readonly CoveredStackOverflowItem[];
  readonly approval: DonApproval;
}
export interface SourceRegimeSelectionInput {
  readonly versionId: string;
  readonly selectedAt: string;
  readonly selection: SourceRegimeSelection;
  readonly determination?: RightsDeterminationInput;
}
export interface RightsDetermination extends RightsDeterminationInput {
  readonly consideredLicenseVersions: readonly string[];
  readonly coveredItems: readonly CoveredStackOverflowItem[];
  readonly approval: DonApproval;
}
export interface SourceRegime {
  readonly versionId: string;
  readonly selectedAt: string;
  readonly selection: SourceRegimeSelection;
  readonly allowedSourceClasses: readonly ProvenanceSourceClass[];
  readonly determination: RightsDetermination | null;
  readonly prompt?: "Is an AI coding agent durably recorded as participating in this code change?";
  readonly candidateCount?: 2;
  readonly inactiveSourceClasses?: readonly string[];
}
export class SourceRegimeRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SourceRegimeRuleError";
  }
}
const FALLBACK_SOURCES: readonly EvidenceSourceClass[] =
  Object.freeze(["project-owned-human", "model-output"]);
const STACK_OVERFLOW_SOURCES: readonly EvidenceSourceClass[] =
  Object.freeze(["model-output", "stack-overflow"]);
const ACTIVE_SOURCES: readonly EvidenceSourceClass[] = Object.freeze([
  "licensed-github", "project-owned-human",
]);
const INACTIVE_SOURCES = Object.freeze([
  "stack-overflow", "model-output", "synthetic", "missing-marker-github",
]);
const PROVENANCE_PROMPT =
  "Is an AI coding agent durably recorded as participating in this code change?";
const nonBlank = (value: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceRegimeRuleError(`${field} must be a non-blank string`);
  }
  return value.trim();
};
const instant = (value: string, field: string): string => {
  const parsed = nonBlank(value, field);
  if (!Number.isFinite(Date.parse(parsed))) {
    throw new SourceRegimeRuleError(`${field} must be a valid instant`);
  }
  return parsed;
};
const calendarDate = (value: string, field: string): string => {
  const parsed = nonBlank(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed) || !Number.isFinite(Date.parse(`${parsed}T00:00:00Z`))) {
    throw new SourceRegimeRuleError(`${field} must be a valid calendar date`);
  }
  return parsed;
};
const stringList = (values: readonly string[], field: string): readonly string[] => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new SourceRegimeRuleError(`${field} must be a non-empty list`);
  }
  return Object.freeze(values.map((value, index) => nonBlank(value, `${field}[${index}]`)));
};
const freezeCoveredItems = (
  input: RightsDeterminationInput,
  considered: readonly string[],
): readonly CoveredStackOverflowItem[] => {
  if (!Array.isArray(input.coveredItems) || input.coveredItems.length === 0) {
    throw new SourceRegimeRuleError("coveredItems must be a non-empty list");
  }
  return Object.freeze(input.coveredItems.map((covered, index) => {
    const item = Object.freeze({
      postId: nonBlank(covered.postId, `coveredItems[${index}].postId`),
      revisionId: nonBlank(covered.revisionId, `coveredItems[${index}].revisionId`),
      licenseName: nonBlank(covered.licenseName, `coveredItems[${index}].licenseName`),
      licenseVersion: nonBlank(covered.licenseVersion, `coveredItems[${index}].licenseVersion`),
    });
    if (!considered.includes(`${item.licenseName} ${item.licenseVersion}`)) {
      throw new SourceRegimeRuleError(
        `coveredItems[${index}] license must appear in consideredLicenseVersions`);
    }
    return item;
  }));
};
const freezeDetermination = (input: RightsDeterminationInput): RightsDetermination => {
  if (input.attributionAtRevealSatisfiesLicense !== true) {
    throw new SourceRegimeRuleError("attributionAtRevealSatisfiesLicense must be true");
  }
  if (input.firstDisplayAttributionRequired !== false) {
    throw new SourceRegimeRuleError("firstDisplayAttributionRequired must be false");
  }
  if (!input.approval || input.approval.role !== "Don") {
    throw new SourceRegimeRuleError("approval.role must be Don");
  }
  const consideredLicenseVersions =
    stringList(input.consideredLicenseVersions, "consideredLicenseVersions");
  const coveredItems = freezeCoveredItems(input, consideredLicenseVersions);
  const approval = Object.freeze({
    role: "Don" as const,
    signerId: nonBlank(input.approval.signerId, "approval.signerId"),
    signedAt: instant(input.approval.signedAt, "approval.signedAt"),
    signature: nonBlank(input.approval.signature, "approval.signature"),
  });
  return Object.freeze({
    determinationId: nonBlank(input.determinationId, "determinationId"),
    writtenText: nonBlank(input.writtenText, "writtenText"),
    reviewerId: nonBlank(input.reviewerId, "reviewerId"),
    reviewerName: nonBlank(input.reviewerName, "reviewerName"),
    scope: nonBlank(input.scope, "scope"),
    contributionRevisionDateTreatment: nonBlank(
      input.contributionRevisionDateTreatment, "contributionRevisionDateTreatment"),
    consideredLicenseVersions,
    attributionFormat: nonBlank(input.attributionFormat, "attributionFormat"),
    shareAlikeTreatment: nonBlank(input.shareAlikeTreatment, "shareAlikeTreatment"),
    effectiveDate: calendarDate(input.effectiveDate, "effectiveDate"),
    presentationDesignVersion: nonBlank(
      input.presentationDesignVersion, "presentationDesignVersion"),
    interactionDesignVersion: nonBlank(
      input.interactionDesignVersion, "interactionDesignVersion"),
    attributionAtRevealSatisfiesLicense: true,
    firstDisplayAttributionRequired: false,
    coveredItems,
    approval,
  });
};
const createRegime = (input: SourceRegimeSelectionInput): SourceRegime => {
  const versionId = nonBlank(input.versionId, "versionId");
  const selectedAt = instant(input.selectedAt, "selectedAt");
  if (input.selection === "licensed-github-vs-project-controlled") {
    if (input.determination !== undefined) {
      throw new SourceRegimeRuleError("active provenance regime has no rights determination");
    }
    return Object.freeze({
      versionId, selectedAt, selection: input.selection,
      allowedSourceClasses: ACTIVE_SOURCES, determination: null,
      prompt: PROVENANCE_PROMPT, candidateCount: 2,
      inactiveSourceClasses: INACTIVE_SOURCES,
    });
  }
  if (input.selection === "project-owned-fallback") {
    if (input.determination !== undefined) {
      throw new SourceRegimeRuleError(
        "project-owned-fallback must not include a Stack Overflow determination");
    }
    return Object.freeze({
      versionId,
      selectedAt,
      selection: input.selection,
      allowedSourceClasses: FALLBACK_SOURCES,
      determination: null,
    });
  }
  if (input.selection !== "stack-overflow-enabled" || !input.determination) {
    throw new SourceRegimeRuleError(
      "stack-overflow-enabled requires an affirmative written determination");
  }
  const rights = freezeDetermination(input.determination);
  if (Date.parse(selectedAt) < Date.parse(rights.approval.signedAt)) {
    throw new SourceRegimeRuleError(
      "selectedAt must not precede approval.signedAt",
    );
  }
  if (Date.parse(selectedAt) < Date.parse(`${rights.effectiveDate}T00:00:00.000Z`)) {
    throw new SourceRegimeRuleError(
      "selectedAt must not precede determination.effectiveDate",
    );
  }
  return Object.freeze({
    versionId,
    selectedAt,
    selection: input.selection,
    allowedSourceClasses: STACK_OVERFLOW_SOURCES,
    determination: rights,
  });
};
const hasText = (input: Record<string, unknown>, field: string): boolean =>
  typeof input[field] === "string" && input[field]!.toString().trim().length > 0;
const activeCandidateEligible = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (input.answer === "RECORDED_AGENT_PARTICIPATION") {
    return input.sourceClass === "licensed-github" &&
      (input.markerClassification === "NAMED_MODEL_RECORDED" ||
        input.markerClassification === "AGENT_RECORDED");
  }
  return input.answer === "PROJECT_CONTROLLED_HUMAN_ONLY" &&
    input.sourceClass === "project-owned-human" &&
    ["creationOrCommissionBasis", "recordedProjectAuthorization",
      "noAgentParticipationAttestation"].every((field) => hasText(input, field));
};
export class SourceRegimeControl {
  readonly #active: SourceRegime;
  readonly #invitationsStartedAt: string | null;
  private constructor(active: SourceRegime, invitationsStartedAt: string | null) {
    this.#active = active;
    this.#invitationsStartedAt = invitationsStartedAt;
    Object.freeze(this);
  }
  public static select(input: SourceRegimeSelectionInput): SourceRegimeControl {
    return new SourceRegimeControl(createRegime(input), null);
  }
  public get active(): SourceRegime {
    return this.#active;
  }
  public get invitationsStartedAt(): string | null {
    return this.#invitationsStartedAt;
  }
  public allowsSourceClass(sourceClass: ProvenanceSourceClass): boolean {
    return this.#active.allowedSourceClasses.includes(sourceClass);
  }
  public allowsCandidate(input: unknown): boolean {
    return this.#active.selection === "licensed-github-vs-project-controlled" &&
      activeCandidateEligible(input);
  }
  public stackOverflowItemEligible(item: StackOverflowItemIdentity): boolean {
    const rights = this.#active.determination;
    if (
      this.#active.selection !== "stack-overflow-enabled" ||
      rights === null ||
      item.firstDisplayAttributionRequired !== false ||
      item.presentationDesignVersion !== rights.presentationDesignVersion ||
      item.interactionDesignVersion !== rights.interactionDesignVersion
    ) {
      return false;
    }
    return rights.coveredItems.some((covered) =>
      covered.postId === item.postId &&
      covered.revisionId === item.revisionId &&
      covered.licenseName === item.licenseName &&
      covered.licenseVersion === item.licenseVersion
    );
  }
  public replace(input: SourceRegimeSelectionInput): SourceRegimeControl {
    if (this.#invitationsStartedAt !== null) {
      throw new SourceRegimeRuleError(
        "source regime cannot change after invitations start",
      );
    }
    return SourceRegimeControl.select(input);
  }
  public startInvitations(startedAt: string): SourceRegimeControl {
    if (this.#invitationsStartedAt !== null) {
      throw new SourceRegimeRuleError("invitations have already started");
    }
    const invitationsStartedAt = instant(startedAt, "invitationsStartedAt");
    if (Date.parse(invitationsStartedAt) < Date.parse(this.#active.selectedAt)) {
      throw new SourceRegimeRuleError(
        "invitationsStartedAt must not precede selectedAt",
      );
    }
    return new SourceRegimeControl(this.#active, invitationsStartedAt);
  }
}
