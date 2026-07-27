import type { EvidenceRecord } from "../../../../../../packages/content/src/index.js";
import type { PublicationEligibility } from "../../../../../../packages/content/src/review/publication-eligibility.js";
import type { ProvenanceRegime, ProvenanceSourceClass } from "../../../../../../packages/domain/src/index.js";
import {
  RevealAuthority,
  assertPublicProjectionSafe,
  type RevealGuards,
  type RevealRequest,
} from "../../../server/reveal/index.js";

type UnknownRecord = Record<string, unknown>;

export class ProvenanceProjectionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProvenanceProjectionError";
  }
}

export interface ProvenanceProjectionInput {
  readonly evidence: EvidenceRecord;
  readonly eligibility: PublicationEligibility;
  readonly regime: ProvenanceRegime;
  readonly authority: RevealAuthority;
  readonly request: RevealRequest;
  readonly guards: RevealGuards;
}

export function assertProvenanceProjectionPreflight(
  evidence: EvidenceRecord,
  eligibility: PublicationEligibility,
  regime: ProvenanceRegime,
): void {
  requireAcceptedBoundary(evidence, "evidence");
  requireAcceptedBoundary(eligibility, "eligibility");
  requireAcceptedBoundary(regime, "regime");
  validateIdentity(evidence, eligibility, regime);
  approvedDisclosure(evidence);
}

const TOP_LEVEL_FIELDS = [
  "evidence", "eligibility", "regime", "authority", "request", "guards",
] as const;
const REQUEST_FIELDS = [
  "participantLineageId", "betaDay", "manifestLineageId", "manifestVersionId",
  "sessionId", "roundId", "acceptedAnswerId", "requestedAt",
] as const;
const GUARD_FIELDS = [
  "inputValid", "authenticated", "authorized", "credentialValid",
  "antiForgeryValid", "rateLimitAllowed",
] as const;

const object = (value: unknown, field: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProvenanceProjectionError(`${field} must be an object`);
  }
  return value as UnknownRecord;
};

const exactFields = (value: UnknownRecord, fields: readonly string[], name: string): void => {
  const unknown = Object.keys(value).filter((field) => !fields.includes(field));
  const missing = fields.filter((field) => !(field in value));
  if (unknown.length > 0) throw new ProvenanceProjectionError(`${name} has unknown field ${unknown[0]}`);
  if (missing.length > 0) throw new ProvenanceProjectionError(`${name} is missing ${missing[0]}`);
};

const requireAcceptedBoundary = (value: object, name: string, seen = new Set<object>()): void => {
  if (seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) throw new ProvenanceProjectionError(`${name} must be a deeply frozen accepted boundary`);
  for (const nested of Object.values(value)) {
    if (typeof nested === "object" && nested !== null) requireAcceptedBoundary(nested, name, seen);
  }
};

const approvedDisclosure = (evidence: EvidenceRecord): string => {
  const disclosure = evidence.sourceClass === "model-output"
    ? evidence.approvedPublicAttributionOrDisclosureText
    : evidence.sourceClass === "stack-overflow"
      ? evidence.approvedRevealAttribution
      : evidence.attributionOrDisclosureText;
  if (typeof disclosure !== "string" || disclosure.trim().length === 0) {
    throw new ProvenanceProjectionError("approved disclosure is missing");
  }
  if (disclosure !== evidence.attributionOrDisclosureText) {
    throw new ProvenanceProjectionError("common and source-specific disclosure do not match");
  }
  return disclosure;
};

const preReveal = (regime: ProvenanceRegime) => Object.freeze({
  state: "PRE_REVEAL" as const,
  mode: "provenance" as const,
  sourceRegimeVersionId: regime.versionId,
  candidates: Object.freeze(regime.candidates.map(({ id, label }) => Object.freeze({ id, label }))),
});

const validateIdentity = (
  evidence: EvidenceRecord,
  eligibility: PublicationEligibility,
  regime: ProvenanceRegime,
): void => {
  if (eligibility.itemMode !== "provenance" || eligibility.eligible !== true) {
    throw new ProvenanceProjectionError("publication is not eligible for provenance mode");
  }
  if (eligibility.contentId !== evidence.stableId) {
    throw new ProvenanceProjectionError("content identity does not match evidence");
  }
  if (eligibility.evidenceVersion !== evidence.evidenceReference.versionId) {
    throw new ProvenanceProjectionError("evidence version does not match eligibility");
  }
  if (!regime.candidates.some(({ sourceClass }) => sourceClass === evidence.sourceClass)) {
    throw new ProvenanceProjectionError("evidence source is outside the source regime");
  }
  if (evidence.sourceClass === "stack-overflow") {
    const firstDisplayDecision = evidence.firstDisplayAttributionDecision.trim().toLocaleLowerCase("en");
    if (firstDisplayDecision !== "not required" && firstDisplayDecision !== "not required by approved determination") {
      throw new ProvenanceProjectionError("Stack Overflow first-display decision is not approved");
    }
    const covered = regime.sourceRegime.determination?.coveredItems.some((item) =>
      item.postId === evidence.postId && item.revisionId === evidence.revisionId &&
      item.licenseName === evidence.applicableLicense && item.licenseVersion === evidence.licenseVersion);
    if (covered !== true) throw new ProvenanceProjectionError("Stack Overflow evidence is not covered by the active determination");
  }
};

const validateAuthorization = (input: ProvenanceProjectionInput, authorization: ReturnType<RevealAuthority["authorize"]>): void => {
  const { request, evidence, regime } = input;
  if (authorization.response.outcome !== "AUTHORIZED" || authorization.audit.outcome !== "AUTHORIZED") {
    throw new ProvenanceProjectionError("reveal authorization is not authorized");
  }
  const { payload } = authorization.response;
  if (authorization.audit.acceptedAnswerId !== request.acceptedAnswerId ||
      authorization.audit.revealedAt !== request.requestedAt) {
    throw new ProvenanceProjectionError("authorization audit scope does not match request");
  }
  if (payload.versions.evidence !== evidence.evidenceReference.versionId ||
      authorization.audit.evidenceVersionId !== payload.versions.evidence) {
    throw new ProvenanceProjectionError("authorization evidence version does not match evidence");
  }
  if (payload.versions.content !== evidence.contentHash || payload.versions.candidateSet !== regime.versionId ||
      authorization.audit.revealVersionId !== payload.versions.reveal) {
    throw new ProvenanceProjectionError("authorization content, candidate-set, or reveal version does not match");
  }
};

export function createProvenancePublicProjection(value: unknown) {
  const raw = object(value, "projection input");
  exactFields(raw, TOP_LEVEL_FIELDS, "projection input");
  const input = raw as unknown as ProvenanceProjectionInput;
  exactFields(object(input.request, "request"), REQUEST_FIELDS, "request");
  exactFields(object(input.guards, "guards"), GUARD_FIELDS, "guards");
  if (!(input.authority instanceof RevealAuthority)) throw new ProvenanceProjectionError("authority must be an actual RevealAuthority");
  assertProvenanceProjectionPreflight(input.evidence, input.eligibility, input.regime);
  const disclosure = approvedDisclosure(input.evidence);
  const authorization = input.authority.authorize(input.request, input.guards);
  if (authorization.response.outcome !== "AUTHORIZED") {
    const projection = preReveal(input.regime);
    assertPublicProjectionSafe("PUBLIC_BUNDLE", projection);
    return projection;
  }
  const candidate = input.regime.candidates.find(({ sourceClass }) => sourceClass === input.evidence.sourceClass);
  if (!candidate) throw new ProvenanceProjectionError("recorded source candidate is unavailable");
  validateAuthorization(input, authorization);
  const payload = authorization.response.payload;
  const publicEvidence = `${input.evidence.evidenceReference.artifactId}@${input.evidence.evidenceReference.versionId}`;
  if (payload.requiredAttribution !== disclosure || payload.displayApprovedSourceEvidence !== publicEvidence) {
    throw new ProvenanceProjectionError("reveal does not use the approved disclosure");
  }
  const projection = Object.freeze({
    state: "REVEALED" as const, mode: "provenance" as const,
    correctSource: Object.freeze({ candidateId: candidate.id, sourceClass: candidate.sourceClass as ProvenanceSourceClass, label: candidate.label }),
    approvedAttribution: payload.requiredAttribution,
    evidenceReference: Object.freeze({ ...input.evidence.evidenceReference }),
    correctness: payload.correctness,
    helpfulSignals: Object.freeze([...payload.explanation.helpfulSignals]),
    misleadingSignals: Object.freeze([...payload.explanation.misleadingSignals]),
    versions: Object.freeze({ ...payload.versions, sourceRegime: input.regime.versionId }),
  });
  assertPublicProjectionSafe("PUBLIC_BUNDLE", projection);
  return projection;
}
