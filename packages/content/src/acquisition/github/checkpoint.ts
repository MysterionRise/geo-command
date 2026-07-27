import { canonicalSha256 } from "../policy/policy-register";

export interface VerifiedObject {
  readonly gitSha: string;
  readonly sha256: string;
}

export interface CheckpointInput {
  readonly repository: string;
  readonly commit: string;
  readonly parent: string;
  readonly rootTree: string;
  readonly subtree: string;
  readonly subtreeTree: string;
  readonly repositoryPolicyVersion: string;
  readonly repositoryPolicyHash: string;
  readonly attributionPolicyVersion: string;
  readonly attributionPolicyHash: string;
  readonly policyRegisterVersion: string;
  readonly policyRegisterHash: string;
  readonly repositoryPolicyEntryId: string;
  readonly attributionPolicyEntryId: string;
  readonly operatorRegisterVersion: string;
  readonly operatorRegisterHash: string;
  readonly operatorEntryId: string;
  readonly toolVersion: string;
  readonly toolHash: string;
  readonly schemaVersion: string;
  readonly schemaHash: string;
  readonly purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE";
  readonly observationTime: string;
  readonly visitedTreeShas: readonly string[];
  readonly verifiedObjects: readonly VerifiedObject[];
}

export interface AcquisitionCheckpoint extends CheckpointInput {
  readonly objectIdempotencyKeys: readonly string[];
  readonly draftIdempotencyKey: string;
  readonly checkpointHash: string;
}

export class CheckpointError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "CheckpointError";
  }
}

const fail = (code: string): never => {
  throw new CheckpointError(code);
};
const GIT_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const INPUT_FIELDS = [
  "attributionPolicyEntryId", "attributionPolicyHash", "attributionPolicyVersion",
  "commit", "observationTime", "operatorEntryId", "operatorRegisterHash",
  "operatorRegisterVersion", "parent", "policyRegisterHash", "policyRegisterVersion",
  "purpose", "repository", "repositoryPolicyEntryId", "repositoryPolicyHash",
  "repositoryPolicyVersion", "rootTree", "schemaHash", "schemaVersion", "subtree",
  "subtreeTree", "toolHash", "toolVersion", "verifiedObjects", "visitedTreeShas",
] as const;
const BINDING_FIELDS = INPUT_FIELDS.filter(
  (field) => field !== "verifiedObjects" && field !== "visitedTreeShas",
);
const CHECKPOINT_FIELDS = [
  ...INPUT_FIELDS, "checkpointHash", "draftIdempotencyKey", "objectIdempotencyKeys",
].sort();

const exactFields = (value: unknown, fields: readonly string[]): value is Record<string, unknown> =>
  value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).sort().join("\0") === [...fields].sort().join("\0");

const validateInput: (value: unknown) => asserts value is CheckpointInput = (value) => {
  const record = exactFields(value, INPUT_FIELDS)
    ? value
    : fail("CHECKPOINT_FIELDS_REJECTED");
  const gitFields = ["commit", "parent", "rootTree", "subtreeTree"];
  const hashFields = [
    "repositoryPolicyHash", "attributionPolicyHash", "policyRegisterHash",
    "operatorRegisterHash", "toolHash", "schemaHash",
  ];
  if (gitFields.some((field) => !GIT_SHA.test(record[field] as string))) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  if (hashFields.some((field) => !SHA256.test(record[field] as string))) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  const textFields = BINDING_FIELDS.filter(
    (field) => !gitFields.includes(field) && !hashFields.includes(field),
  );
  if (textFields.some((field) => typeof record[field] !== "string" || record[field] === "")) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  if (
    record.purpose !== "LANGUAGE_CANDIDATE"
    && record.purpose !== "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
  ) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  const time = record.observationTime as string;
  if (!UTC.test(time) || new Date(time).toISOString() !== time.replace("Z", ".000Z")) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  if (!Array.isArray(record.visitedTreeShas)
    || record.visitedTreeShas.some((sha) => typeof sha !== "string" || !GIT_SHA.test(sha))) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
  if (!Array.isArray(record.verifiedObjects)
    || record.verifiedObjects.some((item) => !exactFields(item, ["gitSha", "sha256"])
      || !GIT_SHA.test(item.gitSha as string) || !SHA256.test(item.sha256 as string))) {
    fail("CHECKPOINT_IDENTITY_REJECTED");
  }
};

const selectInput = (value: Record<string, unknown>): CheckpointInput =>
  Object.fromEntries(INPUT_FIELDS.map((field) => [field, value[field]])) as unknown as CheckpointInput;

export const objectIdempotencyKey = (
  repository: string,
  commit: string,
  object: VerifiedObject,
): string => canonicalSha256({
  type: "github-object",
  repository,
  commit,
  gitSha: object.gitSha,
});

export const draftIdempotencyKey = (checkpoint: object): string =>
  canonicalSha256({ type: "acquisition-draft", ...selectInput(checkpoint as Record<string, unknown>) });

export const createCheckpoint = (rawInput: CheckpointInput): AcquisitionCheckpoint => {
  validateInput(rawInput);
  const visitedTreeShas = [...rawInput.visitedTreeShas];
  const verifiedObjects = rawInput.verifiedObjects.map((item) => Object.freeze({ ...item }));
  const objectIdempotencyKeys = verifiedObjects.map((item) =>
    objectIdempotencyKey(rawInput.repository, rawInput.commit, item));
  if (new Set(visitedTreeShas).size !== visitedTreeShas.length
    || new Set(objectIdempotencyKeys).size !== objectIdempotencyKeys.length) {
    fail("DUPLICATE_CHECKPOINT_IDENTITY");
  }
  const input = {
    ...rawInput,
    visitedTreeShas: Object.freeze(visitedTreeShas),
    verifiedObjects: Object.freeze(verifiedObjects),
  };
  const draftKey = draftIdempotencyKey(input);
  const payload = {
    ...input,
    objectIdempotencyKeys: Object.freeze(objectIdempotencyKeys),
    draftIdempotencyKey: draftKey,
  };
  return Object.freeze({ ...payload, checkpointHash: canonicalSha256(payload) });
};

export const resumeCheckpoint = (input: {
  readonly checkpoint: AcquisitionCheckpoint;
  readonly expectedBindings: Omit<CheckpointInput, "visitedTreeShas" | "verifiedObjects">;
  readonly storedObjectHashes: Readonly<Record<string, string>>;
}): AcquisitionCheckpoint => {
  if (!exactFields(input.checkpoint, CHECKPOINT_FIELDS)) fail("CHECKPOINT_FIELDS_REJECTED");
  const { checkpointHash, ...payload } = input.checkpoint;
  if (canonicalSha256(payload) !== checkpointHash) fail("CHECKPOINT_HASH_MISMATCH");
  const canonicalCheckpoint = createCheckpoint(
    selectInput(input.checkpoint as unknown as Record<string, unknown>),
  );
  if (canonicalCheckpoint.checkpointHash !== checkpointHash) {
    fail("CHECKPOINT_HASH_MISMATCH");
  }
  if (BINDING_FIELDS.some((field) =>
    canonicalCheckpoint[field] !== input.expectedBindings[field])) {
    fail("CHECKPOINT_BINDING_MISMATCH");
  }
  canonicalCheckpoint.verifiedObjects.forEach((object, index) => {
    const key = canonicalCheckpoint.objectIdempotencyKeys[index];
    if (key === undefined || input.storedObjectHashes[key] !== object.sha256) {
      fail("STORED_OBJECT_MISMATCH");
    }
  });
  return canonicalCheckpoint;
};
