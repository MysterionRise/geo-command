import "server-only";

export const ROUND_COUNT = 5;
export const PROVENANCE_COUNT = 3;
export const ROUND_SCORES = [0, 500, 800, 1000] as const;
export const CORRECT_ROUND_SCORES = [1000, 800, 500] as const;
export const MAXIMUM_SCORE = 5000;
export const STACK_REVISION = "e565caa3a78c2423bd374333a472b049eb090e47";
export const PROVENANCE_CANDIDATES = [
  "local-experiment.marker-recorded.v1",
  "local-experiment.marker-not-recorded.v1",
] as const;
export const PROVENANCE_CANDIDATE_LABELS = [
  "Configured marker recorded",
  "Configured marker not recorded in this commit",
] as const;
export const PROVENANCE_PROMPT = "Does this commit record contain a configured marker?";
export const PROVENANCE_CLUES = [
  "Inspect the pinned commit record for exact configured marker text.",
  "Treat code style as unrelated to this record-only question.",
] as const;
export const LANGUAGE_CANDIDATES = [
  "local-experiment.language.python.v1",
  "local-experiment.language.typescript.v1",
] as const;

export type JsonRecord = Record<string, unknown>;

export interface ParsedSource extends JsonRecord {
  readonly discoverySource: "GITHUB_COMMIT_SEARCH" | "STACK_V2";
  readonly repository: string;
  readonly authorName: string;
  readonly path: string;
  readonly commit: string;
  readonly blob: string;
  readonly excerptHash: string;
  readonly licenseName: string;
  readonly licenseSpdx: string;
  readonly blobUrl: string;
  readonly profileVersion: string;
  readonly crawlSnapshotId: string;
  readonly markerMatched?: boolean;
  readonly configuration?: "Python" | "TypeScript";
}

export interface ParsedFixture {
  readonly kind: "PROVENANCE" | "LANGUAGE";
  readonly roundId: string;
  readonly roundVersion: string;
  readonly excerpt: string;
  readonly prompt: string;
  readonly candidates: readonly Readonly<{ id: string; label: string }>[];
  readonly clues: readonly string[];
  readonly correctCandidateId: string;
  readonly evidence: string;
  readonly explanation: string;
  readonly attribution: string;
  readonly helpfulSignals: readonly string[];
  readonly misleadingSignals: readonly string[];
  readonly source: Readonly<ParsedSource>;
}

export interface PrivateReveal {
  readonly roundId: string;
  readonly roundVersionId: string;
  readonly correctCandidateId: string;
  readonly evidence: string;
  readonly explanation: string;
  readonly attribution: string;
  readonly helpfulSignals: readonly string[];
  readonly misleadingSignals: readonly string[];
  readonly versions: Readonly<{
    content: string;
    candidateSet: string;
    scoring: string;
    rules: string;
    evidence: string;
    reveal: string;
  }>;
}

export class LocalRealExperimentError extends Error {
  public constructor() {
    super("LOCAL_REAL_EXPERIMENT_REJECTED");
    this.name = "LocalRealExperimentError";
  }
}

export const fail = (): never => { throw new LocalRealExperimentError(); };
