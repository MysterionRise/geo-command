import {
  authorizeOperatorRun,
  isIssuedOperatorRun,
  type AuthorizedOperatorRun,
  type OperatorAuthorizationInput,
} from "../policy/operator-authorization";
import type { AuthorizedPolicy } from "../policy/policy-register";
import {
  buildCommitEndpoint,
  buildRepositoryEndpoint,
  type AcquisitionRequest,
} from "../github/request";
import {
  parseChildCommitSource,
  parseParentCommitSource,
  parseRepositorySource,
} from "../github/source-receipt";
import {
  BoundedGitHubTransport,
  GitHubRateLimitPause,
} from "../github/transport";

export interface AuthorizedCommitReceipt {
  readonly status: "AUTHORIZED_COMMIT_RECEIPT";
  readonly repository: string;
  readonly subtree: string;
  readonly childSha: string;
  readonly parentSha: string;
  readonly childTreeSha: string;
  readonly parentTreeSha: string;
  readonly repositoryId: string;
  readonly repositoryMetadataHash: string;
  readonly licenseIdentifier: string;
  readonly commit: {
    readonly author: {
      readonly name: string;
      readonly login: string;
      readonly type: "User" | "Bot";
    };
    readonly committer: {
      readonly name: string;
      readonly login: string;
      readonly type: "User" | "Bot";
    };
    readonly verification: { readonly verified: boolean; readonly reason: string };
    readonly message: string;
  };
  readonly responseDate: string;
  readonly purpose: AcquisitionRequest["purpose"];
  readonly repositoryPolicyHash: string;
  readonly attributionPolicyHash: string;
  readonly operatorEntryId: string;
}
interface Input {
  readonly request: AcquisitionRequest;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly preflightOperatorRun: AuthorizedOperatorRun;
  readonly operatorAuthorization: OperatorAuthorizationInput;
  readonly transport: BoundedGitHubTransport;
}

export class AuthorizedSourceError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "AuthorizedSourceError";
  }
}
const fail = (code: string): never => {
  throw new AuthorizedSourceError(code);
};
const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const issuedReceipts = new WeakSet<object>();
export const isIssuedAuthorizedCommitReceipt = (
  value: unknown,
): value is AuthorizedCommitReceipt =>
  value !== null && typeof value === "object" && issuedReceipts.has(value);

const validatePreflight = (input: Input): void => {
  if (
    !isIssuedOperatorRun(input.preflightOperatorRun)
    || input.preflightOperatorRun.repository !== input.request.repository
    || input.preflightOperatorRun.commit !== input.request.commit
    || input.preflightOperatorRun.subtree !== input.request.subtree
    || input.preflightOperatorRun.purpose !== input.request.purpose
    || input.preflightOperatorRun.callerObservationTime !== input.request.observationTime
    || input.repositoryPolicy.policyClass !== "REPOSITORY_ADMISSION"
    || input.attributionPolicy.policyClass !== "ATTRIBUTION_MARKER"
    || input.repositoryPolicy.purpose !== input.request.purpose
    || input.attributionPolicy.purpose !== input.request.purpose
    || input.repositoryPolicy.registerHash !== input.attributionPolicy.registerHash
  ) fail("SOURCE_AUTHORIZATION_REJECTED");
};

const authorizeResponseDate = (
  input: Input,
  responseDate: string,
): AuthorizedOperatorRun => {
  let run: AuthorizedOperatorRun;
  try {
    run = authorizeOperatorRun({
      ...input.operatorAuthorization,
      githubDate: responseDate,
    });
  } catch {
    return fail("RECEIPT_AUTHORIZATION_REJECTED");
  }
  const preflight = input.preflightOperatorRun;
  const keys = [
    "operatorName", "osIdentity", "repository", "purpose", "tokenAllowance",
    "commit", "subtree", "callerObservationTime", "authoritativeReceiptTime", "registerVersion",
    "registerHash", "entryId", "authorizationValidFrom", "authorizationValidThrough",
  ] as const;
  if (keys.some((key) => run[key] !== preflight[key])) {
    fail("SOURCE_AUTHORIZATION_REJECTED");
  }
  return run;
};

export const acquireAuthorizedCommitReceipt = async (
  input: Input,
): Promise<Readonly<{
  receipt: AuthorizedCommitReceipt;
  operatorRun: AuthorizedOperatorRun;
}>> => {
  validatePreflight(input);
  const childResponse = await input.transport.requestReceipt(
    buildCommitEndpoint(input.request),
  );
  let child: ReturnType<typeof parseChildCommitSource>;
  try {
    child = parseChildCommitSource(childResponse.data, input.request);
  } catch {
    return fail("COMMIT_RECEIPT_REJECTED");
  }
  const operatorRun = authorizeResponseDate(input, childResponse.responseDate);
  const parentRequest = Object.freeze({ ...input.request, commit: child.parentSha });
  let parent: ReturnType<typeof parseParentCommitSource>;
  let repository: ReturnType<typeof parseRepositorySource>;
  try {
    parent = parseParentCommitSource(
      await input.transport.requestJson(buildCommitEndpoint(parentRequest)),
      child.parentSha,
    );
    repository = parseRepositorySource(
      await input.transport.requestJson(buildRepositoryEndpoint(input.request)),
      input.request,
    );
  } catch (error) {
    if (error instanceof GitHubRateLimitPause) throw error;
    return fail("SOURCE_RECEIPT_REJECTED");
  }
  const receipt = deepFreeze({
    status: "AUTHORIZED_COMMIT_RECEIPT" as const,
    repository: input.request.repository,
    subtree: input.request.subtree,
    childSha: input.request.commit,
    parentSha: child.parentSha,
    childTreeSha: child.childTreeSha,
    parentTreeSha: parent.parentTreeSha,
    repositoryId: repository.repositoryId,
    repositoryMetadataHash: repository.repositoryMetadataHash,
    licenseIdentifier: repository.licenseIdentifier,
    commit: child.commit,
    responseDate: childResponse.responseDate,
    purpose: input.request.purpose,
    repositoryPolicyHash: input.repositoryPolicy.policyHash,
    attributionPolicyHash: input.attributionPolicy.policyHash,
    operatorEntryId: operatorRun.entryId,
  });
  issuedReceipts.add(receipt);
  return Object.freeze({ receipt, operatorRun });
};
