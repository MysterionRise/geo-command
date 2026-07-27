export type LanguageCandidateOrderingKind = "deterministic" | "randomized";

export interface LanguageCandidate {
  readonly id: string;
  readonly canonicalLabel: string;
  readonly aliases: readonly string[];
  readonly distractorRationale: string | null;
}

export interface LanguageCandidateOrderingPolicy {
  readonly versionId: string;
  readonly kind: LanguageCandidateOrderingKind;
}

export interface LanguageClueReference {
  readonly clueId: string;
  readonly clueVersionId: string;
  readonly order: number;
}

export interface LanguageCandidateCalibration {
  readonly versionId: string;
  readonly candidateSetVersionId: string;
  readonly presentedCandidateCount: number;
  readonly chanceBaseline: number;
  readonly cluePolicyVersionId: string;
  readonly configuredClueCount: number;
  readonly scoringVersionId: string;
}

export interface LanguageCandidateSet {
  readonly versionId: string;
  readonly presentedCandidateCount: number;
  readonly correctCandidateId: string;
  readonly candidates: readonly LanguageCandidate[];
  readonly orderingPolicy: LanguageCandidateOrderingPolicy;
  readonly clueSetVersionId: string;
  readonly cluePolicyVersionId: string;
  readonly scoringVersionId: string;
  readonly clues: readonly LanguageClueReference[];
  readonly calibration: LanguageCandidateCalibration;
}

export interface DeterministicLanguageOrderingRecord {
  readonly recordId: string;
  readonly sessionId: string;
  readonly candidateSetVersionId: string;
  readonly policyVersionId: string;
  readonly kind: "deterministic";
  readonly presentedCandidateIds: readonly string[];
}

export interface RandomizedLanguageOrderingRecord {
  readonly recordId: string;
  readonly sessionId: string;
  readonly candidateSetVersionId: string;
  readonly policyVersionId: string;
  readonly kind: "randomized";
  readonly presentedCandidateIds: readonly string[];
  readonly randomizationRecordId: string;
  readonly recordedAt: string;
}

export type LanguageOrderingRecord =
  | DeterministicLanguageOrderingRecord
  | RandomizedLanguageOrderingRecord;

export interface LanguageCandidatePresentation {
  readonly candidateIds: readonly string[];
  readonly presentedCandidateCount: number;
  readonly orderingRecord: LanguageOrderingRecord;
}

export class LanguageCandidateSetRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LanguageCandidateSetRuleError";
  }
}

const SET_KEYS = Object.freeze([
  "versionId", "presentedCandidateCount", "correctCandidateId", "candidates",
  "orderingPolicy", "clueSetVersionId", "cluePolicyVersionId",
  "scoringVersionId", "clues", "calibration",
]);
const CANDIDATE_KEYS = Object.freeze([
  "id", "canonicalLabel", "aliases", "distractorRationale",
]);
const POLICY_KEYS = Object.freeze(["versionId", "kind"]);
const CLUE_KEYS = Object.freeze(["clueId", "clueVersionId", "order"]);
const CALIBRATION_KEYS = Object.freeze([
  "versionId", "candidateSetVersionId", "presentedCandidateCount",
  "chanceBaseline", "cluePolicyVersionId", "configuredClueCount",
  "scoringVersionId",
]);
const DETERMINISTIC_RECORD_KEYS = Object.freeze([
  "recordId", "sessionId", "candidateSetVersionId", "policyVersionId", "kind",
  "presentedCandidateIds",
]);
const RANDOMIZED_RECORD_KEYS = Object.freeze([
  ...DETERMINISTIC_RECORD_KEYS, "randomizationRecordId", "recordedAt",
]);
const certifiedCandidateSets = new WeakSet<LanguageCandidateSet>();

const fail = (message: string): never => {
  throw new LanguageCandidateSetRuleError(message);
};

const objectRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  field: string,
): void => {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key) => !actual.includes(key))) {
    fail(`${field} has an invalid shape`);
  }
};

const frozen = (value: object, field: string): void => {
  if (!Object.isFrozen(value)) fail(`${field} must be frozen`);
};

const frozenArray = (value: unknown, field: string): readonly unknown[] => {
  if (!Array.isArray(value)) return fail(`${field} must be an array`);
  frozen(value, field);
  return value;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be a non-blank string`);
  }
  return value.trim();
};

const integer = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return fail(`${field} must be a non-negative integer`);
  }
  return value;
};

export const normalizeLanguageAlias = (value: string): string => {
  if (typeof value !== "string") return fail("language alias must be a string");
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  if (normalized.length === 0) return fail("language alias must not be blank");
  return normalized;
};

const parseCandidates = (value: unknown): readonly LanguageCandidate[] => {
  const entries = frozenArray(value, "candidates");
  if (entries.length === 0) fail("candidates must not be empty");
  const ids = new Set<string>();
  const names = new Set<string>();
  return Object.freeze(entries.map((entry, index) => {
    const input = objectRecord(entry, `candidates[${index}]`);
    frozen(input, `candidates[${index}]`);
    exactKeys(input, CANDIDATE_KEYS, `candidates[${index}]`);
    const id = text(input.id, `candidates[${index}].id`);
    if (ids.has(id)) fail("candidate ids must be globally unique");
    ids.add(id);
    const canonicalLabel = text(input.canonicalLabel, `candidates[${index}].canonicalLabel`);
    const canonicalName = normalizeLanguageAlias(canonicalLabel);
    if (names.has(canonicalName)) fail("candidate labels and aliases must be globally unique");
    names.add(canonicalName);
    const aliasInputs = frozenArray(input.aliases, `candidates[${index}].aliases`);
    const aliases = Object.freeze(aliasInputs.map((alias, aliasIndex) => {
      const normalized = normalizeLanguageAlias(text(alias, `candidates[${index}].aliases[${aliasIndex}]`));
      if (names.has(normalized)) fail("candidate labels and aliases must be globally unique");
      names.add(normalized);
      return normalized;
    }));
    const rationale = input.distractorRationale === null
      ? null
      : text(input.distractorRationale, `candidates[${index}].distractorRationale`);
    return Object.freeze({ id, canonicalLabel, aliases, distractorRationale: rationale });
  }));
};

const parsePolicy = (value: unknown): LanguageCandidateOrderingPolicy => {
  const input = objectRecord(value, "orderingPolicy");
  frozen(input, "orderingPolicy");
  exactKeys(input, POLICY_KEYS, "orderingPolicy");
  if (input.kind !== "deterministic" && input.kind !== "randomized") {
    return fail("orderingPolicy.kind is unknown");
  }
  return Object.freeze({
    versionId: text(input.versionId, "orderingPolicy.versionId"),
    kind: input.kind,
  });
};

const parseClues = (value: unknown): readonly LanguageClueReference[] => {
  const entries = frozenArray(value, "clues");
  if (entries.length > 2) fail("at most two clues may be configured");
  const ids = new Set<string>();
  const versions = new Set<string>();
  return Object.freeze(entries.map((entry, index) => {
    const input = objectRecord(entry, `clues[${index}]`);
    frozen(input, `clues[${index}]`);
    exactKeys(input, CLUE_KEYS, `clues[${index}]`);
    const clueId = text(input.clueId, `clues[${index}].clueId`);
    const clueVersionId = text(input.clueVersionId, `clues[${index}].clueVersionId`);
    if (ids.has(clueId) || versions.has(clueVersionId)) fail("clue identities must be unique");
    ids.add(clueId);
    versions.add(clueVersionId);
    if (input.order !== index + 1) fail("clues must be ordered consecutively from one");
    return Object.freeze({ clueId, clueVersionId, order: index + 1 });
  }));
};

const parseCalibration = (
  value: unknown,
  binding: Readonly<{
    versionId: string;
    presentedCandidateCount: number;
    cluePolicyVersionId: string;
    configuredClueCount: number;
    scoringVersionId: string;
  }>,
): LanguageCandidateCalibration => {
  const input = objectRecord(value, "calibration");
  frozen(input, "calibration");
  exactKeys(input, CALIBRATION_KEYS, "calibration");
  const calibration = {
    versionId: text(input.versionId, "calibration.versionId"),
    candidateSetVersionId: text(input.candidateSetVersionId, "calibration.candidateSetVersionId"),
    presentedCandidateCount: integer(input.presentedCandidateCount, "calibration.presentedCandidateCount"),
    chanceBaseline: input.chanceBaseline,
    cluePolicyVersionId: text(input.cluePolicyVersionId, "calibration.cluePolicyVersionId"),
    configuredClueCount: integer(input.configuredClueCount, "calibration.configuredClueCount"),
    scoringVersionId: text(input.scoringVersionId, "calibration.scoringVersionId"),
  };
  if (
    calibration.candidateSetVersionId !== binding.versionId ||
    calibration.presentedCandidateCount !== binding.presentedCandidateCount ||
    typeof calibration.chanceBaseline !== "number" ||
    calibration.chanceBaseline !== 1 / binding.presentedCandidateCount ||
    calibration.cluePolicyVersionId !== binding.cluePolicyVersionId ||
    calibration.configuredClueCount !== binding.configuredClueCount ||
    calibration.scoringVersionId !== binding.scoringVersionId
  ) fail("calibration does not exactly match its candidate set");
  return Object.freeze(calibration) as LanguageCandidateCalibration;
};

export const createLanguageCandidateSet = (value: unknown): LanguageCandidateSet => {
  const input = objectRecord(value, "candidateSet");
  frozen(input, "candidateSet");
  exactKeys(input, SET_KEYS, "candidateSet");
  const versionId = text(input.versionId, "versionId");
  const presentedCandidateCount = integer(input.presentedCandidateCount, "presentedCandidateCount");
  const correctCandidateId = text(input.correctCandidateId, "correctCandidateId");
  const candidates = parseCandidates(input.candidates);
  if (presentedCandidateCount === 0 || presentedCandidateCount !== candidates.length) {
    fail("presentedCandidateCount must equal the closed candidate-set size");
  }
  const correct = candidates.filter(({ id }) => id === correctCandidateId);
  if (correct.length !== 1) fail("exactly one candidate must be correct");
  for (const candidate of candidates) {
    if ((candidate.id === correctCandidateId) !== (candidate.distractorRationale === null)) {
      fail("only the correct candidate may have a null distractor rationale");
    }
  }
  const orderingPolicy = parsePolicy(input.orderingPolicy);
  const clueSetVersionId = text(input.clueSetVersionId, "clueSetVersionId");
  const cluePolicyVersionId = text(input.cluePolicyVersionId, "cluePolicyVersionId");
  const scoringVersionId = text(input.scoringVersionId, "scoringVersionId");
  const clues = parseClues(input.clues);
  const calibration = parseCalibration(input.calibration, {
    versionId, presentedCandidateCount, cluePolicyVersionId,
    configuredClueCount: clues.length, scoringVersionId,
  });
  const candidateSet = Object.freeze({
    versionId, presentedCandidateCount, correctCandidateId, candidates,
    orderingPolicy, clueSetVersionId, cluePolicyVersionId, scoringVersionId,
    clues, calibration,
  });
  certifiedCandidateSets.add(candidateSet);
  return candidateSet;
};

export const resolveLanguageCandidateId = (
  candidateSet: LanguageCandidateSet,
  labelOrAlias: string,
): string => {
  if (!certifiedCandidateSets.has(candidateSet)) fail("candidate set was not created by the factory");
  const normalized = normalizeLanguageAlias(labelOrAlias);
  const match = candidateSet.candidates.find((candidate) =>
    normalizeLanguageAlias(candidate.canonicalLabel) === normalized || candidate.aliases.includes(normalized));
  if (!match) return fail("language label or alias is not in the candidate set");
  return match.id;
};

const parseOrderingRecord = (
  value: unknown,
  candidateSet: LanguageCandidateSet,
): LanguageOrderingRecord => {
  const input = objectRecord(value, "orderingRecord");
  frozen(input, "orderingRecord");
  if (input.kind !== "deterministic" && input.kind !== "randomized") {
    return fail("orderingRecord.kind is unknown");
  }
  exactKeys(
    input,
    input.kind === "deterministic" ? DETERMINISTIC_RECORD_KEYS : RANDOMIZED_RECORD_KEYS,
    "orderingRecord",
  );
  if (input.kind !== candidateSet.orderingPolicy.kind) fail("ordering kind does not match policy");
  const recordId = text(input.recordId, "orderingRecord.recordId");
  const sessionId = text(input.sessionId, "orderingRecord.sessionId");
  const candidateSetVersionId = text(input.candidateSetVersionId, "orderingRecord.candidateSetVersionId");
  const policyVersionId = text(input.policyVersionId, "orderingRecord.policyVersionId");
  if (candidateSetVersionId !== candidateSet.versionId || policyVersionId !== candidateSet.orderingPolicy.versionId) {
    fail("ordering record is not bound to the candidate set and policy");
  }
  const idInputs = frozenArray(input.presentedCandidateIds, "orderingRecord.presentedCandidateIds");
  const presentedCandidateIds = Object.freeze(idInputs.map((id, index) =>
    text(id, `orderingRecord.presentedCandidateIds[${index}]`)));
  const expectedIds = candidateSet.candidates.map(({ id }) => id);
  if (
    presentedCandidateIds.length !== expectedIds.length ||
    new Set(presentedCandidateIds).size !== expectedIds.length ||
    presentedCandidateIds.some((id) => !expectedIds.includes(id))
  ) fail("presented candidate ids must be an exact permutation of the candidate set");
  if (input.kind === "deterministic") {
    if (presentedCandidateIds.some((id, index) => id !== expectedIds[index])) {
      fail("deterministic ordering must follow candidate-set order");
    }
    return Object.freeze({
      recordId, sessionId, candidateSetVersionId, policyVersionId,
      kind: "deterministic", presentedCandidateIds,
    });
  }
  const randomizationRecordId = text(input.randomizationRecordId, "orderingRecord.randomizationRecordId");
  const recordedAt = text(input.recordedAt, "orderingRecord.recordedAt");
  if (!Number.isFinite(Date.parse(recordedAt))) fail("orderingRecord.recordedAt must be a valid instant");
  return Object.freeze({
    recordId, sessionId, candidateSetVersionId, policyVersionId,
    kind: "randomized", presentedCandidateIds, randomizationRecordId, recordedAt,
  });
};

export const createLanguageCandidatePresentation = (
  candidateSet: LanguageCandidateSet,
  orderingRecordInput: unknown,
): LanguageCandidatePresentation => {
  if (!certifiedCandidateSets.has(candidateSet)) fail("candidate set was not created by the factory");
  const orderingRecord = parseOrderingRecord(orderingRecordInput, candidateSet);
  return Object.freeze({
    candidateIds: Object.freeze([...orderingRecord.presentedCandidateIds]),
    presentedCandidateCount: candidateSet.presentedCandidateCount,
    orderingRecord,
  });
};
