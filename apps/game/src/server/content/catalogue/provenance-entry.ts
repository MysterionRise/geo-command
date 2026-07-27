import { createHash } from "node:crypto";

import type { PromotedH001Record } from "../../../../../../packages/content/src/index.js";
import type {
  NegativeEvidence,
  ProvenanceCatalogueEntry,
  ProvenanceHandoff,
} from "./provenance-entry-types";
export type { ProvenanceCatalogueEntry } from "./provenance-entry-types";

type UnknownRecord = Record<string, unknown>;

export class ProvenanceCatalogueEntryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProvenanceCatalogueEntryError";
  }
}

const fail = (message: string): never => {
  throw new ProvenanceCatalogueEntryError(message);
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be non-blank`);
  }
  return value.trim();
};

const deepFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail("handoff must be deeply frozen");
  for (const nested of Object.values(value)) deepFrozen(nested, seen);
};

const exact = (value: unknown, fields: readonly string[], label: string): UnknownRecord => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${label} must be an object`);
  }
  const input = value as UnknownRecord;
  if (Object.keys(input).sort().join("|") !== [...fields].sort().join("|")) {
    fail(`${label} has an invalid shape`);
  }
  return input;
};

const TOP = [
  "status", "mode", "sourceClass", "purpose", "promotionIdentifier", "content",
  "round", "reveal", "provenance", "promotionReceipt",
] as const;
const CONTENT = ["stableId", "hash", "versionId", "excerpt"] as const;
const ROUND = [
  "roundId", "roundVersionId", "prompt", "candidates", "correctCandidateId",
  "clues", "versions",
] as const;
const VERSIONS = [
  "candidateSet", "clueSet", "scoring", "rules", "renderer", "reveal",
  "modeContract", "calibration", "sourceRegime",
] as const;
const REVEAL = [
  "evidence", "attribution", "sourceIdentity", "sourceUrl", "helpfulSignals",
  "misleadingSignals", "versions",
] as const;
const REVEAL_VERSIONS = [
  "content", "evidence", "candidateSet", "scoring", "rules", "reveal",
] as const;
const PROVENANCE = [
  "classification", "recordedModelName", "publicClaim",
] as const;
const NEGATIVE_PROVENANCE = [
  ...PROVENANCE, "creationOrCommissionBasis", "recordedProjectAuthorization",
  "noAgentParticipationAttestation",
] as const;
const PROMPT =
  "Is an AI coding agent durably recorded as participating in this code change?";
const FIXED_CANDIDATES = Object.freeze([
  Object.freeze({
    candidateId: "RECORDED_AGENT_PARTICIPATION",
    label: "RECORDED_AGENT_PARTICIPATION",
  }),
  Object.freeze({
    candidateId: "PROJECT_CONTROLLED_HUMAN_ONLY",
    label: "PROJECT_CONTROLLED_HUMAN_ONLY",
  }),
]);

const stringList = (value: unknown, field: string): readonly string[] => {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const entries = value as unknown[];
  return Object.freeze(entries.map((entry, index) =>
    text(entry, `${field}[${index}]`)));
};

const validateCandidates = (
  value: unknown,
  correct: unknown,
  expectedCorrect: string,
): void => {
  if (!Array.isArray(value) || value.length !== 2
    || correct !== expectedCorrect) {
    fail("provenance candidate binding is invalid");
  }
  const candidates = value as unknown[];
  for (const [index, expected] of FIXED_CANDIDATES.entries()) {
    const candidate = exact(
      candidates[index],
      ["candidateId", "label"],
      `candidate[${index}]`,
    );
    if (candidate.candidateId !== expected.candidateId
      || candidate.label !== expected.label) {
      fail("provenance candidate semantics drifted");
    }
  }
};

const validateHandoff = (value: unknown): ProvenanceHandoff => {
  deepFrozen(value);
  const root = exact(value, TOP, "promoted handoff");
  const positive = root.sourceClass === "licensed-github"
    && root.purpose === "RECORDED_AGENT_PARTICIPATION_CANDIDATE";
  const negative = root.sourceClass === "project-owned-human"
    && root.purpose === "PROJECT_CONTROLLED_HUMAN_ONLY";
  if (root.status !== "PROMOTED_H001" || root.mode !== "provenance"
    || (!positive && !negative)) {
    fail("handoff is not an approved Revision 7 provenance record");
  }
  exact(root.content, CONTENT, "content");
  const round = exact(root.round, ROUND, "round");
  exact(round.versions, VERSIONS, "round versions");
  const reveal = exact(root.reveal, REVEAL, "reveal");
  exact(reveal.versions, REVEAL_VERSIONS, "reveal versions");
  exact(
    root.provenance,
    negative ? NEGATIVE_PROVENANCE : PROVENANCE,
    "provenance evidence",
  );
  return value as ProvenanceHandoff;
};

const validateSemantics = (value: ProvenanceHandoff): void => {
  if (value.round.prompt !== PROMPT) fail("provenance prompt drifted");
  const negative = value.sourceClass === "project-owned-human";
  validateCandidates(
    value.round.candidates,
    value.round.correctCandidateId,
    negative
      ? "PROJECT_CONTROLLED_HUMAN_ONLY"
      : "RECORDED_AGENT_PARTICIPATION",
  );
  const evidence = value.provenance ?? fail("provenance evidence is missing");
  if (negative) {
    const record = evidence as NegativeEvidence;
    if (record.classification !== "PROJECT_CONTROLLED_HUMAN_ONLY"
      || record.recordedModelName !== null
      || record.publicClaim !==
        "No AI coding agent participation is affirmatively recorded for this project-controlled change.") {
      fail("project-controlled negative claim drifted");
    }
    for (const field of [
      "creationOrCommissionBasis", "recordedProjectAuthorization",
      "noAgentParticipationAttestation",
    ] as const) text(record[field], field);
    if (value.reveal.sourceUrl !== null) {
      fail("project-controlled negative must not infer a public source URL");
    }
    return;
  }
  const positive = evidence as Exclude<PromotedH001Record["provenance"], null>;
  const named = positive.classification === "NAMED_MODEL_RECORDED";
  if (named) {
    const model = text(positive.recordedModelName, "recordedModelName");
    if (positive.publicClaim !== model) fail("named-model claim drifted");
  } else if (positive.classification !== "AGENT_RECORDED"
    || positive.recordedModelName !== null
    || positive.publicClaim !== "AI coding agent") {
    fail("generic agent evidence was upgraded");
  }
};

const validateBindings = (value: ProvenanceHandoff): void => {
  const contentHash = createHash("sha256").update(value.content.excerpt).digest("hex");
  const { versions } = value.round;
  const receipt = value.promotionReceipt;
  if (contentHash !== value.content.hash || value.reveal.versions.content !== contentHash
    || value.reveal.versions.candidateSet !== versions.candidateSet
    || value.reveal.versions.scoring !== versions.scoring
    || value.reveal.versions.rules !== versions.rules
    || value.reveal.versions.reveal !== versions.reveal
    || (value.sourceClass === "licensed-github"
      && (receipt === null
        || receipt.status !== "PROMOTED_H001"
        || receipt.promotionIdentifier !== value.promotionIdentifier
        || receipt.mode !== value.mode
        || receipt.sourceClass !== value.sourceClass
        || receipt.purpose !== value.purpose
        || receipt.roundId !== value.round.roundId
        || receipt.roundVersionId !== value.round.roundVersionId
        || receipt.contentStableId !== value.content.stableId
        || receipt.contentHash !== value.content.hash
        || receipt.contentVersionId !== value.content.versionId
        || receipt.evidenceVersionId !== value.reveal.versions.evidence))
    || (value.sourceClass === "project-owned-human" && receipt !== null)) {
    fail("content or version binding drift");
  }
  if (value.sourceClass === "licensed-github"
    && (value.reveal.sourceUrl === null
      || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\//u
        .test(value.reveal.sourceUrl))) {
    fail("approved immutable source URL is invalid");
  }
};

export function createProvenanceCatalogueEntry(value: unknown): ProvenanceCatalogueEntry {
  const input = validateHandoff(value);
  validateSemantics(input);
  validateBindings(input);
  const provenance = input.provenance!;
  const { versions } = input.round;
  const clues = Object.freeze(input.round.clues.map((clue, index) => {
    if (clue.order !== index + 1 || index > 1) fail("clue order is invalid");
    return Object.freeze({ order: clue.order, label: text(clue.label, "clue label") });
  }));
  return Object.freeze({
    status: "APPROVED_PROVENANCE_CATALOGUE_ENTRY",
    publicRound: Object.freeze({
      roundId: text(input.round.roundId, "roundId"),
      roundVersionId: text(input.round.roundVersionId, "roundVersionId"),
      excerpt: Object.freeze({
        versionId: input.content.versionId, text: input.content.excerpt,
      }),
      mode: Object.freeze({
        kind: "provenance", contractVersionId: versions.modeContract,
        calibrationVersionId: versions.calibration, prompt: PROMPT,
        candidates: FIXED_CANDIDATES, clues,
      }),
      versions: Object.freeze({
        candidateSet: versions.candidateSet, clueSet: versions.clueSet,
        scoring: versions.scoring, rules: versions.rules,
      }),
    }),
    serverReveal: Object.freeze({
      correctCandidateId: input.round.correctCandidateId as
        | "RECORDED_AGENT_PARTICIPATION"
        | "PROJECT_CONTROLLED_HUMAN_ONLY",
      classification: provenance.classification,
      recordedModelName: provenance.recordedModelName,
      publicClaim: provenance.publicClaim,
      evidence: input.reveal.evidence, attribution: input.reveal.attribution,
      sourceIdentity: input.reveal.sourceIdentity, sourceUrl: input.reveal.sourceUrl,
      helpfulSignals: stringList(input.reveal.helpfulSignals, "helpfulSignals"),
      misleadingSignals: stringList(input.reveal.misleadingSignals, "misleadingSignals"),
      versions: Object.freeze({ ...input.reveal.versions }),
    }),
    bindings: Object.freeze({
      promotionIdentifier: input.promotionIdentifier,
      contentStableId: input.content.stableId,
      contentVersionId: input.content.versionId,
      contentHash: input.content.hash,
      evidenceVersionId: input.reveal.versions.evidence,
      rendererVersionId: versions.renderer,
      revealVersionId: versions.reveal,
      sourceRegimeVersionId: versions.sourceRegime,
      catalogueHash: input.promotionReceipt?.catalogueHash ??
        "project-controlled-negative",
    }),
  });
}
