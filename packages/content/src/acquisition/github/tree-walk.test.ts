import * as nodeCrypto from "node:crypto";

import {
  TreeWalkError,
  walkApprovedTree,
  type GitTreeEntry,
} from "./tree-walk";

const testModuleName: string = "vitest";
interface Expectation {
  readonly rejects: {
    toBeInstanceOf(expected: unknown): Promise<void>;
    toThrow(expected?: unknown): Promise<void>;
  };
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
}
interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => Expectation;
  readonly it: (name: string, callback: () => unknown) => void;
}
const { describe, expect, it } = (await import(testModuleName)) as TestApi;

const blobSha = (bytes: Uint8Array): string =>
  nodeCrypto.createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");

const treeSha = (entries: readonly GitTreeEntry[]): string => {
  const body = entries
    .map((entry) => ({
      entry,
      sortName: entry.type === "tree" ? `${entry.path}/` : entry.path,
    }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.sortName), Buffer.from(right.sortName)))
    .map(({ entry }) => Buffer.concat([
      Buffer.from(`${entry.mode === "040000" ? "40000" : entry.mode} ${entry.path}\0`),
      Buffer.from(entry.sha, "hex"),
    ]));
  const bytes = Buffer.concat(body);
  return nodeCrypto.createHash("sha1").update(`tree ${bytes.byteLength}\0`).update(bytes).digest("hex");
};

const regular = (path: string, sha: string): GitTreeEntry =>
  ({ path, mode: "100644", type: "blob", sha });

describe("immutable approved-subtree walk", () => {
  it("verifies nested Git objects and checkpoints every object deterministically", async () => {
    const first = new TextEncoder().encode("first");
    const second = new TextEncoder().encode("second");
    const nestedEntries = [regular("two.ts", blobSha(second))] as const;
    const nestedSha = treeSha(nestedEntries);
    const rootEntries = [
      regular("one.ts", blobSha(first)),
      { path: "nested", mode: "040000", type: "tree", sha: nestedSha },
    ] as const;
    const rootSha = treeSha(rootEntries);
    const trees = new Map([
      [rootSha, { sha: rootSha, truncated: false, tree: rootEntries }],
      [nestedSha, { sha: nestedSha, truncated: false, tree: nestedEntries }],
    ]);
    const blobs = new Map([[blobSha(first), first], [blobSha(second), second]]);
    const checkpoints: unknown[] = [];
    const result = await walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: rootSha,
      loadTree: async (sha) => trees.get(sha)!,
      loadBlob: async (sha) => blobs.get(sha)!,
      checkpoint: (state) => { checkpoints.push(state); },
    });
    expect(result.selectedBlobs.map(({ path }) => path)).toEqual([
      "src/one.ts",
      "src/nested/two.ts",
    ]);
    expect(result.visitedObjectShas).toEqual([
      rootSha,
      blobSha(first),
      nestedSha,
      blobSha(second),
    ]);
    expect(checkpoints).toHaveLength(4);
    expect(checkpoints.at(-1)).toEqual(result);
  });

  it("rejects every truncated tree response", async () => {
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async (sha) => ({ sha, truncated: true, tree: [] }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("TRUNCATED_TREE");
  });

  it("rejects a tree identity mismatch", async () => {
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async (sha) => ({ sha, truncated: false, tree: [] }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("TREE_IDENTITY_MISMATCH");
  });

  it("rejects a blob identity mismatch", async () => {
    const entries = [regular("one.ts", "a".repeat(40))];
    const rootTreeSha = treeSha(entries);
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha,
      loadTree: async (sha) => ({ sha, truncated: false, tree: entries }),
      loadBlob: async () => new TextEncoder().encode("different"),
      checkpoint: () => undefined,
    })).rejects.toThrow("BLOB_IDENTITY_MISMATCH");
  });

  it("rejects symbolic links, submodules, and malformed or escaping entries", async () => {
    const cases: readonly GitTreeEntry[][] = [
      [{ path: "link", mode: "120000", type: "blob", sha: "a".repeat(40) }],
      [{ path: "module", mode: "160000", type: "commit", sha: "a".repeat(40) }],
      [{ path: "../escape", mode: "100644", type: "blob", sha: "a".repeat(40) }],
      [{ path: "nested/file", mode: "100644", type: "blob", sha: "a".repeat(40) }],
      [{ path: "bad", mode: "100644", type: "blob", sha: "not-a-sha" }],
      [{ path: "bad", mode: "100644", type: "tree", sha: "a".repeat(40) }],
    ];
    for (const entries of cases) {
      await expect(walkApprovedTree({
        approvedSubtree: "src",
        rootTreeSha: treeSha(entries),
        loadTree: async (sha) => ({ sha, truncated: false, tree: entries }),
        loadBlob: async () => new Uint8Array(),
        checkpoint: () => undefined,
      })).rejects.toThrow();
    }
  });

  it("rejects duplicate entries", async () => {
    const entries = [regular("same.ts", "a".repeat(40)), regular("same.ts", "b".repeat(40))];
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: treeSha(entries),
      loadTree: async (sha) => ({ sha, truncated: false, tree: entries }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("DUPLICATE_TREE_ENTRY");
  });

  it("rejects a non-object entry with a non-sensitive tree-walk error", async () => {
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async (sha) => ({
        sha,
        truncated: false,
        tree: [null] as never,
      }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toBeInstanceOf(TreeWalkError);
  });

  it("rejects more than 10,000 traversed entries", async () => {
    const entries = Array.from({ length: 10_001 }, (_, index) =>
      regular(`file-${index}.ts`, "a".repeat(40)));
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async (sha) => ({ sha, truncated: false, tree: entries }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("TREE_ENTRY_LIMIT");
  });

  it("rejects selection of more than 200 blobs", async () => {
    const entries = Array.from({ length: 201 }, (_, index) =>
      regular(`file-${index}.ts`, "a".repeat(40)));
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: treeSha(entries),
      loadTree: async (sha) => ({ sha, truncated: false, tree: entries }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("SELECTED_BLOB_LIMIT");
  });

  it("counts blobs already queued when nested trees add more selections", async () => {
    const nestedEntries = Array.from({ length: 100 }, (_, index) =>
      regular(`nested-${index}.ts`, "a".repeat(40)));
    const nestedSha = treeSha(nestedEntries);
    const rootEntries: GitTreeEntry[] = [
      { path: "nested", mode: "040000", type: "tree", sha: nestedSha },
      ...Array.from({ length: 150 }, (_, index) =>
        regular(`root-${index}.ts`, "b".repeat(40))),
    ];
    const rootSha = treeSha(rootEntries);
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: rootSha,
      loadTree: async (sha) => sha === rootSha
        ? { sha, truncated: false, tree: rootEntries }
        : { sha, truncated: false, tree: nestedEntries },
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toThrow("SELECTED_BLOB_LIMIT");
  });

  it("rejects a malformed tree response without leaking a TypeError", async () => {
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async () => null as never,
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toBeInstanceOf(TreeWalkError);
  });

  it("uses a specific tree-walk error", async () => {
    await expect(walkApprovedTree({
      approvedSubtree: "src",
      rootTreeSha: "a".repeat(40),
      loadTree: async (sha) => ({ sha, truncated: true, tree: [] }),
      loadBlob: async () => new Uint8Array(),
      checkpoint: () => undefined,
    })).rejects.toBeInstanceOf(TreeWalkError);
  });
});
