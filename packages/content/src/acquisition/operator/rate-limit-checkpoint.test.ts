import {
  authorizeRateLimitResume,
  createRateLimitCheckpoint,
  rateLimitCheckpointIdentity,
  RateLimitCheckpointError,
  serializeRateLimitCheckpoint,
  type RateLimitBindings,
} from "./rate-limit-checkpoint";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const bindings: RateLimitBindings = {
  requestHash: "1".repeat(64),
  repositoryPolicyVersion: "repository-v1",
  repositoryPolicyHash: "2".repeat(64),
  repositoryPolicyEntryId: "repository-entry",
  attributionPolicyVersion: "attribution-v1",
  attributionPolicyHash: "3".repeat(64),
  attributionPolicyEntryId: "attribution-entry",
  policyRegisterVersion: "policies-v1",
  policyRegisterHash: "4".repeat(64),
  operatorRegisterVersion: "operators-v1",
  operatorRegisterHash: "5".repeat(64),
  operatorBindingHash: "6".repeat(64),
  toolVersion: "1.0.0",
  toolHash: "7".repeat(64),
  logicalRunId: "8".repeat(64),
};
const checkpoint = () => createRateLimitCheckpoint({
  bindings,
  pauseAtEpochMs: 1_000,
  resumeAfterEpochMs: 2_000,
});
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("rate-limit checkpoint", () => {
  it("round-trips an eligible deeply immutable metadata checkpoint", () => {
    const created = checkpoint();
    const plaintext = serializeRateLimitCheckpoint(created);
    const identity = rateLimitCheckpointIdentity(plaintext);
    const resumed = authorizeRateLimitResume({
      plaintext,
      expectedBindings: bindings,
      nowEpochMs: 2_000,
    });
    expect(identity.objectId).toMatch(/^[0-9a-f]{64}$/u);
    expect(resumed).toEqual(created);
    expect(Object.isFrozen(resumed)).toBe(true);
    expect(Object.isFrozen(resumed.storedObjects)).toBe(true);
  });

  it("rejects an invalid pause instant and an early or mismatched resume", () => {
    expect(() => createRateLimitCheckpoint({
      bindings,
      pauseAtEpochMs: 2_000,
      resumeAfterEpochMs: 2_000,
    })).toThrow("RATE_LIMIT_CHECKPOINT_REJECTED");
    const plaintext = serializeRateLimitCheckpoint(checkpoint());
    expect(() => authorizeRateLimitResume({
      plaintext,
      expectedBindings: bindings,
      nowEpochMs: 1_999,
    })).toThrow("RESUME_NOT_READY");
    expect(() => authorizeRateLimitResume({
      plaintext,
      expectedBindings: { ...bindings, toolHash: "8".repeat(64) },
      nowEpochMs: 2_000,
    })).toThrow("RESUME_CHECKPOINT_REJECTED");
    expect(() => authorizeRateLimitResume({
      plaintext,
      expectedBindings: {
        ...bindings,
        repositoryPolicyEntryId: "different-repository-entry",
      },
      nowEpochMs: 2_000,
    })).toThrow("RESUME_CHECKPOINT_REJECTED");
    expect(() => authorizeRateLimitResume({
      plaintext,
      expectedBindings: {
        ...bindings,
        attributionPolicyEntryId: "different-attribution-entry",
      },
      nowEpochMs: 2_000,
    })).toThrow("RESUME_CHECKPOINT_REJECTED");
  });

  it("rejects malformed JSON, schema/hash tampering, and duplicate object identities", () => {
    const valid = checkpoint();
    const duplicate = {
      kind: "blob",
      gitSha: "a".repeat(40),
      createdByRun: true,
      snapshot: {
        objectId: "9".repeat(64),
        plaintextSha256: "9".repeat(64),
        byteLength: 1,
      },
    };
    const candidates = [
      new Uint8Array([0xff]),
      encode({ ...valid, schemaVersion: "unknown" }),
      encode({ ...valid, requestHash: "0".repeat(64) }),
      encode({ ...valid, storedObjects: [duplicate, duplicate] }),
    ];
    for (const plaintext of candidates) {
      expect(() => authorizeRateLimitResume({
        plaintext,
        expectedBindings: bindings,
        nowEpochMs: 2_000,
      })).toThrow(RateLimitCheckpointError);
    }
  });
});
