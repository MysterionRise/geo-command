import { createHash } from "node:crypto";

import { validateAcquisitionRequest } from "./request";
import { BoundedGitHubTransport, GitHubRateLimitPause } from "./transport";
import { GitHubObjectAdapter, GitHubObjectAdapterError } from "./object-adapter";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const request = validateAcquisitionRequest({
  repository: "owner/repo",
  commit: "a".repeat(40),
  subtree: "src",
  purpose: "LANGUAGE_CANDIDATE",
  observationTime: "2026-07-27T20:00:00Z",
}, {
  repository: "owner/repo",
  subtree: "src",
  purpose: "LANGUAGE_CANDIDATE",
});
const blob = new TextEncoder().encode("export const answer = 42;\n");
const blobSha = createHash("sha1")
  .update(`blob ${blob.byteLength}\0`).update(blob).digest("hex");
const treeSha = "b".repeat(40);

describe("bounded GitHub object adapter", () => {
  it("loads exact non-recursive tree and base64 blob endpoints", async () => {
    const urls: string[] = [];
    const adapter = new GitHubObjectAdapter({
      request,
      transport: new BoundedGitHubTransport({
        fetch: async (incoming) => {
          urls.push(incoming.url);
          if (incoming.url.endsWith(`/git/trees/${treeSha}`)) {
            return new Response(JSON.stringify({
              sha: treeSha,
              truncated: false,
              tree: [{ path: "answer.ts", mode: "100644", type: "blob", sha: blobSha }],
            }));
          }
          return new Response(JSON.stringify({
            sha: blobSha,
            encoding: "base64",
            size: blob.byteLength,
            content: `${Buffer.from(blob).toString("base64").slice(0, 12)}\n${
              Buffer.from(blob).toString("base64").slice(12)}`,
          }));
        },
      }),
    });
    expect(await adapter.loadTree(treeSha)).toEqual({
      sha: treeSha,
      truncated: false,
      tree: [{ path: "answer.ts", mode: "100644", type: "blob", sha: blobSha }],
    });
    expect(await adapter.loadBlob(blobSha)).toEqual(blob);
    expect(urls).toEqual([
      `https://api.github.com/repos/owner/repo/git/trees/${treeSha}`,
      `https://api.github.com/repos/owner/repo/git/blobs/${blobSha}`,
    ]);
  });

  it("rejects mismatched identities and malformed base64 categorically", async () => {
    for (const data of [
      { sha: "c".repeat(40), truncated: false, tree: [] },
      { sha: treeSha, truncated: "false", tree: [] },
      { sha: treeSha, truncated: false, tree: "not-an-array" },
    ]) {
      const adapter = new GitHubObjectAdapter({
        request,
        transport: new BoundedGitHubTransport({
          fetch: async () => new Response(JSON.stringify(data)),
        }),
      });
      await expect(adapter.loadTree(treeSha)).rejects.toThrow(GitHubObjectAdapterError);
    }
    for (const data of [
      { sha: "c".repeat(40), encoding: "base64", size: 1, content: "YQ==" },
      { sha: blobSha, encoding: "utf-8", size: blob.byteLength, content: "code" },
      { sha: blobSha, encoding: "base64", size: 999, content: "YQ==" },
      { sha: blobSha, encoding: "base64", size: 1, content: "not!base64" },
    ]) {
      const adapter = new GitHubObjectAdapter({
        request,
        transport: new BoundedGitHubTransport({
          fetch: async () => new Response(JSON.stringify(data)),
        }),
      });
      const error = await adapter.loadBlob(blobSha).catch((failure) => failure);
      expect(error).toBeInstanceOf(GitHubObjectAdapterError);
      expect(error.message).toBe("BLOB_RESPONSE_REJECTED");
    }
  });

  it("preserves a validated rate-limit pause from tree and blob requests", async () => {
    for (const load of ["tree", "blob"] as const) {
      const adapter = new GitHubObjectAdapter({
        request,
        transport: new BoundedGitHubTransport({
          fetch: async () => new Response(null, {
            status: 429,
            headers: { "retry-after": "60" },
          }),
          now: () => 1_000,
        }),
      });
      const error = await (load === "tree"
        ? adapter.loadTree(treeSha)
        : adapter.loadBlob(blobSha)).catch((failure) => failure);
      expect(error).toBeInstanceOf(GitHubRateLimitPause);
      expect(error.resumeAfterEpochMs).toBe(61_000);
    }
  });
});
