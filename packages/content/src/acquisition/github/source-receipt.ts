import { canonicalSha256 } from "../policy/policy-register";
import type { AcquisitionRequest } from "./request";

type Json = Record<string, unknown>;
const H40 = /^[0-9a-f]{40}$/u;
const REPOSITORY =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/u;
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 16_384;
const record = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Json : undefined;

export class SourceReceiptError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "SourceReceiptError";
  }
}
const fail = (code: string): never => {
  throw new SourceReceiptError(code);
};
const identity = (
  gitIdentity: unknown,
  account: unknown,
): { readonly name: string; readonly login: string; readonly type: "User" | "Bot" } => {
  const git = record(gitIdentity);
  const user = record(account);
  const name = git?.name;
  const login = user?.login;
  const type = user?.type;
  if (
    !nonempty(name)
    || !nonempty(login)
    || !nonempty(type)
    || !["User", "Bot"].includes(type)
  ) fail("COMMIT_SOURCE_REJECTED");
  return Object.freeze({
    name: name as string,
    login: login as string,
    type: type as "User" | "Bot",
  });
};

export const parseChildCommitSource = (
  raw: unknown,
  request: AcquisitionRequest,
) => {
  const source = record(raw);
  const commit = record(source?.commit);
  const tree = record(commit?.tree);
  const verification = record(commit?.verification);
  const parents = Array.isArray(source?.parents) ? source.parents : [];
  const parent = parents.length === 1 ? record(parents[0]) : undefined;
  const parentSha = parent?.sha;
  if (
    source?.sha !== request.commit
    || parent === undefined
    || !H40.test(parentSha as string)
    || !H40.test(tree?.sha as string)
    || !nonempty(commit?.message)
    || typeof verification?.verified !== "boolean"
    || !nonempty(verification.reason)
  ) fail("COMMIT_SOURCE_REJECTED");
  return Object.freeze({
    parentSha: parentSha as string,
    childTreeSha: tree?.sha as string,
    commit: Object.freeze({
      author: identity(commit?.author, source?.author),
      committer: identity(commit?.committer, source?.committer),
      verification: Object.freeze({
        verified: verification?.verified as boolean,
        reason: verification?.reason as string,
      }),
      message: commit?.message as string,
    }),
  });
};

export const parseParentCommitSource = (
  raw: unknown,
  expectedParentSha: string,
): { readonly parentTreeSha: string } => {
  const source = record(raw);
  const tree = record(record(source?.commit)?.tree);
  if (source?.sha !== expectedParentSha || !H40.test(tree?.sha as string)) {
    fail("PARENT_SOURCE_REJECTED");
  }
  return Object.freeze({ parentTreeSha: tree?.sha as string });
};

export const parseRepositorySource = (
  raw: unknown,
  request: AcquisitionRequest,
) => {
  const source = record(raw);
  const licence = record(source?.license);
  const repositoryId = source?.node_id;
  const repository = source?.full_name;
  if (
    !nonempty(repositoryId)
    || typeof repository !== "string"
    || !REPOSITORY.test(repository)
    || repository.toLowerCase() !== request.repository
    || source?.private !== false
    || source?.visibility !== "public"
    || source?.archived !== false
    || source?.disabled !== false
    || !nonempty(licence?.spdx_id)
  ) fail("REPOSITORY_SOURCE_REJECTED");
  const acceptedRepositoryId = repositoryId as string;
  const licenseIdentifier = licence?.spdx_id as string;
  const metadata = {
    repositoryId: acceptedRepositoryId,
    repository: request.repository,
    visibility: "public",
    archived: false,
    disabled: false,
    licenseIdentifier,
  };
  return Object.freeze({
    repositoryId: acceptedRepositoryId,
    repositoryMetadataHash: canonicalSha256(metadata),
    licenseIdentifier,
  });
};
