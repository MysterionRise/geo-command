import "server-only";

import type {
  AuthorizedReveal,
  RevealRequest,
} from "../components/arcade/arcade-shell";
import {
  createPublicModeContract,
  type PublicModeContract,
  type PublicRoundInput,
} from "../components/arcade/mode-contract";
import { parseArtifact } from "./local-real-experiment-artifact.server";
import {
  CORRECT_ROUND_SCORES,
  LocalRealExperimentError,
  MAXIMUM_SCORE,
  ROUND_COUNT,
  ROUND_SCORES,
  fail,
  type JsonRecord,
  type ParsedFixture,
  type PrivateReveal,
} from "./local-real-experiment-domain.server";
import {
  canonicalHash,
  deepFreeze,
  record,
  sha256,
} from "./local-real-experiment-validation.server";

export { LocalRealExperimentError };

export interface LocalRealExperiment {
  readonly kind: "LOCAL_UNREVIEWED_EXPERIMENT";
  readonly artifactHash: string;
  readonly mode: PublicModeContract;
  readonly privateReveals: Readonly<Record<string, PrivateReveal>>;
  readonly createReveal: (request: RevealRequest) => AuthorizedReveal;
}

interface DerivedRound {
  readonly publicRound: PublicRoundInput;
  readonly privateReveal: PrivateReveal;
}

interface RoundVersions {
  readonly candidateSet: string;
  readonly clueSet: string;
  readonly scoring: string;
  readonly rules: string;
}

const derivePublicRound = (
  fixture: ParsedFixture,
  artifact: JsonRecord,
  versions: RoundVersions,
): PublicRoundInput => {
  const candidates = fixture.candidates.map(({ id, label }) => ({ candidateId: id, label }));
  const clues = fixture.clues.map((label, index) => ({ order: index + 1 as 1 | 2, label }));
  return {
    roundId: fixture.roundId,
    roundVersionId: fixture.roundVersion,
    excerpt: { versionId: fixture.source.excerptHash, text: fixture.excerpt },
    mode: {
      kind: fixture.kind === "PROVENANCE" ? "provenance" : "language",
      contractVersionId: canonicalHash({ candidates, prompt: fixture.prompt }),
      calibrationVersionId: canonicalHash({
        profileHash: artifact.profileHash,
        profileVersion: fixture.source.profileVersion,
        kind: fixture.kind,
      }),
      prompt: fixture.prompt,
      candidates,
      clues,
    },
    versions,
  };
};

const derivePrivateReveal = (
  fixture: ParsedFixture,
  versions: RoundVersions,
): PrivateReveal => deepFreeze({
  roundId: fixture.roundId,
  roundVersionId: fixture.roundVersion,
  correctCandidateId: fixture.correctCandidateId,
  evidence: fixture.evidence,
  explanation: fixture.explanation,
  attribution: fixture.attribution,
  helpfulSignals: Object.freeze([...fixture.helpfulSignals]),
  misleadingSignals: Object.freeze([...fixture.misleadingSignals]),
  versions: Object.freeze({
    content: fixture.source.excerptHash,
    candidateSet: versions.candidateSet,
    scoring: versions.scoring,
    rules: versions.rules,
    evidence: canonicalHash({ evidence: fixture.evidence }),
    reveal: canonicalHash({
      explanation: fixture.explanation,
      attribution: fixture.attribution,
      correctCandidateId: fixture.correctCandidateId,
    }),
  }),
});

const deriveRound = (
  fixture: ParsedFixture,
  artifact: JsonRecord,
  scoring: string,
): DerivedRound => {
  const candidates = fixture.candidates.map(({ id, label }) => ({ candidateId: id, label }));
  const clues = fixture.clues.map((label, index) => ({ order: index + 1 as 1 | 2, label }));
  const versions = {
    candidateSet: canonicalHash(candidates),
    clueSet: canonicalHash(clues),
    scoring,
    rules: canonicalHash({
      kind: fixture.kind,
      prompt: fixture.prompt,
      semantics: fixture.kind === "PROVENANCE"
        ? "literal-configured-marker-record.v1"
        : "pinned-extension-language.v1",
    }),
  };
  return {
    publicRound: derivePublicRound(fixture, artifact, versions),
    privateReveal: derivePrivateReveal(fixture, versions),
  };
};

const deriveRecords = (
  fixtures: readonly ParsedFixture[],
  artifact: JsonRecord,
): Readonly<{
  mode: PublicModeContract;
  privateReveals: Readonly<Record<string, PrivateReveal>>;
}> => {
  const scoring = canonicalHash({ scheme: "local-experiment-zero-one-two-clues.v1" });
  const records = fixtures.map((fixture) => deriveRound(fixture, artifact, scoring));
  const mode = createPublicModeContract({
    sessionContractVersionId: canonicalHash({
      schemaVersion: artifact.schemaVersion,
      profileHash: artifact.profileHash,
      crawlSnapshotId: (artifact.crawlSnapshot as JsonRecord).id,
    }),
    rounds: records.map(({ publicRound }) => publicRound),
  });
  const privateReveals = deepFreeze(Object.fromEntries(records.map(({ privateReveal }) =>
    [privateReveal.roundId, privateReveal])));
  const publicIds = mode.rounds.map(({ roundId }) => roundId).sort();
  if (publicIds.join("|") !== Object.keys(privateReveals).sort().join("|")) fail();
  return Object.freeze({ mode, privateReveals });
};

const scoreIsReachable = (score: number, completedRounds: number): boolean => {
  let reachable = new Set([0]);
  for (let round = 0; round < completedRounds; round += 1) {
    reachable = new Set([...reachable].flatMap((subtotal) =>
      ROUND_SCORES.map((points) => subtotal + points)));
  }
  return reachable.has(score);
};

const revealFor = (
  mode: PublicModeContract,
  privateReveals: Readonly<Record<string, PrivateReveal>>,
  artifactHash: string,
  value: RevealRequest,
): AuthorizedReveal => {
  const request = record(value, [
    "roundId", "roundVersionId", "candidateId", "completedRounds", "currentScore", "cluesUsed",
  ]);
  if (!Number.isInteger(request.completedRounds) || (request.completedRounds as number) < 0
    || (request.completedRounds as number) >= ROUND_COUNT) fail();
  const completed = request.completedRounds as number;
  const round = mode.rounds[completed] ?? fail();
  if (request.roundId !== round.roundId || request.roundVersionId !== round.roundVersionId
    || !round.mode.candidates.some(({ candidateId }) => candidateId === request.candidateId)
    || !Number.isInteger(request.cluesUsed) || (request.cluesUsed as number) < 0
    || (request.cluesUsed as number) > round.mode.clues.length
    || !Number.isSafeInteger(request.currentScore) || (request.currentScore as number) < 0
    || !scoreIsReachable(request.currentScore as number, completed)) fail();
  const reveal = privateReveals[round.roundId] ?? fail();
  const correct = request.candidateId === reveal.correctCandidateId;
  const roundScore = correct
    ? CORRECT_ROUND_SCORES[request.cluesUsed as number] ?? fail()
    : 0;
  const completedRounds = completed + 1;
  return deepFreeze({
    roundId: round.roundId,
    roundVersionId: round.roundVersionId,
    correct,
    score: roundScore,
    evidence: reveal.evidence,
    explanation: reveal.explanation,
    attribution: reveal.attribution,
    helpfulSignals: reveal.helpfulSignals,
    misleadingSignals: reveal.misleadingSignals,
    versions: reveal.versions,
    result: Object.freeze({
      score: (request.currentScore as number) + roundScore,
      attainableMaximum: MAXIMUM_SCORE,
      completedRounds,
      resultVersionId: `local-experiment:${artifactHash}:round-${completedRounds}`,
    }),
  });
};

export const createLocalRealExperiment = (
  artifactInput: unknown,
  trustedArtifactHash: string,
): LocalRealExperiment => {
  try {
    const expectedArtifactHash = sha256(trustedArtifactHash);
    if (canonicalHash(artifactInput) !== expectedArtifactHash) fail();
    const artifact = record(artifactInput, [
      "schemaVersion", "contentClass", "profileHash", "crawlSnapshot", "fixtures",
    ]);
    const fixtures = parseArtifact(artifact);
    const { mode, privateReveals } = deriveRecords(fixtures, artifact);
    return Object.freeze({
      kind: "LOCAL_UNREVIEWED_EXPERIMENT",
      artifactHash: expectedArtifactHash,
      mode,
      privateReveals,
      createReveal: (request: RevealRequest) =>
        revealFor(mode, privateReveals, expectedArtifactHash, request),
    });
  } catch {
    return fail();
  }
};
