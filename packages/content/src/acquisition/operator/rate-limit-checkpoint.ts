import { createHash } from "node:crypto";

import type { AcquisitionRequest } from "../github/request";
import type { AuthorizedOperatorRun } from "../policy/operator-authorization";
import {
  canonicalSha256,
  type AuthorizedPolicy,
} from "../policy/policy-register";
import type { SnapshotIdentity } from "../storage/encrypted-store";
import {
  ACQUISITION_TOOL_HASH,
  ACQUISITION_TOOL_VERSION,
} from "./tool-binding";

const H64 = /^[0-9a-f]{64}$/u;
const FIELDS = [
  "attributionPolicyEntryId", "attributionPolicyHash", "attributionPolicyVersion",
  "checkpointHash", "logicalRunId",
  "operatorBindingHash", "operatorRegisterHash", "operatorRegisterVersion",
  "policyRegisterHash", "policyRegisterVersion", "repositoryPolicyHash",
  "repositoryPolicyEntryId", "repositoryPolicyVersion", "requestHash",
  "resumeAfterEpochMs", "schemaVersion", "storedObjects", "toolHash", "toolVersion",
] as const;
const IDENTITY_FIELDS = ["byteLength", "objectId", "plaintextSha256"] as const;
const STORED_OBJECT_FIELDS = ["createdByRun", "gitSha", "kind", "snapshot"] as const;

export interface RateLimitBindings {
  readonly requestHash: string;
  readonly repositoryPolicyVersion: string;
  readonly repositoryPolicyHash: string;
  readonly repositoryPolicyEntryId: string;
  readonly attributionPolicyVersion: string;
  readonly attributionPolicyHash: string;
  readonly attributionPolicyEntryId: string;
  readonly policyRegisterVersion: string;
  readonly policyRegisterHash: string;
  readonly operatorRegisterVersion: string;
  readonly operatorRegisterHash: string;
  readonly operatorBindingHash: string;
  readonly toolVersion: string;
  readonly toolHash: string;
  readonly logicalRunId: string;
}
export interface RateLimitCheckpoint extends RateLimitBindings {
  readonly schemaVersion: "github-rate-limit-pause-v1";
  readonly resumeAfterEpochMs: number;
  readonly storedObjects: readonly StoredGitObject[];
  readonly checkpointHash: string;
}
export interface StoredGitObject {
  readonly kind: "tree" | "blob";
  readonly gitSha: string;
  readonly createdByRun: boolean;
  readonly snapshot: SnapshotIdentity;
}
export class RateLimitCheckpointError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "RateLimitCheckpointError";
  }
}
const fail = (code: string): never => {
  throw new RateLimitCheckpointError(code);
};
const exact = (value: unknown, fields: readonly string[]): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...fields].sort().join("|");
const operatorBindingHash = (run: AuthorizedOperatorRun): string => canonicalSha256({
  operatorName: run.operatorName,
  osIdentity: run.osIdentity,
  repository: run.repository,
  commit: run.commit,
  subtree: run.subtree,
  purpose: run.purpose,
  tokenAllowance: run.tokenAllowance,
  callerObservationTime: run.callerObservationTime,
  registerVersion: run.registerVersion,
  registerHash: run.registerHash,
  entryId: run.entryId,
  authorizationValidFrom: run.authorizationValidFrom,
  authorizationValidThrough: run.authorizationValidThrough,
});

export const rateLimitBindings = (input: {
  readonly request: AcquisitionRequest;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly operatorRun: AuthorizedOperatorRun;
}): RateLimitBindings => {
  const stable = {
    requestHash: canonicalSha256(input.request),
    repositoryPolicyVersion: input.repositoryPolicy.policyVersion,
    repositoryPolicyHash: input.repositoryPolicy.policyHash,
    repositoryPolicyEntryId: input.repositoryPolicy.entryId,
    attributionPolicyVersion: input.attributionPolicy.policyVersion,
    attributionPolicyHash: input.attributionPolicy.policyHash,
    attributionPolicyEntryId: input.attributionPolicy.entryId,
    policyRegisterVersion: input.repositoryPolicy.registerVersion,
    policyRegisterHash: input.repositoryPolicy.registerHash,
    operatorRegisterVersion: input.operatorRun.registerVersion,
    operatorRegisterHash: input.operatorRun.registerHash,
    operatorBindingHash: operatorBindingHash(input.operatorRun),
    toolVersion: ACQUISITION_TOOL_VERSION,
    toolHash: ACQUISITION_TOOL_HASH,
  };
  return Object.freeze({
    ...stable,
    logicalRunId: canonicalSha256({
      schema: "logical-acquisition-run-v1",
      ...stable,
    }),
  });
};

const validIdentity = (value: unknown): value is SnapshotIdentity =>
  exact(value, IDENTITY_FIELDS)
  && H64.test(value.objectId as string)
  && value.objectId === value.plaintextSha256
  && Number.isSafeInteger(value.byteLength)
  && (value.byteLength as number) >= 0;
const validStoredObject = (value: unknown): value is StoredGitObject =>
  exact(value, STORED_OBJECT_FIELDS)
  && (value.kind === "tree" || value.kind === "blob")
  && typeof value.gitSha === "string"
  && /^[0-9a-f]{40}$/u.test(value.gitSha)
  && typeof value.createdByRun === "boolean"
  && validIdentity(value.snapshot);
const validateCheckpoint = (raw: unknown): RateLimitCheckpoint => {
  if (!exact(raw, FIELDS)
    || raw.schemaVersion !== "github-rate-limit-pause-v1"
    || !Number.isSafeInteger(raw.resumeAfterEpochMs)
    || (raw.resumeAfterEpochMs as number) < 0
    || !Array.isArray(raw.storedObjects)
    || !raw.storedObjects.every(validStoredObject)) {
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
  const hashes = [
    "attributionPolicyHash", "checkpointHash", "logicalRunId", "operatorBindingHash",
    "operatorRegisterHash", "policyRegisterHash", "repositoryPolicyHash",
    "requestHash", "toolHash",
  ];
  if (hashes.some((field) => !H64.test(raw[field] as string))) {
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
  const { checkpointHash, ...payload } = raw;
  if (canonicalSha256(payload) !== checkpointHash
    || new Set(raw.storedObjects.map(({ kind, gitSha }) => `${kind}:${gitSha}`)).size
      !== raw.storedObjects.length) {
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
  return raw as unknown as RateLimitCheckpoint;
};

export const createRateLimitCheckpoint = (input: {
  readonly bindings: RateLimitBindings;
  readonly resumeAfterEpochMs: number;
  readonly pauseAtEpochMs: number;
  readonly storedObjects?: readonly StoredGitObject[];
}): RateLimitCheckpoint => {
  if (!Number.isSafeInteger(input.resumeAfterEpochMs)
    || input.resumeAfterEpochMs <= input.pauseAtEpochMs) {
    return fail("RATE_LIMIT_CHECKPOINT_REJECTED");
  }
  const payload = {
    schemaVersion: "github-rate-limit-pause-v1" as const,
    ...input.bindings,
    resumeAfterEpochMs: input.resumeAfterEpochMs,
    storedObjects: (input.storedObjects ?? []).map((object) => Object.freeze({
      kind: object.kind,
      gitSha: object.gitSha,
      createdByRun: object.createdByRun,
      snapshot: Object.freeze({ ...object.snapshot }),
    })),
  };
  return Object.freeze({
    ...payload,
    storedObjects: Object.freeze(payload.storedObjects),
    checkpointHash: canonicalSha256(payload),
  });
};
export const serializeRateLimitCheckpoint = (
  checkpoint: RateLimitCheckpoint,
): Uint8Array => new TextEncoder().encode(JSON.stringify(checkpoint));
export const rateLimitCheckpointIdentity = (
  plaintext: Uint8Array,
): SnapshotIdentity => {
  const digest = createHash("sha256").update(plaintext).digest("hex");
  return Object.freeze({
    objectId: digest,
    plaintextSha256: digest,
    byteLength: plaintext.byteLength,
  });
};
export const authorizeRateLimitResume = (input: {
  readonly plaintext: Uint8Array;
  readonly expectedBindings: RateLimitBindings;
  readonly nowEpochMs: number;
}): RateLimitCheckpoint => {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(input.plaintext));
  } catch {
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
  const checkpoint = validateCheckpoint(raw);
  const bindingKeys = Object.keys(input.expectedBindings) as (keyof RateLimitBindings)[];
  if (bindingKeys.some((key) => checkpoint[key] !== input.expectedBindings[key])) {
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
  if (!Number.isSafeInteger(input.nowEpochMs)) return fail("RESUME_CHECKPOINT_REJECTED");
  if (input.nowEpochMs < checkpoint.resumeAfterEpochMs) return fail("RESUME_NOT_READY");
  return Object.freeze({
    ...checkpoint,
    storedObjects: Object.freeze(checkpoint.storedObjects.map(
      (object) => Object.freeze({
        ...object,
        snapshot: Object.freeze({ ...object.snapshot }),
      }),
    )),
  });
};
