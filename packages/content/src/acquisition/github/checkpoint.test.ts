import { canonicalSha256 } from "../policy/policy-register";
import {
  CheckpointError,
  createCheckpoint,
  draftIdempotencyKey,
  objectIdempotencyKey,
  resumeCheckpoint,
} from "./checkpoint";

const testModuleName: string = "vitest";
interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}
interface TestApi {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): Expectation;
  it(name: string, callback: () => unknown): void;
}
const { describe, expect, it } = (await import(testModuleName)) as TestApi;

const bindings = {
  repository: "owner/repo",
  commit: "a".repeat(40),
  parent: "b".repeat(40),
  rootTree: "c".repeat(40),
  subtree: "src",
  subtreeTree: "d".repeat(40),
  repositoryPolicyVersion: "repository-v1",
  repositoryPolicyHash: "1".repeat(64),
  attributionPolicyVersion: "attribution-v1",
  attributionPolicyHash: "2".repeat(64),
  policyRegisterVersion: "policies-v1",
  policyRegisterHash: "3".repeat(64),
  repositoryPolicyEntryId: "repository-entry-v1",
  attributionPolicyEntryId: "attribution-entry-v1",
  operatorRegisterVersion: "operators-v1",
  operatorRegisterHash: "4".repeat(64),
  operatorEntryId: "operator-entry-v1",
  toolVersion: "1.0.0",
  toolHash: "5".repeat(64),
  schemaVersion: "checkpoint-v1",
  schemaHash: "6".repeat(64),
  purpose: "LANGUAGE_CANDIDATE",
  observationTime: "2026-07-27T15:00:00Z",
} as const;
const object = { gitSha: "e".repeat(40), sha256: "7".repeat(64) } as const;
const input = {
  ...bindings,
  visitedTreeShas: ["d".repeat(40)],
  verifiedObjects: [object],
} as const;

describe("hash-verified acquisition checkpoint", () => {
  it("creates byte-deterministic immutable progress with its canonical hash", () => {
    const first = createCheckpoint(input);
    expect(first).toEqual(createCheckpoint(input));
    const { checkpointHash: _hash, ...payload } = first;
    expect(first.checkpointHash).toBe(canonicalSha256(payload));
  });

  it("rejects sensitive, unknown, or mutable checkpoint input fields", () => {
    expect(() => createCheckpoint({ ...input, token: "secret-canary" } as never))
      .toThrow("CHECKPOINT_FIELDS_REJECTED");
    expect(() => createCheckpoint({ ...input, commit: "main" } as never))
      .toThrow("CHECKPOINT_IDENTITY_REJECTED");
    expect(() => createCheckpoint({ ...input, purpose: "GENERAL_CRAWL" } as never))
      .toThrow("CHECKPOINT_IDENTITY_REJECTED");
  });

  it("resumes only exact source, policy, operator, tool, and schema bindings", () => {
    const checkpoint = createCheckpoint(input);
    expect(resumeCheckpoint({
      checkpoint,
      expectedBindings: bindings,
      storedObjectHashes: {
        [objectIdempotencyKey(bindings.repository, bindings.commit, object)]: object.sha256,
      },
    })).toEqual(checkpoint);
    for (const [field, value] of [
      ["commit", "f".repeat(40)],
      ["repositoryPolicyHash", "8".repeat(64)],
      ["operatorRegisterHash", "8".repeat(64)],
      ["toolHash", "8".repeat(64)],
      ["schemaHash", "8".repeat(64)],
    ] as const) {
      expect(() => resumeCheckpoint({
        checkpoint,
        expectedBindings: { ...bindings, [field]: value },
        storedObjectHashes: {},
      })).toThrow("CHECKPOINT_BINDING_MISMATCH");
    }
  });

  it("rejects checkpoint tampering", () => {
    const checkpoint = createCheckpoint(input);
    expect(() => resumeCheckpoint({
      checkpoint: { ...checkpoint, parent: "f".repeat(40) },
      expectedBindings: bindings,
      storedObjectHashes: {},
    })).toThrow("CHECKPOINT_HASH_MISMATCH");
  });

  it("rejects missing or changed already-stored object hashes", () => {
    const checkpoint = createCheckpoint(input);
    expect(() => resumeCheckpoint({
      checkpoint,
      expectedBindings: bindings,
      storedObjectHashes: {},
    })).toThrow("STORED_OBJECT_MISMATCH");
    expect(() => resumeCheckpoint({
      checkpoint,
      expectedBindings: bindings,
      storedObjectHashes: {
        [objectIdempotencyKey(bindings.repository, bindings.commit, object)]: "8".repeat(64),
      },
    })).toThrow("STORED_OBJECT_MISMATCH");
  });

  it("produces stable source-object and draft idempotency keys", () => {
    const checkpoint = createCheckpoint(input);
    expect(checkpoint.objectIdempotencyKeys[0])
      .toBe(objectIdempotencyKey(bindings.repository, bindings.commit, object));
    expect(checkpoint.draftIdempotencyKey).toBe(draftIdempotencyKey(checkpoint));
  });

  it("rejects duplicate tree progress and verified object identities", () => {
    expect(() => createCheckpoint({
      ...input,
      visitedTreeShas: [input.visitedTreeShas[0], input.visitedTreeShas[0]],
    })).toThrow("DUPLICATE_CHECKPOINT_IDENTITY");
    expect(() => createCheckpoint({
      ...input,
      verifiedObjects: [object, { ...object, sha256: "8".repeat(64) }],
    })).toThrow("DUPLICATE_CHECKPOINT_IDENTITY");
    expect(objectIdempotencyKey(bindings.repository, bindings.commit, object))
      .toBe(objectIdempotencyKey(bindings.repository, bindings.commit, {
        ...object,
        sha256: "8".repeat(64),
      }));
  });

  it("deep-freezes the checkpoint, arrays, and verified object items", () => {
    const checkpoint = createCheckpoint(input);
    expect(Object.isFrozen(checkpoint)).toBe(true);
    expect(Object.isFrozen(checkpoint.visitedTreeShas)).toBe(true);
    expect(Object.isFrozen(checkpoint.verifiedObjects)).toBe(true);
    expect(Object.isFrozen(checkpoint.verifiedObjects[0])).toBe(true);
    expect(() => {
      (checkpoint.verifiedObjects as unknown as Array<typeof object>).push(object);
    }).toThrow();
  });

  it("rejects malformed runtime progress shapes", () => {
    expect(() => createCheckpoint({
      ...input,
      verifiedObjects: [null],
    } as never)).toThrow("CHECKPOINT_IDENTITY_REJECTED");
    expect(() => createCheckpoint({
      ...input,
      visitedTreeShas: "not-an-array",
    } as never)).toThrow("CHECKPOINT_IDENTITY_REJECTED");
  });

  it("revalidates JSON-loaded checkpoints and returns a new deep-frozen value", () => {
    const original = createCheckpoint(input);
    const loaded = JSON.parse(JSON.stringify(original)) as typeof original;
    const resumed = resumeCheckpoint({
      checkpoint: loaded,
      expectedBindings: bindings,
      storedObjectHashes: {
        [objectIdempotencyKey(bindings.repository, bindings.commit, object)]: object.sha256,
      },
    });
    expect(resumed === loaded).toBe(false);
    expect(Object.isFrozen(resumed)).toBe(true);
    expect(Object.isFrozen(resumed.verifiedObjects)).toBe(true);
    expect(Object.isFrozen(resumed.verifiedObjects[0])).toBe(true);
  });

  it("rejects a recomputed malformed checkpoint without leaking TypeError", () => {
    const { checkpointHash: _oldHash, ...payload } = createCheckpoint(input);
    const malformed = { ...payload, verifiedObjects: [null] };
    const checkpoint = { ...malformed, checkpointHash: canonicalSha256(malformed) };
    expect(() => resumeCheckpoint({
      checkpoint: checkpoint as never,
      expectedBindings: bindings,
      storedObjectHashes: {},
    })).toThrow(CheckpointError);
  });

  it("uses a specific checkpoint error", () => {
    expect(() => createCheckpoint({ ...input, commit: "main" } as never))
      .toThrow(CheckpointError);
  });
});
