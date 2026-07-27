import { createHash } from "node:crypto";
import { AgentMarkerError, classifyAgentMarker } from "./agent-marker";
import { canonicalSha256 } from "../policy/policy-register";

const testModuleName: string = "vitest";
interface Expectation {
  toBe(expected: unknown): void;
  toBeInstanceOf(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}
interface TestApi {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): Expectation;
  it(name: string, callback: () => unknown): void;
}
const { describe, expect, it } = await import(testModuleName) as TestApi;
const documentation = {
  publisher: "Vendor",
  url: "https://vendor.example/evidence",
  capturedAt: "2026-07-20T00:00:00Z",
  contentHash: "d".repeat(64),
  productVersion: "1",
  expectedGitRepresentation: "Co-authored-by trailer",
} as const;
const namedRule = {
  ruleId: "claude-trailer",
  purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
  kind: "marker",
  exactMarker: "Co-authored-by: Claude <noreply@anthropic.com>",
  classification: "NAMED_MODEL_RECORDED",
  modelName: "Claude",
  documentation,
} as const;
const namedPolicy = { policyVersion: "markers-v1", rules: [namedRule] } as const;
const base = {
  purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
  author: { name: "Developer", login: "developer" },
  committer: { name: "Developer", login: "developer" },
  verification: { verified: true, reason: "valid" },
  commitMessage: "Implement feature\n\nCo-authored-by: Claude <noreply@anthropic.com>",
  parsedMarker: "Co-authored-by: Claude <noreply@anthropic.com>",
  policyBinding: {
    policyVersion: "markers-v1",
    policyHash: canonicalSha256(namedPolicy),
    ruleId: "claude-trailer",
  },
  policy: namedPolicy,
} as const;

describe("recorded agent marker classification", () => {
  it("accepts an exact documented named-model marker and preserves evidence bindings", () => {
    const result = classifyAgentMarker(base);
    expect(result.classification).toBe("NAMED_MODEL_RECORDED");
    expect(result.modelName).toBe("Claude");
    expect(result.commitMessageSha256).toBe(
      createHash("sha256").update(base.commitMessage).digest("hex"),
    );
    expect(result.author).toEqual(base.author);
    expect(result.committer).toEqual(base.committer);
    expect(result.ruleBinding).toEqual(base.policyBinding);
  });

  it("keeps generic marker evidence generic with the exact public phrase", () => {
    const marker = "Agent-assisted-by: Vendor Agent";
    const policy = {
      policyVersion: "markers-v1",
      rules: [{
        ruleId: "generic-agent",
        purpose: namedRule.purpose,
        kind: "marker",
        exactMarker: marker,
        classification: "AGENT_RECORDED",
        documentation,
      }],
    } as const;
    const result = classifyAgentMarker({
      ...base,
      commitMessage: `Change\n\n${marker}`,
      parsedMarker: marker,
      policyBinding: {
        ...base.policyBinding,
        policyHash: canonicalSha256(policy),
        ruleId: "generic-agent",
      },
      policy,
    });
    expect(result.classification).toBe("AGENT_RECORDED");
    expect(result.publicPhrase).toBe("AI coding agent");
    expect(result.modelName).toBe(undefined);
  });

  it("accepts only a verified vendor-controlled bot identity and keeps attribution separate", () => {
    const policy = {
      policyVersion: "markers-v1",
      rules: [{
        ruleId: namedRule.ruleId,
        purpose: namedRule.purpose,
        kind: "verified-bot",
        classification: "AGENT_RECORDED",
        botLogin: "vendor-bot",
        documentation,
      }],
    } as const;
    const result = classifyAgentMarker({
      ...base,
      author: { name: "Vendor Bot", login: "vendor-bot" },
      parsedMarker: undefined,
      policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      policy,
      botIdentity: { login: "vendor-bot", verified: true, vendorControlled: true },
    });
    expect(result.publicPhrase).toBe("AI coding agent");
    expect(result.accountAttribution).toBe("vendor-bot");
    expect(result.modelName).toBe(undefined);
  });

  it("rejects altered, malformed, undocumented, and purpose-incompatible markers", () => {
    const cases = [
      { ...base, parsedMarker: "Co-authored-by: Other" },
      { ...base, commitMessage: "marker absent" },
      { ...base, policy: { ...namedPolicy, rules: [{ ...namedRule, documentation: undefined }] } },
      { ...base, purpose: "LANGUAGE_CANDIDATE" },
      { ...base, policyBinding: { ...base.policyBinding, policyHash: "b".repeat(64) } },
    ];
    for (const input of cases) expect(() => classifyAgentMarker(input as never)).toThrow();
  });

  it("rejects ambiguous classification and unverified bot identity", () => {
    const ambiguousPolicy = {
      ...namedPolicy,
      rules: [{
        ruleId: namedRule.ruleId,
        purpose: namedRule.purpose,
        kind: namedRule.kind,
        exactMarker: namedRule.exactMarker,
        classification: namedRule.classification,
        documentation,
      }],
    };
    expect(() => classifyAgentMarker({
      ...base,
      policy: ambiguousPolicy,
      policyBinding: {
        ...base.policyBinding,
        policyHash: canonicalSha256(ambiguousPolicy),
      },
    } as never)).toThrow("AMBIGUOUS_CLASSIFICATION");
    const botPolicy = {
      policyVersion: "markers-v1",
      rules: [{
        ruleId: namedRule.ruleId,
        purpose: namedRule.purpose,
        kind: "verified-bot",
        classification: "AGENT_RECORDED",
        botLogin: "vendor-bot",
        documentation,
      }],
    } as const;
    expect(() => classifyAgentMarker({
      ...base,
      author: { name: "Bot", login: "vendor-bot" },
      parsedMarker: undefined,
      policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(botPolicy) },
      policy: botPolicy,
      botIdentity: { login: "vendor-bot", verified: false, vendorControlled: true },
    })).toThrow("BOT_IDENTITY_REJECTED");
    expect(() => classifyAgentMarker({
      ...base,
      author: { name: "Bot", login: "vendor-bot" },
      parsedMarker: undefined,
      policy: botPolicy,
      policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(botPolicy) },
      botIdentity: {
        login: "vendor-bot",
        verified: "true",
        vendorControlled: "true",
      },
    } as never)).toThrow("BOT_IDENTITY_REJECTED");
  });

  it("rejects mutated policy content that reuses the authorized hash", () => {
    for (const rule of [
      { ...namedRule, exactMarker: "Co-authored-by: Altered" },
      { ...namedRule, classification: "AGENT_RECORDED", modelName: undefined },
      { ...namedRule, documentation: { ...documentation, publisher: "Altered" } },
    ]) {
      expect(() => classifyAgentMarker({
        ...base,
        policy: { ...namedPolicy, rules: [rule] },
      } as never)).toThrow("RULE_BINDING_REJECTED");
    }
  });

  it("rejects unknown rule kind and classification enums", () => {
    for (const mutation of [
      { kind: "conventional-trailer" },
      { classification: "MODEL_DETECTED" },
    ]) {
      const policy = {
        ...namedPolicy,
        rules: [{ ...namedRule, ...mutation }],
      };
      expect(() => classifyAgentMarker({
        ...base,
        policy,
        policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      } as never)).toThrow("RULE_ENUM_REJECTED");
    }
  });

  it("rejects multiple recognized marker identities in the complete message", () => {
    const otherMarker = "Co-authored-by: Copilot <noreply@github.com>";
    const policy = {
      policyVersion: "markers-v1",
      rules: [
        namedRule,
        { ...namedRule, ruleId: "copilot", exactMarker: otherMarker, modelName: "Copilot" },
      ],
    } as const;
    expect(() => classifyAgentMarker({
      ...base,
      policy,
      policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      commitMessage: `${base.commitMessage}\n${otherMarker}`,
    })).toThrow("AMBIGUOUS_CLASSIFICATION");
  });

  it("rejects a selected bot when the complete message also contains a bound marker", () => {
    const botRule = {
      ruleId: "vendor-bot",
      purpose: namedRule.purpose,
      kind: "verified-bot",
      classification: "AGENT_RECORDED",
      botLogin: "vendor-bot",
      documentation,
    } as const;
    const policy = {
      policyVersion: "markers-v1",
      rules: [namedRule, botRule],
    } as const;
    expect(() => classifyAgentMarker({
      ...base,
      author: { name: "Vendor Bot", login: "vendor-bot" },
      parsedMarker: undefined,
      policy,
      policyBinding: {
        ...base.policyBinding,
        policyHash: canonicalSha256(policy),
        ruleId: botRule.ruleId,
      },
      botIdentity: { login: "vendor-bot", verified: true, vendorControlled: true },
    })).toThrow("AMBIGUOUS_CLASSIFICATION");
  });

  it("maps a malformed canonical policy entry to a non-sensitive binding error", () => {
    const policy = { policyVersion: "markers-v1", rules: [null] };
    try {
      classifyAgentMarker({
        ...base,
        policy: policy as never,
        policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentMarkerError);
      expect((error as Error).message).toBe("RULE_BINDING_REJECTED");
    }
  });

  it("rejects malformed vendor documentation with one reason code", () => {
    for (const document of [
      { ...documentation, url: "http://vendor.example/evidence" },
      { ...documentation, url: "https://user@vendor.example/evidence" },
      { ...documentation, capturedAt: "2026-07-20T00:00:00.000Z" },
      { ...documentation, capturedAt: "2026-02-30T00:00:00Z" },
      { ...documentation, contentHash: "bad" },
      { ...documentation, publisher: "" },
      { ...documentation, productVersion: "" },
      { ...documentation, expectedGitRepresentation: "" },
    ]) {
      const policy = {
        ...namedPolicy,
        rules: [{ ...namedRule, documentation: document }],
      };
      expect(() => classifyAgentMarker({
        ...base,
        policy,
        policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      })).toThrow("DOCUMENTATION_REJECTED");
    }
  });

  it("rejects non-string vendor documentation fields without leaking TypeError", () => {
    for (const field of ["publisher", "url", "capturedAt", "productVersion", "expectedGitRepresentation"] as const) {
      const policy = {
        ...namedPolicy,
        rules: [{
          ...namedRule,
          documentation: { ...documentation, [field]: 42 },
        }],
      };
      expect(() => classifyAgentMarker({
        ...base,
        policy: policy as never,
        policyBinding: { ...base.policyBinding, policyHash: canonicalSha256(policy) },
      })).toThrow("DOCUMENTATION_REJECTED");
    }
  });

  it("uses only a non-sensitive reason code in errors", () => {
    try {
      classifyAgentMarker({ ...base, parsedMarker: "raw-marker-canary" });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentMarkerError);
      expect((error as Error).message).toBe("MARKER_REJECTED");
    }
  });
});
