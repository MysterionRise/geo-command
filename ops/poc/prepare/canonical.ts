export class CanonicalValueError extends Error {
  public constructor() {
    super("CANONICAL_VALUE_REJECTED");
    this.name = "CanonicalValueError";
  }
}

const fail = (): never => { throw new CanonicalValueError(); };
const encode = new TextEncoder();

const serialize = (value: unknown, active: Set<object>): string => {
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : fail();
  if (typeof value !== "object") return fail();
  if (active.has(value)) return fail();
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) return fail();
      return `[${value.map((item) => serialize(item, active)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return fail();
    if (Object.getOwnPropertySymbols(value).length > 0) return fail();
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${serialize(record[key], active)}`).join(",")}}`;
  } finally {
    active.delete(value);
  }
};

const FORBIDDEN_ARTIFACT_FIELDS = new Set([
  "executionId", "observedAt", "counters", "diagnostics", "retryState", "waits",
]);

const enforceArtifactBoundary = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_ARTIFACT_FIELDS.has(key)) fail();
    enforceArtifactBoundary(nested, seen);
  }
};

export const canonicalBytes = (value: unknown): Uint8Array => encode.encode(serialize(value, new Set()));

export const canonicalHash = (value: unknown): string =>
  createHash("sha256").update(canonicalBytes(value)).digest("hex");

export const canonicalArtifactBytes = (value: unknown): Uint8Array => {
  enforceArtifactBoundary(value);
  return canonicalBytes(value);
};

export const canonicalArtifactHash = (value: unknown): string =>
  createHash("sha256").update(canonicalArtifactBytes(value)).digest("hex");
import { createHash } from "node:crypto";
