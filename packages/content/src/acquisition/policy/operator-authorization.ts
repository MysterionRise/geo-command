import {
  ACQUISITION_PURPOSES,
  canonicalSha256,
  type AcquisitionPurpose,
} from "./policy-register";
import { requireExactText, requireWholeSecondUtc } from "./validation";

export const READ_ONLY_PUBLIC_REPOSITORY_TOKEN =
  "PUBLIC_REPOSITORY_METADATA_AND_CONTENTS_READ_ONLY" as const;

export interface OperatorApproval {
  readonly role: "Release Operator" | "Security Reviewer";
  readonly approverId: string;
  readonly approvedAt: string;
}

export interface OperatorAuthorizationEntry {
  readonly entryId: string;
  readonly operatorName: string;
  readonly osIdentity: string;
  readonly repositories: readonly string[];
  readonly purposes: readonly AcquisitionPurpose[];
  readonly tokenAllowance: typeof READ_ONLY_PUBLIC_REPOSITORY_TOKEN;
  readonly validFrom: string;
  readonly validThrough?: string;
  readonly approvals: readonly OperatorApproval[];
}

export interface OperatorAuthorizationRegister {
  readonly registerVersion: string;
  readonly entries: readonly OperatorAuthorizationEntry[];
}

export interface OperatorAuthorizationInput {
  readonly register: OperatorAuthorizationRegister;
  readonly binding: {
    readonly registerVersion: string;
    readonly registerHash: string;
    readonly entryId: string;
  };
  readonly operatorName: string;
  readonly osIdentity: string;
  readonly repository: string;
  readonly purpose: AcquisitionPurpose;
  readonly tokenAllowance: typeof READ_ONLY_PUBLIC_REPOSITORY_TOKEN;
  readonly callerObservationTime: string;
  readonly authoritativeReceiptTime: string;
  readonly githubDate: string;
}

export interface AuthorizedOperatorRun {
  readonly operatorName: string;
  readonly osIdentity: string;
  readonly repository: string;
  readonly purpose: AcquisitionPurpose;
  readonly tokenAllowance: typeof READ_ONLY_PUBLIC_REPOSITORY_TOKEN;
  readonly callerObservationTime: string;
  readonly authoritativeReceiptTime: string;
  readonly githubDate: string;
  readonly registerVersion: string;
  readonly registerHash: string;
  readonly entryId: string;
}

export class OperatorAuthorizationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OperatorAuthorizationError";
  }
}

const fail = (message: string): never => {
  throw new OperatorAuthorizationError(message);
};

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const REPOSITORY_IDENTITY = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/u;

const requireGitHubDate = (value: unknown): string => {
  if (typeof value !== "string") return fail("GitHub Date is required");
  if (value.length === 0) return fail("GitHub Date is required");
  if (
    !IMF_FIXDATE.test(value)
    || Number.isNaN(Date.parse(value))
    || new Date(value).toUTCString() !== value
  ) {
    fail("GitHub Date must be IMF-fixdate");
  }
  return value;
};

const validateApprovals = (
  approvals: readonly OperatorApproval[],
  receiptTime: string,
): void => {
  if (!Array.isArray(approvals) || approvals.length !== 2) {
    fail("operator approvals are incomplete");
  }
  const roles = new Set(approvals.map(({ role }) => role));
  if (
    roles.size !== 2
    || !roles.has("Release Operator")
    || !roles.has("Security Reviewer")
  ) {
    fail("operator approvals are incomplete");
  }
  const approvers = new Set(approvals.map(({ approverId }) =>
    requireExactText(approverId, "approverId", fail)));
  if (approvers.size !== 2) fail("operator approvers must be distinct");
  for (const approval of approvals) {
    const approvedAt = requireWholeSecondUtc(approval.approvedAt, "approvedAt", fail);
    if (approvedAt > receiptTime) fail("operator approval is not yet effective");
  }
};

const validateEntry = (
  entry: OperatorAuthorizationEntry,
  receiptTime: string,
): void => {
  requireExactText(entry.entryId, "entryId", fail);
  requireExactText(entry.operatorName, "operatorName", fail);
  requireExactText(entry.osIdentity, "osIdentity", fail);
  if (
    !Array.isArray(entry.repositories)
    || entry.repositories.length === 0
    || entry.repositories.some((repository) => !REPOSITORY_IDENTITY.test(repository))
  ) {
    fail("authorized repositories are invalid");
  }
  if (new Set(entry.repositories).size !== entry.repositories.length) {
    fail("authorized repositories must be unique");
  }
  if (
    !Array.isArray(entry.purposes)
    || entry.purposes.length === 0
    || entry.purposes.some((item) => !ACQUISITION_PURPOSES.includes(item))
  ) {
    fail("authorized purposes are invalid");
  }
  if (new Set(entry.purposes).size !== entry.purposes.length) {
    fail("authorized purposes must be unique");
  }
  if (entry.tokenAllowance !== READ_ONLY_PUBLIC_REPOSITORY_TOKEN) {
    fail("authorized token allowance is not least privilege");
  }

  const validFrom = requireWholeSecondUtc(entry.validFrom, "validFrom", fail);
  const validThrough = entry.validThrough === undefined
    ? undefined
    : requireWholeSecondUtc(entry.validThrough, "validThrough", fail);
  if (validThrough !== undefined && validThrough < validFrom) {
    fail("validThrough must not precede validFrom");
  }
  if (receiptTime < validFrom) fail("operator authorization is not yet valid");
  if (validThrough !== undefined && receiptTime > validThrough) {
    fail("operator authorization has expired");
  }
  validateApprovals(entry.approvals, receiptTime);
};

const validateTimes = (
  input: OperatorAuthorizationInput,
): Readonly<{
  receiptTime: string;
  observationTime: string;
  githubDate: string;
}> => {
  const receiptTime = requireWholeSecondUtc(
    input.authoritativeReceiptTime,
    "authoritativeReceiptTime",
    fail,
  );
  const observationTime = requireWholeSecondUtc(
    input.callerObservationTime,
    "callerObservationTime",
    fail,
  );
  if (Date.parse(observationTime) - Date.parse(receiptTime) > MAX_CLOCK_SKEW_MS) {
    fail("caller observation exceeds receipt time by more than five minutes");
  }
  const githubDate = requireGitHubDate(input.githubDate);
  if (Math.abs(Date.parse(githubDate) - Date.parse(receiptTime)) > MAX_CLOCK_SKEW_MS) {
    fail("GitHub Date clock skew exceeds five minutes");
  }
  return { receiptTime, observationTime, githubDate };
};

const bindEntry = (
  input: OperatorAuthorizationInput,
  receiptTime: string,
): Readonly<{
  entry: OperatorAuthorizationEntry;
  registerVersion: string;
  registerHash: string;
}> => {
  const registerVersion = requireExactText(
    input.register.registerVersion,
    "registerVersion",
    fail,
  );
  if (input.binding.registerVersion !== registerVersion) {
    fail("register version does not match binding");
  }
  const registerHash = canonicalSha256(input.register);
  if (input.binding.registerHash !== registerHash) {
    fail("register hash does not match binding");
  }
  const entryIdentifiers = input.register.entries.map(({ entryId }) => entryId);
  if (new Set(entryIdentifiers).size !== entryIdentifiers.length) {
    fail("operator entry identifiers must be unique");
  }
  const entry = input.register.entries.find(({ entryId }) =>
    entryId === input.binding.entryId);
  if (entry === undefined) return fail("bound operator entry is unknown");
  validateEntry(entry, receiptTime);
  return { entry, registerVersion, registerHash };
};

const validateRunIdentity = (
  input: OperatorAuthorizationInput,
  entry: OperatorAuthorizationEntry,
): Readonly<{ operatorName: string; osIdentity: string }> => {
  const operatorName = requireExactText(input.operatorName, "operatorName", fail);
  const osIdentity = requireExactText(input.osIdentity, "osIdentity", fail);
  if (operatorName !== entry.operatorName) fail("operator name does not match authorization");
  if (osIdentity !== entry.osIdentity) {
    fail("operating-system identity does not match authorization");
  }
  if (!REPOSITORY_IDENTITY.test(input.repository) || !entry.repositories.includes(input.repository)) {
    fail("repository is not authorized");
  }
  if (!ACQUISITION_PURPOSES.includes(input.purpose) || !entry.purposes.includes(input.purpose)) {
    fail("purpose is not authorized");
  }
  if (
    input.tokenAllowance !== READ_ONLY_PUBLIC_REPOSITORY_TOKEN
    || entry.tokenAllowance !== input.tokenAllowance
  ) {
    fail("token allowance is not least privilege");
  }
  return { operatorName, osIdentity };
};

export const authorizeOperatorRun = (
  input: OperatorAuthorizationInput,
): AuthorizedOperatorRun => {
  const { receiptTime, observationTime, githubDate } = validateTimes(input);
  const { entry, registerVersion, registerHash } = bindEntry(input, receiptTime);
  const { operatorName, osIdentity } = validateRunIdentity(input, entry);
  return Object.freeze({
    operatorName,
    osIdentity,
    repository: input.repository,
    purpose: input.purpose,
    tokenAllowance: input.tokenAllowance,
    callerObservationTime: observationTime,
    authoritativeReceiptTime: receiptTime,
    githubDate,
    registerVersion,
    registerHash,
    entryId: entry.entryId,
  });
};
