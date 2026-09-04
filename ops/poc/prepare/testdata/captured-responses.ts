import { createHash } from "node:crypto";

import type { CrawlProfile } from "../profile";
import type { SelectedStackBlob } from "../stack-revalidation";
import type { StackMetadataRow } from "../stack-metadata";
import { CAPTURED_AUTHOR_EMAIL } from "./captured-values";

type JsonValue = Readonly<Record<string, unknown>>;
type TreeEntry = Readonly<{ path: string; mode: "100644"; type: "blob"; sha: string }>;

export interface CapturedResponses {
  readonly http: ReadonlyMap<string, JsonValue | string>;
  readonly metadata: Readonly<Record<"Python" | "TypeScript", StackMetadataRow>>;
  readonly selectedBlobs: ReadonlyMap<string, SelectedStackBlob>;
}

const REVISION = "e565caa3a78c2423bd374333a472b049eb090e47";
const LICENSE_BYTES = Buffer.from("MIT License\n\nPermission is hereby granted.\n");
const digest = (algorithm: "sha1" | "sha256", value: Uint8Array | string): string =>
  createHash(algorithm).update(value).digest("hex");
const gitObject = (kind: "blob" | "tree", bytes: Uint8Array): string => createHash("sha1")
  .update(`${kind} ${bytes.byteLength}\0`).update(bytes).digest("hex");
const gitBlob = (bytes: Uint8Array): string => gitObject("blob", bytes);
const treeId = (entries: readonly TreeEntry[]): string => {
  const parts = [...entries].sort((left, right) => left.path.localeCompare(right.path)).map((entry) =>
    Buffer.concat([Buffer.from(`${entry.mode} ${entry.path}\0`), Buffer.from(entry.sha, "hex")]));
  return gitObject("tree", Buffer.concat(parts));
};
const encodedPath = (value: string): string => value.split("/").map(encodeURIComponent).join("/");

const repositoryResponse = (repository: string): JsonValue => {
  const api = `https://api.github.com/repos/${repository}`;
  return {
    full_name: repository, url: api, html_url: `https://github.com/${repository}`,
    private: false, visibility: "public", disabled: false, archived: false, fork: false,
    license: { key: "mit", name: "MIT License", spdx_id: "MIT", url: "https://api.github.com/licenses/mit" },
  };
};
const author = (index: number) => ({
  login: `capture-author-${index}`, url: `https://api.github.com/users/capture-author-${index}`,
  html_url: `https://github.com/capture-author-${index}`,
});
const licenseResponse = (repository: string, commit: string): JsonValue => {
  const api = `https://api.github.com/repos/${repository}`;
  const web = `https://github.com/${repository}`;
  const blob = gitBlob(LICENSE_BYTES);
  return {
    name: "LICENSE", path: "LICENSE", sha: blob, size: LICENSE_BYTES.byteLength,
    url: `${api}/contents/LICENSE?ref=${commit}`, html_url: `${web}/blob/${commit}/LICENSE`,
    git_url: `${api}/git/blobs/${blob}`,
    download_url: `https://raw.githubusercontent.com/${repository}/${commit}/LICENSE`,
    type: "file", encoding: "base64", content: LICENSE_BYTES.toString("base64"),
    license: { key: "mit", name: "MIT License", spdx_id: "MIT", url: "https://api.github.com/licenses/mit" },
  };
};
const treeResponse = (api: string, identity: string, entries: readonly TreeEntry[]): JsonValue => ({
  sha: identity, url: `${api}/git/trees/${identity}`, truncated: false,
  tree: entries.map((entry) => ({ ...entry, url: `${api}/git/blobs/${entry.sha}` })),
});
const blobResponse = (api: string, identity: string, bytes: Uint8Array): JsonValue => ({
  sha: identity, url: `${api}/git/blobs/${identity}`, encoding: "base64",
  size: bytes.byteLength, content: Buffer.from(bytes).toString("base64"),
});

const addProvenance = (
  http: Map<string, JsonValue | string>, index: number, message: string,
): Readonly<{ repository: string; commit: string }> => {
  const repository = `capture/provenance-${index}`;
  const api = `https://api.github.com/repos/${repository}`;
  const web = `https://github.com/${repository}`;
  const commit = `${index + 4}`.repeat(40);
  const parentCommit = `${index + 1}`.repeat(40);
  const path = `round-${index}.ts`;
  const sourceLines = [
    "export function capturedValue(): number {", "  const scale = 2;",
    `  const base = ${index + 1};`, "  const offset = 3;", "  const adjusted = base + offset;",
    "  return adjusted * scale;", "}", `export const capturedIndex = ${index};`, "",
  ];
  const childLines = [...sourceLines];
  childLines[2] = `  const base = ${index + 11};`;
  const parentBytes = Buffer.from(sourceLines.join("\n"));
  const childBytes = Buffer.from(childLines.join("\n"));
  const parentBlob = gitBlob(parentBytes);
  const childBlob = gitBlob(childBytes);
  const parentEntries: TreeEntry[] = [{ path, mode: "100644", type: "blob", sha: parentBlob }];
  const childEntries: TreeEntry[] = [{ path, mode: "100644", type: "blob", sha: childBlob }];
  const parentTree = treeId(parentEntries);
  const childTree = treeId(childEntries);
  http.set(api, repositoryResponse(repository));
  http.set(`${api}/commits/${commit}`, {
    sha: commit, url: `${api}/commits/${commit}`, html_url: `${web}/commit/${commit}`,
    commit: { message, tree: { sha: childTree, url: `${api}/git/trees/${childTree}` },
      author: { name: `Capture Author ${index}`, email: CAPTURED_AUTHOR_EMAIL } },
    author: author(index), parents: [{ sha: parentCommit, url: `${api}/commits/${parentCommit}`,
      html_url: `${web}/commit/${parentCommit}` }],
    files: [{ sha: childBlob, filename: path, status: "modified",
      blob_url: `${web}/blob/${commit}/${path}`, raw_url: `${web}/raw/${commit}/${path}`,
      contents_url: `${api}/contents/${path}?ref=${commit}` }],
  });
  http.set(`${api}/commits/${parentCommit}`, {
    sha: parentCommit, url: `${api}/commits/${parentCommit}`, html_url: `${web}/commit/${parentCommit}`,
    commit: { message: "Parent capture", tree: { sha: parentTree, url: `${api}/git/trees/${parentTree}` } },
    parents: [], files: [],
  });
  http.set(`${api}/git/trees/${childTree}`, treeResponse(api, childTree, childEntries));
  http.set(`${api}/git/trees/${parentTree}`, treeResponse(api, parentTree, parentEntries));
  http.set(`${api}/git/blobs/${childBlob}`, blobResponse(api, childBlob, childBytes));
  http.set(`${api}/git/blobs/${parentBlob}`, blobResponse(api, parentBlob, parentBytes));
  http.set(`${api}/license?ref=${commit}`, licenseResponse(repository, commit));
  return Object.freeze({ repository, commit });
};

const metadataRow = (
  repository: string, commit: string, path: string, language: "Python" | "TypeScript", bytes: Buffer,
): StackMetadataRow => {
  const fields = {
    swhBlobId: digest("sha1", bytes), swhContentId: gitBlob(bytes),
    swhDirectoryId: digest("sha1", `${repository}:directory`),
    swhSnapshotId: digest("sha1", `${repository}:snapshot`), swhRevisionId: commit,
    repository, path, detectedLicenses: ["MIT"], detectedLanguage: language,
    generated: false, vendor: false, sourceEncoding: "UTF-8", byteLength: bytes.byteLength,
    visitDate: "2023-09-06T10:44:38Z", revisionDate: "2023-09-05T09:30:00Z",
    committerDate: "2023-09-05T09:30:00Z",
  } as const;
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(fields).sort()));
  return Object.freeze({ stableRowId: digest("sha256", canonical), ...fields });
};
const addLanguage = (
  http: Map<string, JsonValue | string>, index: number, language: "Python" | "TypeScript",
  path: string, bytes: Buffer,
): Readonly<{ row: StackMetadataRow; selected: SelectedStackBlob }> => {
  const repository = `capture/language-${index}`;
  const api = `https://api.github.com/repos/${repository}`;
  const web = `https://github.com/${repository}`;
  const commit = `${index + 8}`.repeat(40);
  const blob = gitBlob(bytes);
  const entries: TreeEntry[] = [{ path, mode: "100644", type: "blob", sha: blob }];
  const tree = treeId(entries);
  http.set(api, repositoryResponse(repository));
  http.set(`${api}/commits/${commit}`, {
    sha: commit, url: `${api}/commits/${commit}`, html_url: `${web}/commit/${commit}`,
    commit: { tree: { sha: tree, url: `${api}/git/trees/${tree}` },
      author: { name: `Capture Author ${index + 3}`, email: CAPTURED_AUTHOR_EMAIL } },
    author: author(index + 3),
  });
  http.set(`${api}/git/trees/${tree}`, treeResponse(api, tree, entries));
  http.set(`${api}/git/blobs/${blob}`, blobResponse(api, blob, bytes));
  http.set(`${api}/license?ref=${commit}`, licenseResponse(repository, commit));
  const row = metadataRow(repository, commit, path, language, bytes);
  return Object.freeze({ row, selected: Object.freeze({ stableRowId: row.stableRowId,
    swhBlobId: row.swhBlobId, contentBase64: bytes.toString("base64"), byteLength: bytes.byteLength }) });
};

const stackCard = (): string => [
  "The Stack v2 is regularly updated to enact validated data removal requests.",
  "Use the most recent usable version.",
  "I have read the License and agree with its terms: checkbox",
  "### Changelog", "Release  | Description", "--- | ---", "v2.2.0  | Captured current release.", "",
].join("\n");

export const createCapturedResponses = (
  profile: CrawlProfile,
  providerIncompleteQueryId?: string,
): CapturedResponses => {
  const http = new Map<string, JsonValue | string>();
  http.set("https://huggingface.co/api/datasets/bigcode/the-stack-v2/revision/e565caa3a78c2423bd374333a472b049eb090e47", {
    id: "bigcode/the-stack-v2", sha: REVISION, private: false, disabled: false, gated: "auto",
    cardData: { extra_gated_prompt: "The Stack v2 is regularly updated to enact validated data removal requests. Use the most recent usable version.",
      extra_gated_fields: { Email: "text", "I have read the License and agree with its terms": "checkbox" } },
    siblings: [{ rfilename: "README.md" }],
  });
  http.set("https://huggingface.co/datasets/bigcode/the-stack-v2/raw/main/README.md", stackCard());
  const messages = [profile.markers[0]!, profile.markers[1]!, "Ordinary captured refactor"];
  messages.forEach((message, index) => {
    const source = addProvenance(http, index, message);
    const query = profile.github.queries[index]!;
    const url = new URL("https://api.github.com/search/commits");
    Object.entries({ q: query.query, sort: query.sort, order: query.order, page: "1", per_page: "100" })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    http.set(url.href, { total_count: 1, incomplete_results: query.id === providerIncompleteQueryId, items: [{
      sha: source.commit, url: `https://api.github.com/repos/${source.repository}/commits/${source.commit}`,
      html_url: `https://github.com/${source.repository}/commit/${source.commit}`,
      commit: { committer: { date: `2026-07-${30 - index}T10:00:00Z` } },
      repository: { full_name: source.repository, url: `https://api.github.com/repos/${source.repository}`,
        html_url: `https://github.com/${source.repository}` },
    }] });
  });
  const pythonBytes = Buffer.from(Array.from({ length: 160 }, (_, index) => [
    `def captured_${index}(value):`, `    adjusted = value + ${index + 7}`,
    "    return adjusted * 2", "",
  ].join("\n")).join("\n"));
  const typeScriptBytes = Buffer.from(Array.from({ length: 100 }, (_, index) => [
    `export function captured${index}(value: number): number {`,
    `  const adjusted = value + ${index + 9};`, "  return adjusted * 3;", "}", "",
  ].join("\n")).join("\n"));
  const python = addLanguage(http, 0, "Python", "captured.py", pythonBytes);
  const typeScript = addLanguage(http, 1, "TypeScript", "captured.ts", typeScriptBytes);
  return Object.freeze({ http, metadata: Object.freeze({ Python: python.row, TypeScript: typeScript.row }),
    selectedBlobs: new Map([[python.row.stableRowId, python.selected], [typeScript.row.stableRowId, typeScript.selected]]) });
};
