import { createHash } from "node:crypto";

export interface GitTreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
}
export interface GitTreeResponse {
  readonly sha: string;
  readonly truncated: boolean;
  readonly tree: readonly GitTreeEntry[];
}
export interface WalkResult {
  readonly selectedBlobs: readonly { readonly path: string; readonly sha: string }[];
  readonly visitedObjectShas: readonly string[];
}
export interface TreeWalkOptions {
  readonly approvedSubtree: string;
  readonly rootTreeSha: string;
  readonly loadTree: (sha: string) => Promise<GitTreeResponse>;
  readonly loadBlob: (sha: string) => Promise<Uint8Array>;
  readonly checkpoint: (state: WalkResult) => void;
}
export class TreeWalkError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "TreeWalkError";
  }
}

const FULL_SHA = /^[0-9a-f]{40}$/u;
const ENTRY_NAME = /^(?!\.{1,2}$)[^/\\\0]+$/u;
const MAX_TREE_ENTRIES = 10_000;
const MAX_SELECTED_BLOBS = 200;

const fail = (code: string): never => {
  throw new TreeWalkError(code);
};

const gitObjectSha = (type: "blob" | "tree", bytes: Uint8Array): string =>
  createHash("sha1").update(`${type} ${bytes.byteLength}\0`).update(bytes).digest("hex");

const treeIdentity = (entries: readonly GitTreeEntry[]): string => {
  const encoded = entries
    .map((entry) => ({
      entry,
      sortName: entry.type === "tree" ? `${entry.path}/` : entry.path,
    }))
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sortName), Buffer.from(right.sortName)))
    .map(({ entry }) => Buffer.concat([
      Buffer.from(`${entry.mode === "040000" ? "40000" : entry.mode} ${entry.path}\0`),
      Buffer.from(entry.sha, "hex"),
    ]));
  return gitObjectSha("tree", Buffer.concat(encoded));
};

const validateEntry = (entry: unknown): asserts entry is GitTreeEntry => {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    fail("MALFORMED_TREE_ENTRY");
  }
  const candidate = entry as Record<string, unknown>;
  if (
    typeof candidate.path !== "string"
    || typeof candidate.mode !== "string"
    || typeof candidate.type !== "string"
    || typeof candidate.sha !== "string"
  ) {
    fail("MALFORMED_TREE_ENTRY");
  }
  const typedEntry = candidate as unknown as GitTreeEntry;
  if (!ENTRY_NAME.test(typedEntry.path) || !FULL_SHA.test(typedEntry.sha)) {
    fail("MALFORMED_TREE_ENTRY");
  }
  if (typedEntry.mode === "120000") fail("SYMLINK_REJECTED");
  if (typedEntry.mode === "160000" || typedEntry.type === "commit") fail("SUBMODULE_REJECTED");
  const regularBlob =
    typedEntry.type === "blob"
    && (typedEntry.mode === "100644" || typedEntry.mode === "100755");
  const directory = typedEntry.type === "tree" && typedEntry.mode === "040000";
  if (!regularBlob && !directory) fail("MALFORMED_TREE_ENTRY");
};

const validateTreeResponse: (
  response: unknown,
) => asserts response is GitTreeResponse = (response) => {
  if (
    response === null
    || typeof response !== "object"
    || typeof (response as GitTreeResponse).sha !== "string"
    || typeof (response as GitTreeResponse).truncated !== "boolean"
    || !Array.isArray((response as GitTreeResponse).tree)
  ) {
    fail("MALFORMED_TREE_RESPONSE");
  }
};

const snapshot = (
  selectedBlobs: WalkResult["selectedBlobs"],
  visitedObjectShas: WalkResult["visitedObjectShas"],
): WalkResult => Object.freeze({
  selectedBlobs: Object.freeze([...selectedBlobs]),
  visitedObjectShas: Object.freeze([...visitedObjectShas]),
});

type PendingObject =
  | { readonly kind: "tree"; readonly path: string; readonly sha: string }
  | { readonly kind: "blob"; readonly path: string; readonly sha: string };

interface WalkState {
  readonly pending: PendingObject[];
  readonly selectedBlobs: Array<{ readonly path: string; readonly sha: string }>;
  readonly visitedObjectShas: string[];
  traversedEntries: number;
  scheduledBlobs: number;
}

const recordProgress = (options: TreeWalkOptions, state: WalkState, sha: string): void => {
  state.visitedObjectShas.push(sha);
  options.checkpoint(snapshot(state.selectedBlobs, state.visitedObjectShas));
};

const visitBlob = async (
  options: TreeWalkOptions,
  state: WalkState,
  object: Extract<PendingObject, { kind: "blob" }>,
): Promise<void> => {
  const bytes = await options.loadBlob(object.sha);
  if (gitObjectSha("blob", bytes) !== object.sha) fail("BLOB_IDENTITY_MISMATCH");
  state.selectedBlobs.push({ path: object.path, sha: object.sha });
  recordProgress(options, state, object.sha);
};

const visitTree = async (
  options: TreeWalkOptions,
  state: WalkState,
  object: Extract<PendingObject, { kind: "tree" }>,
): Promise<void> => {
  const response = await options.loadTree(object.sha);
  validateTreeResponse(response);
  if (response.sha !== object.sha) fail("TREE_IDENTITY_MISMATCH");
  if (response.truncated) fail("TRUNCATED_TREE");
  state.traversedEntries += response.tree.length;
  if (state.traversedEntries > MAX_TREE_ENTRIES) fail("TREE_ENTRY_LIMIT");
  response.tree.forEach((entry: unknown) => validateEntry(entry));
  const names = response.tree.map(({ path }) => path);
  if (new Set(names).size !== names.length) fail("DUPLICATE_TREE_ENTRY");
  state.scheduledBlobs += response.tree.filter(({ type }) => type === "blob").length;
  if (state.scheduledBlobs > MAX_SELECTED_BLOBS) fail("SELECTED_BLOB_LIMIT");
  if (treeIdentity(response.tree) !== object.sha) fail("TREE_IDENTITY_MISMATCH");
  recordProgress(options, state, object.sha);
  for (const entry of [...response.tree].reverse()) {
    state.pending.push({
      kind: entry.type as "tree" | "blob",
      path: `${object.path}/${entry.path}`,
      sha: entry.sha,
    });
  }
};

export const walkApprovedTree = async (
  options: TreeWalkOptions,
): Promise<WalkResult> => {
  if (!FULL_SHA.test(options.rootTreeSha)) fail("MALFORMED_ROOT_TREE");
  const state: WalkState = {
    pending: [{ kind: "tree", path: options.approvedSubtree, sha: options.rootTreeSha }],
    selectedBlobs: [],
    visitedObjectShas: [],
    traversedEntries: 0,
    scheduledBlobs: 0,
  };
  while (state.pending.length > 0) {
    const object = state.pending.pop();
    if (object === undefined) break;
    if (object.kind === "blob") {
      await visitBlob(options, state, object);
      continue;
    }
    await visitTree(options, state, object);
  }
  return snapshot(state.selectedBlobs, state.visitedObjectShas);
};
