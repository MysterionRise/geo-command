import {
  createPublicModeContract,
  type PublicModeContractInput,
} from "../components/arcade/mode-contract";
import type {
  AuthorizedReveal,
  RevealRequest,
} from "../components/arcade/arcade-shell";

interface DemoRound {
  readonly correctCandidateId: string;
  readonly evidence: string;
  readonly explanation: string;
  readonly helpfulSignals: readonly string[];
  readonly misleadingSignals: readonly string[];
}

const PROVENANCE_CANDIDATES = [
  { candidateId: "recorded-model-output", label: "Recorded model output" },
  { candidateId: "project-owned-human", label: "Project-owned human sample" },
];

const modeInput: PublicModeContractInput = {
  sessionContractVersionId: "synthetic-demo-session-v1",
  rounds: [
    {
      roundId: "demo-round-1",
      roundVersionId: "demo-round-version-1",
      excerpt: { versionId: "demo-content-v1-round-1", text: "const unique = <T,>(items: T[]) => [...new Set(items)];" },
      mode: {
        kind: "provenance",
        contractVersionId: "demo-provenance-contract-v1",
        calibrationVersionId: "synthetic-demo-calibration-v1",
        prompt: "Which recorded source class produced this sample?",
        candidates: PROVENANCE_CANDIDATES.map((candidate) => ({ ...candidate })),
        clues: [
          { order: 1, label: "The evidence record was created during this demo build." },
          { order: 2, label: "No third-party publication is involved." },
        ],
      },
      versions: { candidateSet: "demo-provenance-candidates-v1", clueSet: "demo-clues-v1-round-1", scoring: "scoring-v1", rules: "rules-v1" },
    },
    {
      roundId: "demo-round-2",
      roundVersionId: "demo-round-version-2",
      excerpt: { versionId: "demo-content-v1-round-2", text: "def chunks(values, size):\n    return [values[i:i + size] for i in range(0, len(values), size)]" },
      mode: {
        kind: "provenance",
        contractVersionId: "demo-provenance-contract-v1",
        calibrationVersionId: "synthetic-demo-calibration-v1",
        prompt: "Which recorded source class produced this sample?",
        candidates: PROVENANCE_CANDIDATES.map((candidate) => ({ ...candidate })),
        clues: [
          { order: 1, label: "The source decision comes from a fixture record, not style detection." },
          { order: 2, label: "The sample has no external author attribution." },
        ],
      },
      versions: { candidateSet: "demo-provenance-candidates-v1", clueSet: "demo-clues-v1-round-2", scoring: "scoring-v1", rules: "rules-v1" },
    },
    {
      roundId: "demo-round-3",
      roundVersionId: "demo-round-version-3",
      excerpt: { versionId: "demo-content-v1-round-3", text: "fn clamp(value: i32, low: i32, high: i32) -> i32 {\n    value.max(low).min(high)\n}" },
      mode: {
        kind: "provenance",
        contractVersionId: "demo-provenance-contract-v1",
        calibrationVersionId: "synthetic-demo-calibration-v1",
        prompt: "Which recorded source class produced this sample?",
        candidates: PROVENANCE_CANDIDATES.map((candidate) => ({ ...candidate })),
        clues: [
          { order: 1, label: "This is project-controlled synthetic demo content." },
          { order: 2, label: "Its provenance was recorded when the fixture was generated." },
        ],
      },
      versions: { candidateSet: "demo-provenance-candidates-v1", clueSet: "demo-clues-v1-round-3", scoring: "scoring-v1", rules: "rules-v1" },
    },
    {
      roundId: "demo-round-4",
      roundVersionId: "demo-round-version-4",
      excerpt: { versionId: "demo-content-v1-round-4", text: "type User = { id: string; active: boolean };\nconst active = users.filter((user: User) => user.active);" },
      mode: {
        kind: "language",
        contractVersionId: "demo-language-contract-v1",
        calibrationVersionId: "synthetic-demo-calibration-v1",
        prompt: "Which language is this?",
        candidates: [
          { candidateId: "typescript", label: "TypeScript" },
          { candidateId: "javascript", label: "JavaScript" },
          { candidateId: "kotlin", label: "Kotlin" },
          { candidateId: "swift", label: "Swift" },
        ],
        clues: [
          { order: 1, label: "Look at the object type declaration." },
          { order: 2, label: "This language adds static types to JavaScript syntax." },
        ],
      },
      versions: { candidateSet: "demo-language-candidates-v1-round-4", clueSet: "demo-clues-v1-round-4", scoring: "scoring-v1", rules: "rules-v1" },
    },
    {
      roundId: "demo-round-5",
      roundVersionId: "demo-round-version-5",
      excerpt: { versionId: "demo-content-v1-round-5", text: "def first_even(values):\n    return next((value for value in values if value % 2 == 0), None)" },
      mode: {
        kind: "language",
        contractVersionId: "demo-language-contract-v1",
        calibrationVersionId: "synthetic-demo-calibration-v1",
        prompt: "Which language is this?",
        candidates: [
          { candidateId: "python", label: "Python" },
          { candidateId: "ruby", label: "Ruby" },
          { candidateId: "javascript", label: "JavaScript" },
          { candidateId: "elixir", label: "Elixir" },
        ],
        clues: [
          { order: 1, label: "The generator expression is passed to next()." },
          { order: 2, label: "None is the language's null-like singleton." },
        ],
      },
      versions: { candidateSet: "demo-language-candidates-v1-round-5", clueSet: "demo-clues-v1-round-5", scoring: "scoring-v1", rules: "rules-v1" },
    },
  ],
};

const demoAnswers: readonly (readonly [string, string])[] = [
  ["recorded-model-output", "This sample is recorded as model output in the synthetic demo fixture."],
  ["recorded-model-output", "This sample is recorded as model output in the synthetic demo fixture."],
  ["recorded-model-output", "This sample is recorded as model output in the synthetic demo fixture."],
  ["typescript", "The synthetic demo fixture records this excerpt as TypeScript."],
  ["python", "The synthetic demo fixture records this excerpt as Python."],
];

const demoRounds: readonly DemoRound[] = Object.freeze(demoAnswers.map(([correctCandidateId, evidence], index) => Object.freeze({
  correctCandidateId,
  evidence,
  explanation: index < 3
    ? "The answer follows the recorded fixture provenance; code style alone is not provenance evidence."
    : "The recorded syntax and candidate set identify the language for this demo round.",
  helpfulSignals: Object.freeze([index < 3 ? "Recorded fixture provenance" : "Language-specific syntax"]),
  misleadingSignals: Object.freeze([index < 3 ? "Style-based authorship guesses" : "Surface similarity to a distractor"]),
})));

export const DEMO_MODE = createPublicModeContract(modeInput);
const ROUND_SCORES = [0, 500, 800, 1000] as const;

function fail(message: string): never {
  throw new TypeError(`demo reveal ${message}`);
}

function scoreIsReachable(score: number, completedRounds: number): boolean {
  let reachable = new Set([0]);
  for (let round = 0; round < completedRounds; round += 1) {
    reachable = new Set([...reachable].flatMap((subtotal) => ROUND_SCORES.map((points) => subtotal + points)));
  }
  return reachable.has(score);
}

export function createDemoReveal(value: RevealRequest): AuthorizedReveal {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("must be an object");
  const source = value as unknown as Record<string, unknown>;
  const fields = ["candidateId", "cluesUsed", "completedRounds", "currentScore", "roundId", "roundVersionId"];
  if (Object.keys(source).sort().join("|") !== fields.sort().join("|")) fail("has an invalid shape");
  if (!Number.isInteger(value.completedRounds) || value.completedRounds < 0 || value.completedRounds > 4) fail("order is invalid");
  const round = DEMO_MODE.rounds[value.completedRounds] ?? fail("order is invalid");
  const demo = demoRounds[value.completedRounds] ?? fail("order is invalid");
  if (value.roundId !== round.roundId) fail("round order is invalid");
  if (value.roundVersionId !== round.roundVersionId) fail("round version is invalid");
  if (!round.mode.candidates.some(({ candidateId }) => candidateId === value.candidateId)) fail("candidate is invalid");
  if (!Number.isInteger(value.cluesUsed) || value.cluesUsed < 0 || value.cluesUsed > round.mode.clues.length) fail("clue count is invalid");
  if (!Number.isSafeInteger(value.currentScore) || !scoreIsReachable(value.currentScore, value.completedRounds)) fail("score is invalid");
  const correct = value.candidateId === demo.correctCandidateId;
  const roundScore = correct ? [1000, 800, 500][value.cluesUsed]! : 0;
  const completedRounds = value.completedRounds + 1;
  return Object.freeze({
    roundId: round.roundId,
    roundVersionId: round.roundVersionId,
    correct,
    score: roundScore,
    evidence: demo.evidence,
    explanation: demo.explanation,
    attribution: "Synthetic CodeGuessr demo fixture; no third-party source.",
    helpfulSignals: demo.helpfulSignals,
    misleadingSignals: demo.misleadingSignals,
    versions: Object.freeze({
      content: round.excerpt.versionId,
      candidateSet: round.versions.candidateSet,
      scoring: round.versions.scoring,
      rules: round.versions.rules,
      evidence: `demo-evidence-v1-round-${completedRounds}`,
      reveal: `demo-reveal-v1-round-${completedRounds}`,
    }),
    result: Object.freeze({
      score: value.currentScore + roundScore,
      attainableMaximum: 5000,
      completedRounds,
      resultVersionId: `demo-result-v1-round-${completedRounds}`,
    }),
  });
}
