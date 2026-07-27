import { createHash } from "node:crypto";

import {
  PolicyAuthorizationError,
  authorizePolicy,
  canonicalSha256,
} from "./policy-register";

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}

interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => Expectation;
  readonly it: (name: string, callback: () => unknown) => void;
}

const testModuleName: string = "vitest";
const { describe, expect, it } = (await import(testModuleName)) as TestApi;

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
    .join(",")}}`;
};

const hash = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value)).digest("hex");

const policy = {
  policyClass: "REPOSITORY_ADMISSION",
  policyVersion: "repository-admission-v1",
  repositories: [],
} as const;

const createInput = () => {
  const policyHash = hash(policy);
  const register = {
    registerVersion: "approved-policies-v1",
    entries: [{
      entryId: "repository-admission-v1",
      policyClass: "REPOSITORY_ADMISSION",
      policyVersion: "repository-admission-v1",
      policyHash,
      permittedPurposes: ["LANGUAGE_CANDIDATE"],
      validFrom: "2026-07-27T15:00:00Z",
      validThrough: "2026-08-27T15:00:00Z",
      approvals: [
        { role: "Don", approverId: "don", approvedAt: "2026-07-27T14:00:00Z" },
        {
          role: "Rights/Safety Reviewer",
          approverId: "rights-reviewer",
          approvedAt: "2026-07-27T14:30:00Z",
        },
      ],
    }],
  } as const;
  const registerHash = hash(register);

  return {
    policy,
    register,
    binding: {
      registerVersion: register.registerVersion,
      registerHash,
      entryId: register.entries[0].entryId,
    },
    purpose: "LANGUAGE_CANDIDATE",
    authoritativeReceiptTime: "2026-07-28T15:00:00Z",
  } as const;
};

const authorize = (input: unknown) =>
  authorizePolicy(input as Parameters<typeof authorizePolicy>[0]);

const replaceEntries = (
  input: ReturnType<typeof createInput>,
  entries: readonly unknown[],
) => {
  const register = { ...input.register, entries };
  return {
    ...input,
    register,
    binding: { ...input.binding, registerHash: hash(register) },
  };
};

describe("approved policy register", () => {
  it("authorizes a canonically hashed policy through its exact effective entry", () => {
    expect(authorizePolicy(createInput())).toEqual({
      policyClass: "REPOSITORY_ADMISSION",
      policyVersion: "repository-admission-v1",
      policyHash: hash(policy),
      registerVersion: "approved-policies-v1",
      registerHash: hash(createInput().register),
      entryId: "repository-admission-v1",
      purpose: "LANGUAGE_CANDIDATE",
    });
  });

  it("canonicalizes JSON object keys and rejects non-JSON numbers", () => {
    expect(canonicalSha256({ second: 2, first: 1 })).toBe(
      canonicalSha256({ first: 1, second: 2 }),
    );
    expect(canonicalSha256({ a: 2, Z: 1 })).toBe(
      createHash("sha256").update('{"Z":1,"a":2}').digest("hex"),
    );
    expect(() => canonicalSha256({ value: Number.NaN })).toThrow(
      "canonical value contains a non-finite number",
    );
  });

  it("rejects unknown policy classes and altered policy content", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      policy: { ...input.policy, policyClass: "LICENSE_POLICY" },
    })).toThrow("policy class is unknown");
    expect(() => authorize({
      ...input,
      policy: { ...input.policy, unexpected: true },
    })).toThrow("policy hash does not match entry");
  });

  it("rejects policy class, version, and purpose mismatches", () => {
    const input = createInput();
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      policyClass: "ATTRIBUTION_MARKER",
    }]))).toThrow("policy class does not match entry");
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      policyVersion: "repository-admission-v2",
    }]))).toThrow("policy version does not match entry");
    expect(() => authorize({
      ...input,
      purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    })).toThrow("purpose is not permitted");
  });

  it("rejects policies outside their effective interval", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-07-27T14:59:59Z",
    })).toThrow("policy is not yet valid");
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-08-27T15:00:01Z",
    })).toThrow("policy has expired");
  });

  it("requires complete, distinct, dated Don and rights approvals", () => {
    const input = createInput();
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      approvals: [input.register.entries[0].approvals[0]],
    }]))).toThrow("policy approvals are incomplete");
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      approvals: [
        input.register.entries[0].approvals[0],
        { ...input.register.entries[0].approvals[0], approverId: "other" },
      ],
    }]))).toThrow("policy approvals are incomplete");
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      approvals: [
        input.register.entries[0].approvals[0],
        {
          ...input.register.entries[0].approvals[1],
          approvedAt: "2026-07-27T14:30:00.000Z",
        },
      ],
    }]))).toThrow("approvedAt must be whole-second RFC3339 UTC");
  });

  it("rejects a register or entry that does not exactly match the binding", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, registerVersion: "approved-policies-v2" },
    })).toThrow("register version does not match binding");
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, registerHash: "0".repeat(64) },
    })).toThrow("register hash does not match binding");
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, entryId: "unknown-entry" },
    })).toThrow("bound policy entry is unknown");
  });

  it("rejects duplicate entry identifiers and invalid validity fields", () => {
    const input = createInput();
    expect(() => authorize(replaceEntries(input, [
      input.register.entries[0],
      input.register.entries[0],
    ]))).toThrow("policy entry identifiers must be unique");
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-07-28T15:00:00.000Z",
    })).toThrow("authoritativeReceiptTime must be whole-second RFC3339 UTC");
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      validThrough: "2026-07-27T14:59:59Z",
    }]))).toThrow("validThrough must not precede validFrom");
  });

  it("uses a specific authorization error type", () => {
    expect(() => authorize({
      ...createInput(),
      binding: { ...createInput().binding, entryId: "missing" },
    })).toThrow(PolicyAuthorizationError);
  });

  it("rejects malformed entry policy, purpose, and approval fields", () => {
    const input = createInput();
    const cases = [
      [{ ...input.register.entries[0], policyHash: "bad" }, "entry policyHash must be SHA-256"],
      [{ ...input.register.entries[0], permittedPurposes: ["UNKNOWN"] }, "permitted purpose is unknown"],
      [{ ...input.register.entries[0], permittedPurposes: ["LANGUAGE_CANDIDATE", "LANGUAGE_CANDIDATE"] }, "permittedPurposes must be unique"],
      [{ ...input.register.entries[0], approvals: [
        input.register.entries[0].approvals[0],
        { ...input.register.entries[0].approvals[1], approverId: "don" },
      ] }, "policy approvers must be distinct"],
      [{ ...input.register.entries[0], approvals: [
        input.register.entries[0].approvals[0],
        { ...input.register.entries[0].approvals[1], approvedAt: "2026-07-29T15:00:00Z" },
      ] }, "policy approval is not yet effective"],
    ] as const;
    for (const [entry, message] of cases) {
      expect(() => authorize(replaceEntries(input, [entry]))).toThrow(message);
    }
  });

  it("accepts a registered attribution-marker policy", () => {
    const input = createInput();
    const markerPolicy = {
      policyClass: "ATTRIBUTION_MARKER",
      policyVersion: "attribution-markers-v1",
      markerRules: [],
    } as const;
    const entry = {
      ...input.register.entries[0],
      policyClass: "ATTRIBUTION_MARKER",
      policyVersion: markerPolicy.policyVersion,
      policyHash: hash(markerPolicy),
      permittedPurposes: ["RECORDED_AGENT_PARTICIPATION_CANDIDATE"],
    } as const;
    expect(authorize({
      ...replaceEntries(input, [entry]),
      policy: markerPolicy,
      purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    }).policyClass).toBe("ATTRIBUTION_MARKER");
  });
});
