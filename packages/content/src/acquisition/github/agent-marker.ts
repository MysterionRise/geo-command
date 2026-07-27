import { createHash } from "node:crypto";
import { canonicalSha256 } from "../policy/policy-register";

type Classification = "NAMED_MODEL_RECORDED" | "AGENT_RECORDED";
interface Identity {
  readonly name: string;
  readonly login: string;
}
interface MarkerRule {
  readonly ruleId: string;
  readonly purpose: string;
  readonly kind: "marker" | "verified-bot";
  readonly exactMarker?: string | undefined;
  readonly classification: Classification;
  readonly modelName?: string | undefined;
  readonly botLogin?: string | undefined;
  readonly documentation?: {
    readonly publisher: string;
    readonly url: string;
    readonly capturedAt: string;
    readonly contentHash: string;
    readonly productVersion: string;
    readonly expectedGitRepresentation: string;
  } | undefined;
}
interface AttributionMarkerPolicy {
  readonly policyVersion: string;
  readonly rules: readonly MarkerRule[];
}
export interface AgentMarkerInput {
  readonly purpose: string;
  readonly author: Identity;
  readonly committer: Identity;
  readonly verification: { readonly verified: boolean; readonly reason: string };
  readonly commitMessage: string;
  readonly parsedMarker?: string | undefined;
  readonly policyBinding: {
    readonly policyVersion: string;
    readonly policyHash: string;
    readonly ruleId: string;
  };
  readonly policy: AttributionMarkerPolicy;
  readonly botIdentity?: {
    readonly login: string;
    readonly verified: boolean;
    readonly vendorControlled: boolean;
  } | undefined;
}
export interface AgentMarkerResult {
  readonly classification: Classification;
  readonly publicPhrase: string;
  readonly modelName: string | undefined;
  readonly accountAttribution: string | undefined;
  readonly author: Identity;
  readonly committer: Identity;
  readonly verification: AgentMarkerInput["verification"];
  readonly commitMessageSha256: string;
  readonly parsedMarker: string | undefined;
  readonly ruleBinding: AgentMarkerInput["policyBinding"];
}
export class AgentMarkerError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "AgentMarkerError";
  }
}
const fail = (code: string): never => {
  throw new AgentMarkerError(code);
};
const SHA256 = /^[0-9a-f]{64}$/u;

const selectBoundRule = (input: AgentMarkerInput): MarkerRule => {
  const { policy, policyBinding } = input;
  if (
    typeof policy.policyVersion !== "string"
    || !Array.isArray(policy.rules)
    || policy.policyVersion !== policyBinding.policyVersion
  ) fail("RULE_BINDING_REJECTED");
  try {
    if (canonicalSha256(policy) !== policyBinding.policyHash) fail("RULE_BINDING_REJECTED");
  } catch {
    return fail("RULE_BINDING_REJECTED");
  }
  if (policy.rules.some((rule) =>
    rule === null || typeof rule !== "object" || typeof rule.ruleId !== "string")) {
    fail("RULE_BINDING_REJECTED");
  }
  const identifiers = policy.rules.map(({ ruleId }) => ruleId);
  if (new Set(identifiers).size !== identifiers.length) fail("RULE_BINDING_REJECTED");
  for (const rule of policy.rules) {
    if (
      (rule.kind !== "marker" && rule.kind !== "verified-bot")
      || (rule.classification !== "NAMED_MODEL_RECORDED"
        && rule.classification !== "AGENT_RECORDED")
    ) fail("RULE_ENUM_REJECTED");
  }
  return policy.rules.find(({ ruleId }) => ruleId === policyBinding.ruleId)
    ?? fail("RULE_BINDING_REJECTED");
};

const validateRule = (input: AgentMarkerInput, rule: MarkerRule): void => {
  if (
    input.purpose !== "RECORDED_AGENT_PARTICIPATION_CANDIDATE"
    || rule.purpose !== input.purpose
  ) fail("PURPOSE_REJECTED");
  if (!SHA256.test(input.policyBinding.policyHash)) fail("RULE_BINDING_REJECTED");
  const document = rule.documentation;
  if (
    document === undefined
    || Object.values(document).some((value) =>
      typeof value !== "string" || value.length === 0)
  ) return fail("DOCUMENTATION_REJECTED");
  let documentUrl: URL;
  try {
    documentUrl = new URL(document?.url ?? "");
  } catch {
    return fail("DOCUMENTATION_REJECTED");
  }
  const capturedAt = document?.capturedAt ?? "";
  if (
    !SHA256.test(document.contentHash)
    || documentUrl.protocol !== "https:"
    || documentUrl.username !== ""
    || documentUrl.password !== ""
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(capturedAt)
    || new Date(capturedAt).toISOString() !== capturedAt.replace("Z", ".000Z")
  ) fail("DOCUMENTATION_REJECTED");
  const named = rule.classification === "NAMED_MODEL_RECORDED";
  if ((named && !rule.modelName) || (!named && rule.modelName !== undefined)) {
    fail("AMBIGUOUS_CLASSIFICATION");
  }
};

const classifyEvidence = (
  input: AgentMarkerInput,
  rule: MarkerRule,
): { readonly marker: string | undefined; readonly account: string | undefined } => {
  const messageLines = input.commitMessage.split("\n");
  const recognizedMarkers = input.policy.rules.filter((candidate) =>
    candidate.kind === "marker"
    && typeof candidate.exactMarker === "string"
    && messageLines.includes(candidate.exactMarker));
  if (recognizedMarkers.length > 1) fail("AMBIGUOUS_CLASSIFICATION");
  if (rule.kind === "verified-bot" && recognizedMarkers.length > 0) {
    fail("AMBIGUOUS_CLASSIFICATION");
  }
  if (rule.kind === "marker") {
    if (
      input.parsedMarker === undefined
      || input.parsedMarker !== rule.exactMarker
      || recognizedMarkers.length !== 1
      || recognizedMarkers[0]?.ruleId !== rule.ruleId
    ) fail("MARKER_REJECTED");
    return { marker: input.parsedMarker, account: undefined };
  }
  const bot = input.botIdentity;
  if (
    rule.classification !== "AGENT_RECORDED"
    || bot === undefined
    || bot.verified !== true
    || bot.vendorControlled !== true
    || bot.login !== rule.botLogin
    || input.author.login !== bot.login
  ) fail("BOT_IDENTITY_REJECTED");
  const acceptedBot = bot ?? fail("BOT_IDENTITY_REJECTED");
  return { marker: undefined, account: acceptedBot.login };
};

export const classifyAgentMarker = (input: AgentMarkerInput): AgentMarkerResult => {
  const rule = selectBoundRule(input);
  validateRule(input, rule);
  const evidence = classifyEvidence(input, rule);
  return Object.freeze({
    classification: rule.classification,
    publicPhrase: rule.classification === "AGENT_RECORDED"
      ? "AI coding agent"
      : rule.modelName ?? fail("AMBIGUOUS_CLASSIFICATION"),
    modelName: rule.modelName,
    accountAttribution: evidence.account,
    author: Object.freeze({ ...input.author }),
    committer: Object.freeze({ ...input.committer }),
    verification: Object.freeze({ ...input.verification }),
    commitMessageSha256: createHash("sha256").update(input.commitMessage).digest("hex"),
    parsedMarker: evidence.marker,
    ruleBinding: Object.freeze({ ...input.policyBinding }),
  });
};
