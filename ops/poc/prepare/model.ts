import {
  bool,
  codeText,
  count,
  deepFreeze,
  exact,
  fail,
  gitId,
  gitMode,
  positiveCount,
  record,
  sha256,
  text,
  texts,
  validUtcTimestamp,
  type RecordValue,
} from "./model-validation";

export { ExperimentRecordError } from "./model-validation";
export {
  parsePrivateReveal,
  parsePublicRound,
  parseRoundRecordSet,
  type PrivateRevealRecord,
  type PublicRoundRecord,
  type RoundRecordSet,
} from "./model-rounds";
export { parseRunRecord, type RunRecord } from "./model-run";

const EXPERIMENT_ROUND_COUNT = 5;
const PROVENANCE_ROUND_COUNT = 3;

export interface ExperimentFixture {
  readonly kind: "PROVENANCE" | "LANGUAGE";
  readonly roundId: string;
  readonly roundVersion: string;
  readonly excerpt: string;
  readonly prompt: string;
  readonly candidates: readonly Readonly<{ id: string; label: string }>[];
  readonly clues: readonly string[];
  readonly correctCandidateId: string;
  readonly evidence: string;
  readonly explanation: string;
  readonly attribution: string;
  readonly helpfulSignals: readonly string[];
  readonly misleadingSignals: readonly string[];
  readonly source: Readonly<RecordValue>;
}

export interface ExperimentArtifact {
  readonly schemaVersion: "local-experiment-artifact.v1";
  readonly contentClass: "LOCAL_UNREVIEWED_EXPERIMENT";
  readonly profileHash: string;
  readonly crawlSnapshot: Readonly<RecordValue>;
  readonly fixtures: readonly ExperimentFixture[];
}

const BASE_SOURCE_KEYS = [
  "discoverySource", "repository", "repositoryUrl", "authorName", "authorLogin",
  "authorBasis", "authorSourceUrl", "path", "blob", "rawContentHash", "excerptHash",
  "licenseName", "licenseSpdx", "licenseFileUrl", "commit", "commitUrl", "blobUrl",
  "profileVersion", "crawlSnapshotId",
] as const;
const PROVENANCE_KEYS = [
  ...BASE_SOURCE_KEYS, "queryId", "childCommit", "childTree", "parentCommit", "parentTree",
  "parentPath", "childPath", "parentMode", "childMode", "parentBlob", "childBlob",
  "parentRawContentHash", "childRawContentHash", "changedLineHash", "markerMatched",
] as const;
const LANGUAGE_KEYS = [
  ...BASE_SOURCE_KEYS, "stackRelease", "stackRevision", "configuration", "stableRowId",
  "swhBlobId", "swhContentId", "swhDirectoryId", "swhSnapshotId", "swhRevisionId",
  "stackRepository", "stackPath", "detectedLicenses", "detectedLanguage", "generated",
  "vendor", "sourceEncoding", "byteLength", "visitDate", "revisionDate", "committerDate",
] as const;

const encodedPath = (value: string): string => value.split("/").map(encodeURIComponent).join("/");

const validateGitHubBindings = (source: RecordValue): void => {
  const repository = text(source.repository);
  const commit = gitId(source.commit);
  const path = text(source.path);
  const base = `https://github.com/${repository}`;
  if (source.repositoryUrl !== base) fail();
  const commitUrl = `${base}/commit/${commit}`;
  if (source.commitUrl !== commitUrl || source.authorSourceUrl !== commitUrl) fail();
  if (source.blobUrl !== `${base}/blob/${commit}/${encodedPath(path)}`) fail();
  const licensePrefix = `${base}/blob/${commit}/`;
  if (!text(source.licenseFileUrl).startsWith(licensePrefix)
    || text(source.licenseFileUrl).length === licensePrefix.length) fail();
};

const validateBaseSource = (source: RecordValue, snapshotId: string): void => {
  exact(source.authorBasis, "SELECTED_COMMIT");
  for (const key of [
    "repository", "repositoryUrl", "authorName", "path", "licenseName", "licenseSpdx",
    "licenseFileUrl", "commitUrl", "blobUrl", "profileVersion",
  ]) text(source[key]);
  if (source.authorLogin !== null) text(source.authorLogin);
  for (const key of ["blob", "commit"]) gitId(source[key]);
  for (const key of ["rawContentHash", "excerptHash"]) sha256(source[key]);
  if (sha256(source.crawlSnapshotId) !== snapshotId) fail();
  validateGitHubBindings(source);
};

const validateProvenanceSource = (source: RecordValue): void => {
  exact(source.discoverySource, "GITHUB_COMMIT_SEARCH");
  text(source.queryId);
  for (const key of [
    "childCommit", "childTree", "parentCommit", "parentTree", "parentBlob", "childBlob",
  ]) gitId(source[key]);
  for (const key of ["parentRawContentHash", "childRawContentHash", "changedLineHash"]) sha256(source[key]);
  for (const key of ["parentPath", "childPath"]) text(source[key]);
  gitMode(source.parentMode);
  gitMode(source.childMode);
  bool(source.markerMatched);
  if (source.path !== source.parentPath || source.path !== source.childPath) fail();
  if (source.commit !== source.childCommit || source.blob !== source.childBlob) fail();
  if (source.rawContentHash !== source.childRawContentHash || source.parentBlob === source.childBlob) fail();
};

const validStackPath = (value: unknown): boolean => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value
    || value.startsWith("/") || value.includes("\\")) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
};

const validateLanguageSource = (source: RecordValue): void => {
  exact(source.discoverySource, "STACK_V2");
  exact(source.stackRelease, "v2.2.0");
  exact(source.stackRevision, "e565caa3a78c2423bd374333a472b049eb090e47");
  if (source.configuration !== "Python" && source.configuration !== "TypeScript") fail();
  sha256(source.stableRowId);
  for (const key of [
    "swhBlobId", "swhContentId", "swhDirectoryId", "swhSnapshotId", "swhRevisionId",
  ]) gitId(source[key]);
  for (const key of ["stackRepository", "stackPath", "detectedLanguage"]) text(source[key]);
  exact(source.sourceEncoding, "UTF-8");
  for (const key of ["visitDate", "revisionDate", "committerDate"]) {
    if (!validUtcTimestamp(source[key])) fail();
  }
  const detectedLicenses = texts(source.detectedLicenses);
  bool(source.generated);
  bool(source.vendor);
  count(source.byteLength);
  if (source.detectedLanguage !== source.configuration) fail();
  if (!validStackPath(source.stackPath)
    || source.repository !== source.stackRepository || source.path !== source.stackPath) fail();
  if (!detectedLicenses.includes(source.licenseSpdx as string)) fail();
  if (source.generated || source.vendor) fail();
};

const validateSource = (value: unknown, kind: ExperimentFixture["kind"], snapshotId: string): void => {
  const source = record(value, kind === "PROVENANCE" ? PROVENANCE_KEYS : LANGUAGE_KEYS);
  validateBaseSource(source, snapshotId);
  if (kind === "PROVENANCE") validateProvenanceSource(source);
  else validateLanguageSource(source);
};

const FIXTURE_KEYS = [
  "kind", "roundId", "roundVersion", "excerpt", "prompt", "candidates", "clues",
  "correctCandidateId", "evidence", "explanation", "attribution", "helpfulSignals",
  "misleadingSignals", "source",
] as const;

const validateFixture = (value: unknown, expectedKind: ExperimentFixture["kind"], snapshotId: string): void => {
  const fixture = record(value, FIXTURE_KEYS);
  exact(fixture.kind, expectedKind);
  for (const key of [
    "roundId", "roundVersion", "prompt", "correctCandidateId", "evidence",
    "explanation", "attribution",
  ]) text(fixture[key]);
  codeText(fixture.excerpt);
  const candidates = Array.isArray(fixture.candidates) ? fixture.candidates : fail();
  if (candidates.length < 2) fail();
  const candidateIds = candidates.map((candidate: unknown) => {
    const parsed = record(candidate, ["id", "label"]);
    text(parsed.label);
    return text(parsed.id);
  });
  if (new Set(candidateIds).size !== candidateIds.length || !candidateIds.includes(fixture.correctCandidateId as string)) fail();
  texts(fixture.clues);
  texts(fixture.helpfulSignals);
  texts(fixture.misleadingSignals);
  validateSource(fixture.source, expectedKind, snapshotId);
};

const parseSnapshotQueries = (value: unknown): readonly RecordValue[] => {
  if (!Array.isArray(value) || value.length === 0) return fail();
  const queries = value.map((entry) => {
    const query = record(entry, ["id", "query", "sort", "order", "pages", "resultCeiling"]);
    text(query.id);
    text(query.query);
    exact(query.sort, "committer-date");
    exact(query.order, "desc");
    positiveCount(query.pages);
    positiveCount(query.resultCeiling);
    return query;
  });
  if (new Set(queries.map(({ id }) => id)).size !== queries.length) fail();
  return queries;
};

const parseCrawlSnapshot = (value: unknown, artifactProfileHash: string): string => {
  const snapshot = record(value, [
    "id", "profileVersion", "profileHash", "github", "stack", "acceptedResponseHashes",
  ]);
  const snapshotId = sha256(snapshot.id);
  text(snapshot.profileVersion);
  if (sha256(snapshot.profileHash) !== artifactProfileHash) fail();
  const github = record(snapshot.github, ["apiVersion", "queries"]);
  text(github.apiVersion);
  parseSnapshotQueries(github.queries);
  const stack = record(snapshot.stack, ["release", "revision", "configurations"]);
  exact(stack.release, "v2.2.0");
  exact(stack.revision, "e565caa3a78c2423bd374333a472b049eb090e47");
  if (!Array.isArray(stack.configurations)
    || stack.configurations.length !== 2
    || stack.configurations[0] !== "Python"
    || stack.configurations[1] !== "TypeScript") fail();
  const responseHashes = Array.isArray(snapshot.acceptedResponseHashes)
    ? snapshot.acceptedResponseHashes.map(sha256)
    : fail();
  if (responseHashes.length === 0 || new Set(responseHashes).size !== responseHashes.length) fail();
  return snapshotId;
};

export const parseExperimentArtifact = (value: unknown): ExperimentArtifact => {
  const artifact = record(value, [
    "schemaVersion", "contentClass", "profileHash", "crawlSnapshot", "fixtures",
  ]);
  exact(artifact.schemaVersion, "local-experiment-artifact.v1");
  exact(artifact.contentClass, "LOCAL_UNREVIEWED_EXPERIMENT");
  const profileHash = sha256(artifact.profileHash);
  const snapshotId = parseCrawlSnapshot(artifact.crawlSnapshot, profileHash);
  const artifactFixtures = Array.isArray(artifact.fixtures) ? artifact.fixtures : fail();
  if (artifactFixtures.length !== EXPERIMENT_ROUND_COUNT) fail();
  const expected = ["PROVENANCE", "PROVENANCE", "PROVENANCE", "LANGUAGE", "LANGUAGE"] as const;
  artifactFixtures.forEach((fixture: unknown, index: number) => validateFixture(fixture, expected[index]!, snapshotId));
  const fixtures = artifactFixtures as RecordValue[];
  const ids = fixtures.map(({ roundId }) => roundId as string);
  if (new Set(ids).size !== ids.length) fail();
  const markerResults = fixtures.slice(0, PROVENANCE_ROUND_COUNT)
    .map((fixture) => (fixture.source as RecordValue).markerMatched);
  if (!markerResults.includes(true) || !markerResults.includes(false)) fail();
  const languages = fixtures.slice(PROVENANCE_ROUND_COUNT)
    .map((fixture) => (fixture.source as RecordValue).configuration);
  if (new Set(languages).size !== 2) fail();
  return deepFreeze(structuredClone(artifact)) as unknown as ExperimentArtifact;
};
