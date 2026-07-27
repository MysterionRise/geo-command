import { createHash } from "node:crypto";

import { requireExactText, requireWholeSecondUtc } from "./validation";

export const POLICY_CLASSES = Object.freeze([
  "REPOSITORY_ADMISSION",
  "ATTRIBUTION_MARKER",
] as const);

export const ACQUISITION_PURPOSES = Object.freeze([
  "LANGUAGE_CANDIDATE",
  "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
] as const);

export type PolicyClass = (typeof POLICY_CLASSES)[number];
export type AcquisitionPurpose = (typeof ACQUISITION_PURPOSES)[number];

export interface PolicyApproval {
  readonly role: "Don" | "Rights/Safety Reviewer";
  readonly approverId: string;
  readonly approvedAt: string;
}

export interface ApprovedPolicyEntry {
  readonly entryId: string;
  readonly policyClass: PolicyClass;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly permittedPurposes: readonly AcquisitionPurpose[];
  readonly validFrom: string;
  readonly validThrough?: string;
  readonly approvals: readonly PolicyApproval[];
}

export interface ApprovedPolicyRegister {
  readonly registerVersion: string;
  readonly entries: readonly ApprovedPolicyEntry[];
}

export interface PolicyRegisterBinding {
  readonly registerVersion: string;
  readonly registerHash: string;
  readonly entryId: string;
}

export interface PolicyAuthorizationInput {
  readonly policy: Readonly<Record<string, unknown>>;
  readonly register: ApprovedPolicyRegister;
  readonly binding: PolicyRegisterBinding;
  readonly purpose: AcquisitionPurpose;
  readonly authoritativeReceiptTime: string;
}

export interface AuthorizedPolicy {
  readonly policyClass: PolicyClass;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly registerVersion: string;
  readonly registerHash: string;
  readonly entryId: string;
  readonly purpose: AcquisitionPurpose;
}

export class PolicyAuthorizationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PolicyAuthorizationError";
  }
}

const fail = (message: string): never => {
  throw new PolicyAuthorizationError(message);
};

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PolicyAuthorizationError("canonical value contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value !== "object") return fail("canonical value is not JSON");
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
    .join(",")}}`;
};

export const canonicalSha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value)).digest("hex");

const policyClass = (value: unknown, field: string): PolicyClass => {
  if (!POLICY_CLASSES.includes(value as PolicyClass)) return fail(`${field} is unknown`);
  return value as PolicyClass;
};

const purpose = (value: unknown, field: string): AcquisitionPurpose => {
  if (!ACQUISITION_PURPOSES.includes(value as AcquisitionPurpose)) return fail(`${field} is unknown`);
  return value as AcquisitionPurpose;
};

const validateEntry = (
  entry: ApprovedPolicyEntry,
  receiptTime: string,
): void => {
  requireExactText(entry.entryId, "entryId", fail);
  policyClass(entry.policyClass, "entry policy class");
  requireExactText(entry.policyVersion, "entry policyVersion", fail);
  if (!/^[a-f0-9]{64}$/u.test(entry.policyHash)) fail("entry policyHash must be SHA-256");
  if (!Array.isArray(entry.permittedPurposes) || entry.permittedPurposes.length === 0) {
    fail("permittedPurposes must not be empty");
  }
  const purposes = entry.permittedPurposes.map((item) => purpose(item, "permitted purpose"));
  if (new Set(purposes).size !== purposes.length) fail("permittedPurposes must be unique");

  const validFrom = requireWholeSecondUtc(entry.validFrom, "validFrom", fail);
  const validThrough = entry.validThrough === undefined
    ? undefined
    : requireWholeSecondUtc(entry.validThrough, "validThrough", fail);
  if (validThrough !== undefined && validThrough < validFrom) {
    fail("validThrough must not precede validFrom");
  }
  if (receiptTime < validFrom) fail("policy is not yet valid");
  if (validThrough !== undefined && receiptTime > validThrough) fail("policy has expired");

  if (!Array.isArray(entry.approvals) || entry.approvals.length !== 2) {
    fail("policy approvals are incomplete");
  }
  const roles = new Set(entry.approvals.map(({ role }) => role));
  if (
    roles.size !== 2
    || !roles.has("Don")
    || !roles.has("Rights/Safety Reviewer")
  ) {
    fail("policy approvals are incomplete");
  }
  const approvers = new Set(entry.approvals.map((approval) =>
    requireExactText(approval.approverId, "approverId", fail)));
  if (approvers.size !== 2) fail("policy approvers must be distinct");
  for (const approval of entry.approvals) {
    const approvedAt = requireWholeSecondUtc(approval.approvedAt, "approvedAt", fail);
    if (approvedAt > receiptTime) fail("policy approval is not yet effective");
  }
};

export const authorizePolicy = (input: PolicyAuthorizationInput): AuthorizedPolicy => {
  const authorizedPolicyClass = policyClass(input.policy.policyClass, "policy class");
  const policyVersion = input.policy.policyVersion as string;
  requireExactText(policyVersion, "policyVersion", fail);
  const authorizedPurpose = purpose(input.purpose, "purpose");
  const receiptTime = requireWholeSecondUtc(
    input.authoritativeReceiptTime,
    "authoritativeReceiptTime",
    fail,
  );
  const registerVersion = requireExactText(
    input.register.registerVersion,
    "registerVersion",
    fail,
  );
  if (input.binding.registerVersion !== registerVersion) {
    fail("register version does not match binding");
  }
  const policyHash = canonicalSha256(input.policy);
  const registerHash = canonicalSha256(input.register);
  if (input.binding.registerHash !== registerHash) {
    fail("register hash does not match binding");
  }
  const entryIdentifiers = input.register.entries.map(({ entryId }) => entryId);
  if (new Set(entryIdentifiers).size !== entryIdentifiers.length) {
    fail("policy entry identifiers must be unique");
  }
  const entry = input.register.entries.find(({ entryId }) => entryId === input.binding.entryId);

  if (entry === undefined) return fail("bound policy entry is unknown");
  validateEntry(entry, receiptTime);
  if (entry.policyClass !== authorizedPolicyClass) fail("policy class does not match entry");
  if (entry.policyVersion !== policyVersion) fail("policy version does not match entry");
  if (!entry.permittedPurposes.includes(authorizedPurpose)) fail("purpose is not permitted");
  if (entry.policyHash !== policyHash) fail("policy hash does not match entry");

  return Object.freeze({
    policyClass: authorizedPolicyClass,
    policyVersion,
    policyHash,
    registerVersion,
    registerHash,
    entryId: entry.entryId,
    purpose: authorizedPurpose,
  });
};
