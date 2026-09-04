import {
  CanonicalValueError,
  canonicalArtifactBytes,
  canonicalArtifactHash,
  canonicalBytes,
  canonicalHash,
} from "./canonical";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;

describe("canonical identities", () => {
  it("serializes object keys in one stable recursive order", () => {
    const left = { z: 1, nested: { b: true, a: ["x", null] } };
    const right = { nested: { a: ["x", null], b: true }, z: 1 };

    expect(canonicalBytes(left)).toEqual(canonicalBytes(right));
    expect(new TextDecoder().decode(canonicalBytes(left)))
      .toBe('{"nested":{"a":["x",null],"b":true},"z":1}');
  });

  it("uses the same SHA-256 rule for canonical values and artifacts", () => {
    const value = { fixtures: ["one", "two"], snapshot: "pinned" };

    expect(canonicalHash(value)).toMatch(/^[0-9a-f]{64}$/u);
    expect(canonicalArtifactHash(value)).toBe(canonicalHash(value));
  });

  it("changes identity for semantic changes while ignoring key insertion order", () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
    expect(canonicalHash({ a: 1, b: 2 })).not.toBe(canonicalHash({ a: 1, b: 3 }));
    expect(canonicalHash(["a", "b"])).not.toBe(canonicalHash(["b", "a"]));
  });

  it("rejects unsupported, lossy, sparse, and cyclic values", () => {
    const sparse = ["a", "b"];
    delete sparse[1];
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY, 1n, sparse, cyclic]) {
      expect(() => canonicalBytes(value)).toThrow(CanonicalValueError);
    }
  });

  it("excludes execution-specific fields from artifact serialization", () => {
    const deterministic = { fixtures: ["one"], snapshot: "pinned" };
    const forbidden = [
      "executionId", "observedAt", "counters", "diagnostics", "retryState", "waits",
    ];

    expect(canonicalArtifactBytes(deterministic)).toEqual(canonicalBytes(deterministic));
    for (const key of forbidden) {
      expect(() => canonicalArtifactBytes({ ...deterministic, [key]: "run-specific" }))
        .toThrow(CanonicalValueError);
    }
  });
});
