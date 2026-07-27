import { createHash } from "node:crypto";

import type { PromotedH001Record } from "../../../../../../packages/content/src/index.js";

type UnknownRecord = Record<string, unknown>;
export type LanguageCatalogueEntry = Readonly<{
  status: "APPROVED_LANGUAGE_CATALOGUE_ENTRY";
  publicRound: Readonly<{
    roundId: string;
    roundVersionId: string;
    excerpt: Readonly<{ versionId: string; text: string }>;
    mode: Readonly<{
      kind: "language";
      contractVersionId: string;
      calibrationVersionId: string;
      prompt: string;
      candidates: readonly Readonly<{ candidateId: string; label: string }>[];
      clues: readonly Readonly<{ order: 1 | 2; label: string }>[];
    }>;
    versions: Readonly<{
      candidateSet: string; clueSet: string; scoring: string; rules: string;
    }>;
  }>;
  serverReveal: Readonly<{
    correctCandidateId: string;
    evidence: string;
    attribution: string;
    sourceIdentity: string;
    sourceUrl: string;
    helpfulSignals: readonly string[];
    misleadingSignals: readonly string[];
    versions: Readonly<{
      content: string; evidence: string; candidateSet: string;
      scoring: string; rules: string; reveal: string;
    }>;
  }>;
  bindings: Readonly<{
    promotionIdentifier: string; contentStableId: string; contentVersionId: string;
    contentHash: string; evidenceVersionId: string; rendererVersionId: string;
    revealVersionId: string; catalogueHash: string;
  }>;
}>;

export class LanguageCatalogueEntryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LanguageCatalogueEntryError";
  }
}

const fail = (message: string): never => {
  throw new LanguageCatalogueEntryError(message);
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

const validateCandidates = (value: unknown, correct: unknown) => {
  if (!Array.isArray(value) || value.length < 2) fail("candidate set is incomplete");
  const values = value as unknown[];
  const candidates = values.map((entry: unknown, index: number) => {
    const candidate = exact(entry, ["candidateId", "label"], `candidate[${index}]`);
    return Object.freeze({
      candidateId: text(candidate.candidateId, "candidateId"),
      label: text(candidate.label, "candidate label"),
    });
  });
  const correctCandidateId = text(correct, "correctCandidateId");
  for (const field of ["candidateId", "label"] as const) {
    const canonical = candidates.map((candidate) =>
      candidate[field].toLocaleLowerCase("en"));
    if (new Set(canonical).size !== canonical.length) fail("candidate set is ambiguous");
  }
  if (!candidates.some(({ candidateId }) => candidateId === correctCandidateId)) {
    fail("correct candidate is not in the candidate set");
  }
  return { candidates: Object.freeze(candidates), correctCandidateId };
};

const stringList = (value: unknown, field: string): readonly string[] => {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const values = value as unknown[];
  return Object.freeze(values.map((entry: unknown, index: number) =>
    text(entry, `${field}[${index}]`)));
};

const validateHandoff = (value: unknown): PromotedH001Record => {
  deepFrozen(value);
  const root = exact(value, TOP, "promoted handoff");
  if (root.status !== "PROMOTED_H001" || root.mode !== "language"
    || root.sourceClass !== "licensed-github" || root.purpose !== "LANGUAGE_CANDIDATE"
    || root.provenance !== null) {
    fail("handoff is not an approved licensed-GitHub language record");
  }
  exact(root.content, CONTENT, "content");
  exact(root.round, ROUND, "round");
  exact((root.round as UnknownRecord).versions, VERSIONS, "round versions");
  exact(root.reveal, REVEAL, "reveal");
  exact((root.reveal as UnknownRecord).versions, REVEAL_VERSIONS, "reveal versions");
  return value as PromotedH001Record;
};

const validateBindings = (value: PromotedH001Record): void => {
  const hash = createHash("sha256").update(value.content.excerpt).digest("hex");
  const { versions } = value.round;
  const receipt = value.promotionReceipt;
  if (hash !== value.content.hash || value.reveal.versions.content !== value.content.hash
    || value.reveal.versions.candidateSet !== versions.candidateSet
    || value.reveal.versions.scoring !== versions.scoring
    || value.reveal.versions.rules !== versions.rules
    || value.reveal.versions.reveal !== versions.reveal
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
    || receipt.evidenceVersionId !== value.reveal.versions.evidence) {
    fail("content or version binding drift");
  }
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\//u
    .test(value.reveal.sourceUrl)) {
    fail("approved immutable source URL is invalid");
  }
};

export function createLanguageCatalogueEntry(value: unknown): LanguageCatalogueEntry {
  const input = validateHandoff(value);
  validateBindings(input);
  const { candidates, correctCandidateId } =
    validateCandidates(input.round.candidates, input.round.correctCandidateId);
  const clues = Object.freeze(input.round.clues.map((clue, index) => {
    if (clue.order !== index + 1 || index > 1) fail("clue order is invalid");
    return Object.freeze({ order: clue.order, label: text(clue.label, "clue label") });
  }));
  const { versions } = input.round;
  return Object.freeze({
    status: "APPROVED_LANGUAGE_CATALOGUE_ENTRY",
    publicRound: Object.freeze({
      roundId: text(input.round.roundId, "roundId"),
      roundVersionId: text(input.round.roundVersionId, "roundVersionId"),
      excerpt: Object.freeze({
        versionId: input.content.versionId, text: input.content.excerpt,
      }),
      mode: Object.freeze({
        kind: "language", contractVersionId: versions.modeContract,
        calibrationVersionId: versions.calibration, prompt: input.round.prompt,
        candidates, clues,
      }),
      versions: Object.freeze({
        candidateSet: versions.candidateSet, clueSet: versions.clueSet,
        scoring: versions.scoring, rules: versions.rules,
      }),
    }),
    serverReveal: Object.freeze({
      correctCandidateId, evidence: input.reveal.evidence,
      attribution: input.reveal.attribution, sourceIdentity: input.reveal.sourceIdentity,
      sourceUrl: input.reveal.sourceUrl,
      helpfulSignals: Object.freeze([...input.reveal.helpfulSignals]),
      misleadingSignals: Object.freeze([...input.reveal.misleadingSignals]),
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
      catalogueHash: input.promotionReceipt.catalogueHash,
    }),
  });
}
