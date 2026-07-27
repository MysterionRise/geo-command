import { buildGitObjectEndpoint, type AcquisitionRequest } from "./request";
import { BoundedGitHubTransport } from "./transport";
import type { GitTreeEntry, GitTreeResponse } from "./tree-walk";

type Json = Record<string, unknown>;
const H40 = /^[0-9a-f]{40}$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export class GitHubObjectAdapterError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "GitHubObjectAdapterError";
  }
}
const fail = (code: string): never => {
  throw new GitHubObjectAdapterError(code);
};
const record = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Json : undefined;

const treeEntry = (raw: unknown): GitTreeEntry => {
  const input = record(raw);
  const path = input?.path;
  const mode = input?.mode;
  const type = input?.type;
  const sha = input?.sha;
  if (
    typeof path !== "string"
    || typeof mode !== "string"
    || typeof type !== "string"
    || typeof sha !== "string"
    || !H40.test(sha)
  ) fail("TREE_RESPONSE_REJECTED");
  return Object.freeze({
    path: path as string,
    mode: mode as string,
    type: type as string,
    sha: sha as string,
  });
};

const parseTree = (raw: unknown, expectedSha: string): GitTreeResponse => {
  const input = record(raw);
  const truncated = input?.truncated;
  const entries = input?.tree;
  if (
    input?.sha !== expectedSha
    || typeof truncated !== "boolean"
    || !Array.isArray(entries)
  ) fail("TREE_RESPONSE_REJECTED");
  return Object.freeze({
    sha: expectedSha,
    truncated: truncated as boolean,
    tree: Object.freeze((entries as unknown[]).map(treeEntry)),
  });
};

const parseBlob = (raw: unknown, expectedSha: string): Uint8Array => {
  const input = record(raw);
  const content = typeof input?.content === "string"
    ? input.content.replace(/\s/gu, "") : fail("BLOB_RESPONSE_REJECTED");
  const size = input?.size;
  if (
    input?.sha !== expectedSha
    || input.encoding !== "base64"
    || !Number.isSafeInteger(size)
    || (size as number) < 0
    || !BASE64.test(content)
  ) fail("BLOB_RESPONSE_REJECTED");
  const decoded = Buffer.from(content, "base64");
  if (
    decoded.byteLength !== size
    || decoded.toString("base64") !== content
  ) fail("BLOB_RESPONSE_REJECTED");
  return new Uint8Array(decoded);
};

export class GitHubObjectAdapter {
  readonly #request: AcquisitionRequest;
  readonly #transport: BoundedGitHubTransport;

  public constructor(input: {
    readonly request: AcquisitionRequest;
    readonly transport: BoundedGitHubTransport;
  }) {
    this.#request = input.request;
    this.#transport = input.transport;
  }

  public async loadTree(sha: string): Promise<GitTreeResponse> {
    try {
      return parseTree(
        await this.#transport.requestJson(
          buildGitObjectEndpoint(this.#request, "trees", sha),
        ),
        sha,
      );
    } catch (error) {
      if (error instanceof GitHubObjectAdapterError) throw error;
      return fail("TREE_RESPONSE_REJECTED");
    }
  }

  public async loadBlob(sha: string): Promise<Uint8Array> {
    try {
      return parseBlob(
        await this.#transport.requestJson(
          buildGitObjectEndpoint(this.#request, "blobs", sha),
        ),
        sha,
      );
    } catch (error) {
      if (error instanceof GitHubObjectAdapterError) throw error;
      return fail("BLOB_RESPONSE_REJECTED");
    }
  }
}
