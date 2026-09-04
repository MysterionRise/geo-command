import { ExperimentRecordError, parseExperimentArtifact } from "./model";
import * as recordParsers from "./model";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;

const hash = (digit: string): string => digit.repeat(64);
const commit = (digit: string): string => digit.repeat(40);

const source = (digit: string) => ({
  repository: "owner/project",
  repositoryUrl: "https://github.com/owner/project",
  authorName: "Example Author",
  authorLogin: "example",
  authorBasis: "SELECTED_COMMIT",
  authorSourceUrl: `https://github.com/owner/project/commit/${commit(digit)}`,
  path: `src/file-${digit}.ts`,
  blob: commit(digit),
  rawContentHash: hash(digit),
  excerptHash: hash(digit === "a" ? "b" : digit),
  licenseName: "MIT License",
  licenseSpdx: "MIT",
  licenseFileUrl: `https://github.com/owner/project/blob/${commit(digit)}/LICENSE`,
  commit: commit(digit),
  commitUrl: `https://github.com/owner/project/commit/${commit(digit)}`,
  blobUrl: `https://github.com/owner/project/blob/${commit(digit)}/src/file-${digit}.ts`,
  profileVersion: "local-real-rounds.v1",
  crawlSnapshotId: hash("f"),
});

const provenanceFixture = (index: number, digit: string) => ({
  kind: "PROVENANCE",
  roundId: `provenance-${index}`,
  roundVersion: "1",
  excerpt: `const value${index} = ${index};`,
  prompt: "Does this commit record contain a configured marker?",
  candidates: [
    { id: "marker-recorded", label: "Configured marker recorded" },
    { id: "marker-not-recorded", label: "Configured marker not recorded in this commit" },
  ],
  clues: ["Inspect the pinned record.", "Use only literal marker evidence."],
  correctCandidateId: index === 1 ? "marker-recorded" : "marker-not-recorded",
  evidence: "The pinned commit message supplies the result.",
  explanation: "This classifies only literal marker presence.",
  attribution: "owner/project — Example Author — MIT License (MIT) — pinned file",
  helpfulSignals: ["Literal commit-record marker"],
  misleadingSignals: ["Code style"],
  source: {
    discoverySource: "GITHUB_COMMIT_SEARCH",
    ...source(digit),
    queryId: "copilot-trailer",
    childCommit: commit(digit),
    childTree: commit("b"),
    parentCommit: commit("c"),
    parentTree: commit("d"),
    parentPath: `src/file-${digit}.ts`,
    childPath: `src/file-${digit}.ts`,
    parentMode: "100644",
    childMode: "100644",
    parentBlob: commit("e"),
    childBlob: commit(digit),
    parentRawContentHash: hash("e"),
    childRawContentHash: hash(digit),
    changedLineHash: hash("9"),
    markerMatched: index === 1,
  },
});

const languageFixture = (index: number, language: "Python" | "TypeScript", digit: string) => ({
  kind: "LANGUAGE",
  roundId: `language-${index}`,
  roundVersion: "1",
  excerpt: language === "Python" ? "value = 1" : "const value = 1;",
  prompt: "Which programming language is this excerpt?",
  candidates: [
    { id: "Python", label: "Python" },
    { id: "TypeScript", label: "TypeScript" },
  ],
  clues: ["Inspect the syntax.", "Consider the pinned file extension."],
  correctCandidateId: language,
  evidence: `The extension and detected language agree on ${language}.`,
  explanation: "The answer follows the configured extension mapping.",
  attribution: "owner/project — Example Author — MIT License (MIT) — pinned file",
  helpfulSignals: ["File extension"],
  misleadingSignals: ["Repository topic"],
  source: {
    discoverySource: "STACK_V2",
    ...source(digit),
    stackRelease: "v2.2.0",
    stackRevision: "e565caa3a78c2423bd374333a472b049eb090e47",
    configuration: language,
    stableRowId: hash(digit),
    swhBlobId: commit(digit),
    swhContentId: commit(digit),
    swhDirectoryId: commit("b"),
    swhSnapshotId: commit("c"),
    swhRevisionId: commit("d"),
    stackRepository: "owner/project",
    stackPath: `src/file-${digit}.ts`,
    detectedLicenses: ["MIT"],
    detectedLanguage: language,
    generated: false,
    vendor: false,
    sourceEncoding: "UTF-8",
    byteLength: 128,
    visitDate: "2023-09-06T10:44:38.631000Z",
    revisionDate: "2023-09-05T09:30:00Z",
    committerDate: "2023-09-05T09:30:00Z",
  },
});

const artifact = () => ({
  schemaVersion: "local-experiment-artifact.v1",
  contentClass: "LOCAL_UNREVIEWED_EXPERIMENT",
  profileHash: hash("1"),
  crawlSnapshot: exactSnapshot(),
  fixtures: [
    provenanceFixture(1, "1"),
    provenanceFixture(2, "2"),
    provenanceFixture(3, "3"),
    languageFixture(1, "Python", "4"),
    languageFixture(2, "TypeScript", "5"),
  ],
});

const exactSnapshot = () => ({
  id: hash("f"),
  profileVersion: "local-real-rounds.v1",
  profileHash: hash("1"),
  github: {
    apiVersion: "2022-11-28",
    queries: [
      {
        id: "copilot-trailer",
        query: "\"Co-authored-by: GitHub Copilot\"",
        sort: "committer-date",
        order: "desc",
        pages: 3,
        resultCeiling: 300,
      },
    ],
  },
  stack: {
    release: "v2.2.0",
    revision: "e565caa3a78c2423bd374333a472b049eb090e47",
    configurations: ["Python", "TypeScript"],
  },
  acceptedResponseHashes: [hash("2"), hash("3")],
});

const publicRounds = () => artifact().fixtures.map((fixture, index) => ({
  roundId: fixture.roundId,
  roundVersionId: fixture.roundVersion,
  excerpt: { versionId: `excerpt-${index + 1}`, text: fixture.excerpt },
  mode: {
    kind: fixture.kind === "PROVENANCE" ? "provenance" : "language",
    contractVersionId: `${fixture.kind.toLowerCase()}-contract-v1`,
    calibrationVersionId: "local-experiment-calibration-v1",
    prompt: fixture.prompt,
    candidates: fixture.candidates.map(({ id, label }) => ({ candidateId: id, label })),
    clues: fixture.clues.map((label, clueIndex) => ({ order: clueIndex + 1, label })),
  },
  versions: {
    candidateSet: `candidates-${index + 1}`,
    clueSet: `clues-${index + 1}`,
    scoring: "scoring-v1",
    rules: "rules-v1",
  },
}));

const privateReveals = () => Object.fromEntries(artifact().fixtures.map((fixture, index) => {
  const publicRound = publicRounds()[index]!;
  return [fixture.roundId, {
    roundId: fixture.roundId,
    roundVersionId: fixture.roundVersion,
    correctCandidateId: fixture.correctCandidateId,
    evidence: fixture.evidence,
    explanation: fixture.explanation,
    attribution: fixture.attribution,
    helpfulSignals: fixture.helpfulSignals,
    misleadingSignals: fixture.misleadingSignals,
    versions: {
      content: publicRound.excerpt.versionId,
      candidateSet: publicRound.versions.candidateSet,
      scoring: publicRound.versions.scoring,
      rules: publicRound.versions.rules,
      evidence: `evidence-${index + 1}`,
      reveal: `reveal-${index + 1}`,
    },
  }];
}));

const mutableSource = (
  candidate: ReturnType<typeof artifact>,
  index: number,
): Record<string, unknown> => candidate.fixtures[index]!.source as Record<string, unknown>;

const setStackPath = (value: Record<string, unknown>, path: string): void => {
  value.path = path;
  value.stackPath = path;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  value.blobUrl = `${value.repository as string}/blob/${value.commit as string}/${encoded}`;
  value.blobUrl = `https://github.com/${value.blobUrl}`;
};

describe("local experiment records", () => {
  it("parses the exact three provenance and two language fixture composition", () => {
    const parsed = parseExperimentArtifact(artifact());

    expect(parsed.contentClass).toBe("LOCAL_UNREVIEWED_EXPERIMENT");
    expect(parsed.fixtures.map(({ kind }) => kind)).toEqual([
      "PROVENANCE", "PROVENANCE", "PROVENANCE", "LANGUAGE", "LANGUAGE",
    ]);
  });

  it("preserves a nonblank language excerpt with a trailing newline", () => {
    const candidate = artifact();
    candidate.fixtures[3]!.excerpt = "def value():\n    return 1\n";

    const parsed = parseExperimentArtifact(candidate);

    expect(parsed.fixtures[3]!.excerpt).toBe("def value():\n    return 1\n");
  });

  it("rejects unknown fields in every nested record", () => {
    const candidate = artifact();
    (candidate.fixtures[0]!.source as Record<string, unknown>).surprise = true;

    expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
  });

  it("rejects controlled status, review, promotion, catalogue, and classification fields", () => {
    const forbidden = [
      "approvalId", "approvalDecision", "promotionId", "reviewDecision", "approvedStatus",
      "betaStatus", "catalogueId", "provenanceClassification",
    ];

    for (const key of forbidden) {
      const candidate = artifact() as Record<string, unknown>;
      candidate[key] = "forbidden";
      expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
    }
  });

  it("rejects duplicate identities and source records from another snapshot", () => {
    const duplicate = artifact();
    duplicate.fixtures[1]!.roundId = duplicate.fixtures[0]!.roundId;
    const mixed = artifact();
    mixed.fixtures[4]!.source.crawlSnapshotId = hash("8");

    expect(() => parseExperimentArtifact(duplicate)).toThrow(ExperimentRecordError);
    expect(() => parseExperimentArtifact(mixed)).toThrow(ExperimentRecordError);
  });

  it("accepts both regular Git file modes", () => {
    const candidate = artifact();
    mutableSource(candidate, 0).parentMode = "100755";
    mutableSource(candidate, 0).childMode = "100755";

    expect(() => parseExperimentArtifact(candidate)).not.toThrow();
  });

  it("rejects source URLs that do not bind the exact repository, commit, and path", () => {
    const mutations = [
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.authorSourceUrl = "https://github.com/other/project/commit/" + commit("1");
      },
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.authorSourceUrl = "https://github.com/owner/project/commit/" + commit("2");
      },
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.repositoryUrl = "https://github.com/other/project";
      },
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.commitUrl = "https://github.com/owner/project/commit/" + commit("2");
      },
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.licenseFileUrl = "https://github.com/owner/project/blob/" + commit("2") + "/LICENSE";
      },
      (candidate: ReturnType<typeof artifact>) => {
        candidate.fixtures[0]!.source.blobUrl = "https://github.com/owner/project/blob/" + commit("1") + "/src/other.ts";
      },
    ];

    for (const mutate of mutations) {
      const candidate = artifact();
      mutate(candidate);
      expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
    }
  });

  it("rejects inconsistent provenance base and child bindings", () => {
    const mutations = [
      (candidate: ReturnType<typeof artifact>) => { candidate.fixtures[0]!.source.path = "src/other.ts"; },
      (candidate: ReturnType<typeof artifact>) => { candidate.fixtures[0]!.source.blob = commit("9"); },
      (candidate: ReturnType<typeof artifact>) => { candidate.fixtures[0]!.source.rawContentHash = hash("9"); },
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 0).parentBlob = commit("1"); },
    ];

    for (const mutate of mutations) {
      const candidate = artifact();
      mutate(candidate);
      expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
    }
  });

  it("rejects Stack records that disagree on repository, path, licence, or screening flags", () => {
    const mutations = [
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 3).stackRepository = "other/project"; },
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 3).stackPath = "src/other.py"; },
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 3).detectedLicenses = ["Apache-2.0"]; },
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 3).generated = true; },
      (candidate: ReturnType<typeof artifact>) => { mutableSource(candidate, 3).vendor = true; },
    ];

    for (const mutate of mutations) {
      const candidate = artifact();
      mutate(candidate);
      expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
    }
  });

  it("rejects malformed Stack identities, dates, encoding, and repository paths", () => {
    const mutations: Array<(source: Record<string, unknown>) => void> = [
      (value) => { delete value.visitDate; },
      (value) => { value.firstCrawlDate = "2025-01-01"; },
      (value) => { value.lastCrawlDate = "2025-02-01"; },
      (value) => { value.sourceEncoding = "utf-8"; },
      (value) => { value.visitDate = "2023-09-06"; },
      (value) => { value.revisionDate = "2023-02-30T09:30:00Z"; },
      (value) => { value.committerDate = "2023-09-05T09:30:00.123Z"; },
      (value) => { value.stableRowId = "a".repeat(63); },
      (value) => { value.swhBlobId = `swh:1:cnt:${commit("a")}`; },
      (value) => { value.swhContentId = commit("a").toUpperCase(); },
      (value) => { value.swhDirectoryId = "a".repeat(39); },
      (value) => { value.swhSnapshotId = "a".repeat(41); },
      (value) => { value.swhRevisionId = "g".repeat(40); },
      (value) => { setStackPath(value, "/src/file-4.ts"); },
      (value) => { setStackPath(value, "src//file-4.ts"); },
      (value) => { setStackPath(value, "src/./file-4.ts"); },
      (value) => { setStackPath(value, "src/../file-4.ts"); },
      (value) => { setStackPath(value, "src\\file-4.ts"); },
    ];

    for (const mutate of mutations) {
      const candidate = artifact();
      const value = mutableSource(candidate, 3);
      mutate(value);
      expect(() => parseExperimentArtifact(candidate)).toThrow(ExperimentRecordError);
    }
  });

  it("requires the exact deterministic GitHub and Stack crawl-snapshot inputs", () => {
    const complete = artifact();
    const incomplete = artifact();
    incomplete.crawlSnapshot = {
      id: hash("f"),
      profileVersion: "local-real-rounds.v1",
      profileHash: hash("1"),
      acceptedResponseHashes: [hash("2"), hash("3")],
    } as never;

    expect(() => parseExperimentArtifact(complete)).not.toThrow();
    expect(() => parseExperimentArtifact(incomplete)).toThrow(ExperimentRecordError);
  });

  it("returns every nested object and array recursively immutable", () => {
    const parsed = parseExperimentArtifact(artifact());
    const values: object[] = [];
    const visit = (value: unknown): void => {
      if (typeof value !== "object" || value === null) return;
      values.push(value);
      for (const nested of Object.values(value)) visit(nested);
    };
    visit(parsed);

    expect(values.length).toBeGreaterThan(10);
    expect(values.every(Object.isFrozen)).toBe(true);
  });

  it("parses an exact public round without accepting protected reveal fields", () => {
    const parser = (recordParsers as Record<string, unknown>).parsePublicRound as
      | ((value: unknown) => any)
      | undefined;
    expect(parser).toBeTypeOf("function");
    if (!parser) return;
    const input = publicRounds()[0]!;
    const parsed = parser(input);

    expect(parsed).toEqual(input);
    expect(Object.isFrozen(parsed.mode.candidates)).toBe(true);
    for (const protectedField of [
      "correctCandidateId", "evidence", "explanation", "source", "author", "license",
      "attribution", "commit", "pinnedUrl",
    ]) {
      expect(() => parser({ ...input, [protectedField]: "private" }))
        .toThrow(ExperimentRecordError);
    }
  });

  it("parses an exact private reveal and rejects malformed protected records", () => {
    const parser = (recordParsers as Record<string, unknown>).parsePrivateReveal as
      | ((value: unknown) => any)
      | undefined;
    expect(parser).toBeTypeOf("function");
    if (!parser) return;
    const input = privateReveals()["provenance-1"]!;
    const parsed = parser(input);
    const missingEvidence = structuredClone(input) as Record<string, unknown>;
    delete missingEvidence.evidence;

    expect(parsed).toEqual(input);
    expect(Object.isFrozen(parsed.versions)).toBe(true);
    expect(() => parser({ ...input, source: {} })).toThrow(ExperimentRecordError);
    expect(() => parser(missingEvidence)).toThrow(ExperimentRecordError);
    expect(() => parser({ ...input, helpfulSignals: [] })).toThrow(ExperimentRecordError);
    expect(() => parser({ ...input, correctCandidateId: " " })).toThrow(ExperimentRecordError);
  });

  it("binds exactly five public identities to the same keyed private reveal identities", () => {
    const parser = (recordParsers as Record<string, unknown>).parseRoundRecordSet as
      | ((value: unknown) => any)
      | undefined;
    expect(parser).toBeTypeOf("function");
    if (!parser) return;
    const input = {
      sessionContractVersionId: "local-experiment-session-v1",
      publicRounds: publicRounds(),
      privateReveals: privateReveals(),
    };
    const parsed = parser(input);

    expect(Object.keys(parsed.privateReveals).sort()).toEqual(
      parsed.publicRounds.map(({ roundId }: { roundId: string }) => roundId).sort(),
    );
    expect(Object.isFrozen(parsed.privateReveals)).toBe(true);
    const serializedPublic = JSON.stringify(parsed.publicRounds);
    expect(serializedPublic).not.toMatch(
      /"(?:correctCandidateId|evidence|explanation|attribution|author|license|commit|pinnedUrl)"\s*:/u,
    );
    expect(serializedPublic).not.toMatch(/https:\/\/github\.com\//u);
    expect(serializedPublic).not.toMatch(/\b[0-9a-f]{40}\b/u);
  });

  it("rejects missing, extra, duplicate, or inconsistently bound round records", () => {
    const parser = (recordParsers as Record<string, unknown>).parseRoundRecordSet as
      | ((value: unknown) => unknown)
      | undefined;
    expect(parser).toBeTypeOf("function");
    if (!parser) return;
    const makeInput = () => ({
      sessionContractVersionId: "local-experiment-session-v1",
      publicRounds: publicRounds(),
      privateReveals: privateReveals(),
    });
    const missing = makeInput();
    delete missing.privateReveals["language-2"];
    const extra = makeInput();
    extra.privateReveals.extra = { ...extra.privateReveals["language-2"]!, roundId: "extra" };
    const duplicate = makeInput();
    duplicate.publicRounds[1]!.roundId = duplicate.publicRounds[0]!.roundId;
    const wrongRoundVersion = makeInput();
    wrongRoundVersion.privateReveals["language-2"]!.roundVersionId = "wrong";
    const wrongContentVersion = makeInput();
    wrongContentVersion.privateReveals["language-2"]!.versions.content = "wrong";
    const wrongCandidate = makeInput();
    wrongCandidate.privateReveals["language-2"]!.correctCandidateId = "not-playable";
    const wrongComposition = makeInput();
    wrongComposition.publicRounds[0]!.mode.kind = "language";

    for (const candidate of [
      missing, extra, duplicate, wrongRoundVersion, wrongContentVersion, wrongCandidate,
      wrongComposition, { ...makeInput(), unexpected: true },
    ]) {
      expect(() => parser(candidate)).toThrow(ExperimentRecordError);
    }
  });
});
