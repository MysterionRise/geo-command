export interface ProvenanceCalibrationInput {
  readonly versionId: string;
  readonly sourceRegimeVersionId: string;
  readonly presentedCandidateCount: number;
  readonly chanceBaseline: number;
  readonly clueSetVersionId: string;
  readonly configuredClueCount: number;
  readonly scoringVersionId: string;
}

export interface ProvenanceCalibration extends ProvenanceCalibrationInput {}

export class ProvenanceCalibrationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProvenanceCalibrationError";
  }
}

type RecordValue = Record<string, unknown>;

const FIELDS = Object.freeze([
  "versionId",
  "sourceRegimeVersionId",
  "presentedCandidateCount",
  "chanceBaseline",
  "clueSetVersionId",
  "configuredClueCount",
  "scoringVersionId",
] as const);

function fail(message: string): never {
  throw new ProvenanceCalibrationError(message);
}

const assertDeepFrozen = (value: unknown, seen = new WeakSet<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail("Calibration input must be recursively frozen at the boundary");
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
};

const record = (value: unknown): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("Calibration input must be an object");
  return value as RecordValue;
};

const nonBlank = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${field} must be non-blank`);
  return value;
};

export const createProvenanceCalibration = (value: unknown): ProvenanceCalibration => {
  assertDeepFrozen(value);
  const input = record(value);
  const keys = Object.keys(input);
  if (keys.length !== FIELDS.length || FIELDS.some((field) => !Object.hasOwn(input, field)) || keys.some((field) => !FIELDS.includes(field as typeof FIELDS[number]))) {
    fail("Calibration field set must be exact");
  }
  const versionId = nonBlank(input.versionId, "versionId");
  const sourceRegimeVersionId = nonBlank(input.sourceRegimeVersionId, "sourceRegimeVersionId");
  const clueSetVersionId = nonBlank(input.clueSetVersionId, "clueSetVersionId");
  const scoringVersionId = nonBlank(input.scoringVersionId, "scoringVersionId");
  if (input.presentedCandidateCount !== 2) fail("presentedCandidateCount must equal the two-candidate provenance regime");
  if (input.configuredClueCount !== 2) fail("configuredClueCount must equal the two configured provenance clues");
  const chanceBaseline = 1 / input.presentedCandidateCount;
  if (input.chanceBaseline !== chanceBaseline) fail("chanceBaseline must equal exactly one divided by presentedCandidateCount");
  return Object.freeze({
    versionId,
    sourceRegimeVersionId,
    presentedCandidateCount: input.presentedCandidateCount,
    chanceBaseline,
    clueSetVersionId,
    configuredClueCount: input.configuredClueCount,
    scoringVersionId,
  });
};
