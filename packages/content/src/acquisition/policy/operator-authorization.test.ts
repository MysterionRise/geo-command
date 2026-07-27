import { canonicalSha256 } from "./policy-register";
import {
  OperatorAuthorizationError,
  authorizeOperatorRun,
} from "./operator-authorization";

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

const createInput = () => {
  const register = {
    registerVersion: "operator-authorizations-v1",
    entries: [{
      entryId: "operator-fixture-v1",
      operatorName: "Fixture Operator",
      osIdentity: "uid:1000:fixture",
      repositories: ["mysterionrise/encrypted-information-retrieval"],
      purposes: ["LANGUAGE_CANDIDATE"],
      tokenAllowance: "PUBLIC_REPOSITORY_METADATA_AND_CONTENTS_READ_ONLY",
      validFrom: "2026-07-27T15:00:00Z",
      validThrough: "2026-08-27T15:00:00Z",
      approvals: [
        {
          role: "Release Operator",
          approverId: "release-reviewer",
          approvedAt: "2026-07-27T14:00:00Z",
        },
        {
          role: "Security Reviewer",
          approverId: "security-reviewer",
          approvedAt: "2026-07-27T14:30:00Z",
        },
      ],
    }],
  } as const;
  const registerHash = canonicalSha256(register);

  return {
    register,
    binding: {
      registerVersion: register.registerVersion,
      registerHash,
      entryId: register.entries[0].entryId,
    },
    operatorName: "Fixture Operator",
    osIdentity: "uid:1000:fixture",
    repository: "mysterionrise/encrypted-information-retrieval",
    purpose: "LANGUAGE_CANDIDATE",
    tokenAllowance: "PUBLIC_REPOSITORY_METADATA_AND_CONTENTS_READ_ONLY",
    callerObservationTime: "2026-07-28T15:04:59Z",
    authoritativeReceiptTime: "2026-07-28T15:00:00Z",
    githubDate: "Tue, 28 Jul 2026 15:04:59 GMT",
  } as const;
};

const authorize = (input: unknown) =>
  authorizeOperatorRun(input as Parameters<typeof authorizeOperatorRun>[0]);

const replaceEntries = (
  input: ReturnType<typeof createInput>,
  entries: readonly unknown[],
) => {
  const register = { ...input.register, entries };
  return {
    ...input,
    register,
    binding: {
      ...input.binding,
      registerHash: canonicalSha256(register),
    },
  };
};

describe("operator authorization and authoritative time", () => {
  it("authorizes an exactly bound operator while preserving both time meanings", () => {
    expect(authorizeOperatorRun(createInput())).toEqual({
      operatorName: "Fixture Operator",
      osIdentity: "uid:1000:fixture",
      repository: "mysterionrise/encrypted-information-retrieval",
      purpose: "LANGUAGE_CANDIDATE",
      tokenAllowance: "PUBLIC_REPOSITORY_METADATA_AND_CONTENTS_READ_ONLY",
      callerObservationTime: "2026-07-28T15:04:59Z",
      authoritativeReceiptTime: "2026-07-28T15:00:00Z",
      githubDate: "Tue, 28 Jul 2026 15:04:59 GMT",
      registerVersion: "operator-authorizations-v1",
      registerHash: canonicalSha256(createInput().register),
      entryId: "operator-fixture-v1",
      authorizationValidFrom: "2026-07-27T15:00:00Z",
      authorizationValidThrough: "2026-08-27T15:00:00Z",
    });
  });

  it("accepts an observation and GitHub clock at the five-minute boundary", () => {
    const input = createInput();
    expect(authorizeOperatorRun({
      ...input,
      callerObservationTime: "2026-07-28T15:05:00Z",
      githubDate: "Tue, 28 Jul 2026 15:05:00 GMT",
    }).callerObservationTime).toBe("2026-07-28T15:05:00Z");
  });

  it("rejects a mismatched named operator or operating-system identity", () => {
    const input = createInput();
    expect(() => authorize({ ...input, operatorName: "Other Operator" }))
      .toThrow("operator name does not match authorization");
    expect(() => authorize({ ...input, osIdentity: "uid:1001:other" }))
      .toThrow("operating-system identity does not match authorization");
  });

  it("rejects a mismatched repository, purpose, or token allowance", () => {
    const input = createInput();
    expect(() => authorize({ ...input, repository: "other/repository" }))
      .toThrow("repository is not authorized");
    expect(() => authorize({
      ...input,
      purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    })).toThrow("purpose is not authorized");
    expect(() => authorize({ ...input, tokenAllowance: "FULL_REPOSITORY_ACCESS" }))
      .toThrow("token allowance is not least privilege");
  });

  it("rejects an inactive or incompletely approved authorization", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-07-27T14:59:59Z",
      callerObservationTime: "2026-07-27T14:59:59Z",
      githubDate: "Mon, 27 Jul 2026 14:59:59 GMT",
    })).toThrow("operator authorization is not yet valid");
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-08-27T15:00:01Z",
      callerObservationTime: "2026-08-27T15:00:01Z",
      githubDate: "Thu, 27 Aug 2026 15:00:01 GMT",
    })).toThrow("operator authorization has expired");
    expect(() => authorize(replaceEntries(input, [{
      ...input.register.entries[0],
      approvals: [input.register.entries[0].approvals[0]],
    }]))).toThrow("operator approvals are incomplete");
  });

  it("rejects invalid whole-second UTC receipt and observation times", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      authoritativeReceiptTime: "2026-07-28T15:00:00.000Z",
    })).toThrow("authoritativeReceiptTime must be whole-second RFC3339 UTC");
    expect(() => authorize({
      ...input,
      callerObservationTime: "2026-07-28T15:04:59+00:00",
    })).toThrow("callerObservationTime must be whole-second RFC3339 UTC");
  });

  it("rejects an observation more than five minutes after receipt", () => {
    expect(() => authorize({
      ...createInput(),
      callerObservationTime: "2026-07-28T15:05:01Z",
    })).toThrow("caller observation exceeds receipt time by more than five minutes");
  });

  it("rejects missing, malformed, or excessively skewed GitHub dates", () => {
    const input = createInput();
    expect(() => authorize({ ...input, githubDate: "" }))
      .toThrow("GitHub Date is required");
    expect(() => authorize({ ...input, githubDate: "2026-07-28T15:00:00Z" }))
      .toThrow("GitHub Date must be IMF-fixdate");
    expect(() => authorize({
      ...input,
      githubDate: "Tue, 28 Jul 2026 15:05:01 GMT",
    })).toThrow("GitHub Date clock skew exceeds five minutes");
  });

  it("rejects a register or entry that does not exactly match the binding", () => {
    const input = createInput();
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, registerVersion: "operator-authorizations-v2" },
    })).toThrow("register version does not match binding");
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, registerHash: "0".repeat(64) },
    })).toThrow("register hash does not match binding");
    expect(() => authorize({
      ...input,
      binding: { ...input.binding, entryId: "missing" },
    })).toThrow("bound operator entry is unknown");
  });

  it("uses a specific authorization error type", () => {
    expect(() => authorize({
      ...createInput(),
      binding: { ...createInput().binding, entryId: "missing" },
    })).toThrow(OperatorAuthorizationError);
  });

  it("rejects malformed or duplicated authorization scopes", () => {
    const input = createInput();
    const cases = [
      [{ ...input.register.entries[0], repositories: ["NOT/CANONICAL"] }, "authorized repositories are invalid"],
      [{ ...input.register.entries[0], repositories: [input.repository, input.repository] }, "authorized repositories must be unique"],
      [{ ...input.register.entries[0], purposes: ["UNKNOWN"] }, "authorized purposes are invalid"],
      [{ ...input.register.entries[0], purposes: ["LANGUAGE_CANDIDATE", "LANGUAGE_CANDIDATE"] }, "authorized purposes must be unique"],
      [{ ...input.register.entries[0], tokenAllowance: "FULL_REPOSITORY_ACCESS" }, "authorized token allowance is not least privilege"],
    ] as const;
    for (const [entry, message] of cases) {
      expect(() => authorize(replaceEntries(input, [entry]))).toThrow(message);
    }
  });

  it("rejects malformed approval, lineage, and validity records", () => {
    const input = createInput();
    const cases = [
      [{ ...input.register.entries[0], approvals: [
        input.register.entries[0].approvals[0],
        { ...input.register.entries[0].approvals[1], approverId: "release-reviewer" },
      ] }, "operator approvers must be distinct"],
      [{ ...input.register.entries[0], approvals: [
        input.register.entries[0].approvals[0],
        { ...input.register.entries[0].approvals[1], approvedAt: "2026-07-29T15:00:00Z" },
      ] }, "operator approval is not yet effective"],
      [{ ...input.register.entries[0], validThrough: "2026-07-27T14:59:59Z" }, "validThrough must not precede validFrom"],
    ] as const;
    for (const [entry, message] of cases) {
      expect(() => authorize(replaceEntries(input, [entry]))).toThrow(message);
    }
    expect(() => authorize(replaceEntries(input, [
      input.register.entries[0],
      input.register.entries[0],
    ]))).toThrow("operator entry identifiers must be unique");
  });
});
