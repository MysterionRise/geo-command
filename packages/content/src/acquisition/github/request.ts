export const ACQUISITION_PURPOSES = Object.freeze([
  "LANGUAGE_CANDIDATE",
  "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
] as const);

export type AcquisitionPurpose = (typeof ACQUISITION_PURPOSES)[number];
export type GitObjectKind = "trees" | "blobs";
export type GitHubEndpoint = string & { readonly __githubEndpoint: unique symbol };

export interface ApprovedAcquisitionScope {
  readonly repository: string;
  readonly subtree: string;
  readonly purpose: AcquisitionPurpose;
}

export interface AcquisitionRequest {
  readonly repository: string;
  readonly commit: string;
  readonly subtree: string;
  readonly purpose: AcquisitionPurpose;
  readonly observationTime: string;
}

export class AcquisitionRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AcquisitionRequestError";
  }
}

const fail = (message: string): never => {
  throw new AcquisitionRequestError(message);
};

const REQUEST_FIELDS = Object.freeze([
  "commit",
  "observationTime",
  "purpose",
  "repository",
  "subtree",
]);
const FULL_SHA = /^[0-9a-f]{40}$/u;
const WHOLE_SECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const REPOSITORY =
  /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u;
const SUBTREE_SEGMENT = /^[A-Za-z0-9._-]+$/u;
const ALLOWED_ENDPOINT =
  /^https:\/\/api\.github\.com\/repos\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\/(?:commits\/[0-9a-f]{40}|git\/(?:trees|blobs)\/[0-9a-f]{40})$/u;

type RawRequest = {
  readonly commit: string;
  readonly observationTime: string;
  readonly purpose: string;
  readonly repository: string;
  readonly subtree: string;
};

const hasExactRequestFields = (
  input: unknown,
): input is RawRequest => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    keys.length === REQUEST_FIELDS.length
    && keys.every((key, index) => key === REQUEST_FIELDS[index])
    && REQUEST_FIELDS.every((field) => typeof record[field] === "string")
  );
};

const requireCanonicalRepository = (repository: string): void => {
  if (!REPOSITORY.test(repository)) fail("repository is not canonical");
};

const requireNormalizedSubtree = (subtree: string): void => {
  const segments = subtree.split("/");
  if (
    subtree.length === 0
    || subtree.startsWith("/")
    || subtree.endsWith("/")
    || subtree.includes("\\")
    || segments.some((segment) =>
      segment === "" || segment === "." || segment === ".." || !SUBTREE_SEGMENT.test(segment))
  ) {
    fail("subtree is not normalized");
  }
};

const requireFullSha = (sha: string, field: string): void => {
  if (!FULL_SHA.test(sha)) fail(`${field} must be forty lowercase hexadecimal characters`);
};

export const validateAcquisitionRequest = (
  input: unknown,
  scope: ApprovedAcquisitionScope,
): AcquisitionRequest => {
  const request = hasExactRequestFields(input)
    ? input
    : fail("request fields must match exactly");
  requireCanonicalRepository(request.repository);
  if (request.repository !== scope.repository) fail("repository is not the approved repository");
  requireFullSha(request.commit, "commit");
  requireNormalizedSubtree(request.subtree);
  if (request.subtree !== scope.subtree) fail("subtree is not approved");
  if (!ACQUISITION_PURPOSES.includes(request.purpose as AcquisitionPurpose)) {
    fail("purpose is unknown");
  }
  if (request.purpose !== scope.purpose) fail("purpose is not approved");
  if (
    !WHOLE_SECOND_UTC.test(request.observationTime)
    || Number.isNaN(Date.parse(request.observationTime))
    || new Date(request.observationTime).toISOString()
      !== request.observationTime.replace("Z", ".000Z")
  ) {
    fail("observationTime must be whole-second RFC3339 UTC");
  }
  return Object.freeze(request as unknown as AcquisitionRequest);
};

export const validateGitHubEndpoint = (endpoint: string): GitHubEndpoint => {
  if (!ALLOWED_ENDPOINT.test(endpoint)) fail("GitHub endpoint is not allowed");
  return endpoint as GitHubEndpoint;
};

export const buildCommitEndpoint = (request: AcquisitionRequest): GitHubEndpoint =>
  validateGitHubEndpoint(
    `https://api.github.com/repos/${request.repository}/commits/${request.commit}`,
  );

export const buildGitObjectEndpoint = (
  request: AcquisitionRequest,
  kind: GitObjectKind,
  sha: string,
): GitHubEndpoint => {
  if (kind !== "trees" && kind !== "blobs") fail("Git object kind is not allowed");
  requireFullSha(sha, "object SHA");
  return validateGitHubEndpoint(
    `https://api.github.com/repos/${request.repository}/git/${kind}/${sha}`,
  );
};
