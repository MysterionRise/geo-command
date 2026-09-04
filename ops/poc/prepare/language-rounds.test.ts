import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { parsePrivateReveal, parsePublicRound } from "./model";
import { parseCrawlProfile } from "./profile";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const modulePath: string = "./language-rounds";
const roundsModule = await import(modulePath).catch(() => ({})) as Record<string, any>;
const generateLanguageRounds = typeof roundsModule.generateLanguageRounds === "function"
  ? roundsModule.generateLanguageRounds
  : (): never => { throw new Error("LANGUAGE_ROUNDS_NOT_IMPLEMENTED"); };

const hex = (digit: string, length = 40): string => digit.repeat(length);
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const loadProfile = async () => parseCrawlProfile(JSON.parse(
  await readFile(new URL("../profiles/local-real-rounds.v1.json", import.meta.url), "utf8"),
));

type Language = "Python" | "TypeScript";
const candidateContext = (language: Language, index: number) => {
  const identity = (offset: number, length = 40) =>
    hex(((index + offset) % 15).toString(16), length);
  const extension = language === "Python" ? ".py" : ".ts";
  const repository = `example/source-${index}`;
  const commit = identity(0);
  const path = `src/sample-${index}${extension}`;
  const excerpt = language === "Python"
    ? `def increment_${index}(value):\n    adjusted = value + ${index}\n    return adjusted\n`
    : `export const increment${index} = (value: number) => {\n  const adjusted = value + ${index};\n  return adjusted;\n};\n`;
  const root = `https://github.com/${repository}`;
  return { language, index, identity, repository, commit, path, excerpt, root };
};

const githubFields = (value: ReturnType<typeof candidateContext>) => ({
    discoverySource: "STACK_V2",
    repository: value.repository,
    repositoryUrl: value.root,
    authorName: `Developer ${value.index}`,
    authorLogin: `developer-${value.index}`,
    authorBasis: "SELECTED_COMMIT",
    authorSourceUrl: `${value.root}/commit/${value.commit}`,
    path: value.path,
    blob: value.identity(1),
    rawContentHash: value.identity(2, 64),
    excerptHash: digest(value.excerpt),
    licenseName: "MIT License",
    licenseSpdx: "MIT",
    licenseFileUrl: `${value.root}/blob/${value.commit}/LICENSE`,
    commit: value.commit,
    commitUrl: `${value.root}/commit/${value.commit}`,
    blobUrl: `${value.root}/blob/${value.commit}/${value.path}`,
    profileVersion: "local-real-rounds.v1",
    crawlSnapshotId: hex("f", 64),
    excerpt: value.excerpt,
});

const stackFields = (value: ReturnType<typeof candidateContext>) => ({
    stackRelease: "v2.2.0",
    stackRevision: "e565caa3a78c2423bd374333a472b049eb090e47",
    configuration: value.language,
    stableRowId: value.identity(3, 64),
    swhBlobId: value.identity(4),
    swhContentId: value.identity(1),
    swhDirectoryId: value.identity(5),
    swhSnapshotId: value.identity(6),
    swhRevisionId: value.commit,
    stackRepository: value.repository,
    stackPath: value.path,
    detectedLicenses: Object.freeze(["MIT"]),
    detectedLanguage: value.language,
    generated: false,
    vendor: false,
    sourceEncoding: "UTF-8",
    byteLength: Buffer.byteLength(value.excerpt),
    visitDate: "2026-01-01T00:00:00Z",
    revisionDate: "2025-12-31T00:00:00Z",
    committerDate: "2025-12-30T00:00:00Z",
});

const candidate = (language: Language, index: number) => {
  const context = candidateContext(language, index);
  return Object.freeze({ ...githubFields(context), ...stackFields(context) });
};

const rewriteExcerpt = (value: any, excerpt: string): void => {
  value.excerpt = excerpt;
  value.excerptHash = digest(excerpt);
  value.rawContentHash = digest(excerpt);
  value.byteLength = Buffer.byteLength(excerpt);
};

const rewritePath = (value: any, path: string): void => {
  value.path = path;
  value.stackPath = path;
  value.blobUrl = `${value.repositoryUrl}/blob/${value.commit}/${path}`;
};

describe("Stack language round generation", () => {
  it("exposes the same candidate eligibility gate used before round selection", async () => {
    const profile = await loadProfile();
    const valid = candidate("Python", 1);
    const invalid = structuredClone(valid) as any;
    rewriteExcerpt(invalid, `${invalid.excerpt}\nexport const spoiler = true;`);

    expect(roundsModule.validateLanguageCandidate({ profile, candidate: valid })).toBe(valid);
    expect(() => roundsModule.validateLanguageCandidate({ profile, candidate: invalid }))
      .toThrow(roundsModule.LanguageRoundsError);
  });

  it("selects one Python round then one TypeScript round", async () => {
    const output = generateLanguageRounds({
      profile: await loadProfile(),
      candidates: [candidate("TypeScript", 2), candidate("Python", 1)],
    });

    expect(output.fixtures).toHaveLength(2);
    expect(output.fixtures.map(({ source }: any) => source.configuration)).toEqual([
      "Python",
      "TypeScript",
    ]);
  });

  it("builds spoiler-free public rounds and version-bound private reveals", async () => {
    const parsedProfile = await loadProfile();
    const candidates = [candidate("Python", 1), candidate("TypeScript", 2)];
    const output = generateLanguageRounds({ profile: parsedProfile, candidates });

    expect(output.publicRounds).toHaveLength(2);
    expect(Object.keys(output.privateReveals).sort()).toEqual(
      output.publicRounds.map(({ roundId }: any) => roundId).sort(),
    );
    for (const [index, fixture] of output.fixtures.entries()) {
      const publicRound = parsePublicRound(output.publicRounds[index]);
      const reveal = parsePrivateReveal(output.privateReveals[fixture.roundId]);
      expect(fixture.kind).toBe("LANGUAGE");
      expect(fixture.candidates.map(({ id }: any) => id)).toEqual([
        "local-experiment.language.python.v1",
        "local-experiment.language.typescript.v1",
      ]);
      expect(publicRound.mode.kind).toBe("language");
      expect(reveal.correctCandidateId).toBe(fixture.correctCandidateId);
      expect(reveal.roundVersionId).toBe(publicRound.roundVersionId);
      expect(reveal.versions.content).toBe(publicRound.excerpt.versionId);
      expect(reveal.versions.candidateSet).toBe(publicRound.versions.candidateSet);
      expect(reveal.versions.scoring).toBe(publicRound.versions.scoring);
      expect(reveal.versions.rules).toBe(publicRound.versions.rules);
      expect(Object.isFrozen(fixture.source)).toBe(true);
      expect(Object.isFrozen(publicRound)).toBe(true);
      expect(Object.isFrozen(reveal)).toBe(true);
    }
    const publicJson = JSON.stringify(output.publicRounds);
    for (const value of candidates) {
      for (const protectedValue of [
        value.repository, value.authorName, value.licenseName, value.commit,
        value.blob, value.swhBlobId, value.swhContentId, value.blobUrl,
      ]) expect(publicJson).not.toContain(protectedValue);
    }
  });

  it("rejects wrong-source and independently duplicated candidates", async () => {
    const parsedProfile = await loadProfile();
    const wrongSource = structuredClone(candidate("Python", 1)) as any;
    wrongSource.discoverySource = "GITHUB_COMMIT_SEARCH";
    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [wrongSource, candidate("TypeScript", 2)],
    })).toThrow(roundsModule.LanguageRoundsError);

    for (const key of parsedProfile.deduplication) {
      const python = structuredClone(candidate("Python", 1)) as any;
      const typescript = structuredClone(candidate("TypeScript", 2)) as any;
      typescript[key] = python[key];
      expect(() => generateLanguageRounds({
        profile: parsedProfile,
        candidates: [python, typescript],
      })).toThrow(roundsModule.LanguageRoundsError);
    }
  });

  it("orders an oversized pool stably and replays byte-identically", async () => {
    const parsedProfile = await loadProfile();
    const candidates = [
      candidate("TypeScript", 4), candidate("Python", 3),
      candidate("TypeScript", 2), candidate("Python", 1),
    ];
    const first = generateLanguageRounds({ profile: parsedProfile, candidates });
    const second = generateLanguageRounds({ profile: parsedProfile, candidates: [...candidates].reverse() });

    expect(first.fixtures.map(({ source }: any) => source.repository)).toEqual([
      "example/source-1", "example/source-2",
    ]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("binds signed templates, attribution, identities, and nested immutability", async () => {
    const parsedProfile = await loadProfile();
    const output = generateLanguageRounds({
      profile: parsedProfile,
      candidates: [candidate("Python", 1), candidate("TypeScript", 2)],
    });

    for (const fixture of output.fixtures as any[]) {
      const language = fixture.source.configuration as "Python" | "TypeScript";
      const publicRound = output.publicRounds.find(({ roundId }: any) => roundId === fixture.roundId)!;
      const reveal = output.privateReveals[fixture.roundId] as any;
      expect(fixture.prompt).toBe(parsedProfile.templates.language.prompt);
      expect(fixture.clues).toEqual([
        parsedProfile.templates.language.clues[0],
        parsedProfile.templates.language.clues[1]!.replace("{language}", language),
      ]);
      expect(fixture.evidence).toBe(
        parsedProfile.templates.language.evidence.replace("{language}", language),
      );
      expect(fixture.explanation).toBe(
        parsedProfile.templates.language.explanation.replace("{language}", language),
      );
      expect(fixture.attribution).toBe([
        fixture.source.authorName,
        fixture.source.repository,
        `${fixture.source.licenseName} (${fixture.source.licenseSpdx})`,
        fixture.source.blobUrl,
      ].join(" · "));
      expect(publicRound.excerpt.versionId).toBe(fixture.source.excerptHash);
      expect(reveal).not.toHaveProperty("source");
      expect(JSON.stringify(reveal)).not.toContain(fixture.source.stableRowId);
      expect(Object.isFrozen(fixture.candidates)).toBe(true);
      expect(Object.isFrozen(fixture.clues)).toBe(true);
      expect(Object.isFrozen(fixture.helpfulSignals)).toBe(true);
      expect(Object.isFrozen(fixture.source.detectedLicenses)).toBe(true);
    }
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.fixtures)).toBe(true);
    expect(Object.isFrozen(output.publicRounds)).toBe(true);
    expect(Object.isFrozen(output.privateReveals)).toBe(true);
  });

  it.each([
    ["extra source field", (value: any) => { value.unexpected = true; }],
    ["Stack release", (value: any) => { value.stackRelease = "v2.0.0"; }],
    ["Stack revision", (value: any) => { value.stackRevision = hex("a"); }],
    ["profile", (value: any) => { value.profileVersion = "other"; }],
    ["snapshot", (value: any) => { value.crawlSnapshotId = "bad"; }],
    ["repository", (value: any) => { value.stackRepository = "example/other"; }],
    ["path", (value: any) => { value.stackPath = "src/other.py"; }],
    ["commit", (value: any) => { value.swhRevisionId = hex("a"); }],
    ["blob", (value: any) => { value.swhContentId = hex("a"); }],
    ["repository URL", (value: any) => { value.repositoryUrl = "https://example.test"; }],
    ["author URL", (value: any) => { value.authorSourceUrl += "/wrong"; }],
    ["blob URL", (value: any) => { value.blobUrl += "/wrong"; }],
    ["generated source", (value: any) => { value.generated = true; }],
    ["vendor source", (value: any) => { value.vendor = true; }],
    ["encoding", (value: any) => { value.sourceEncoding = "latin-1"; }],
    ["detected language", (value: any) => { value.detectedLanguage = "TypeScript"; }],
    ["excerpt hash", (value: any) => { value.excerptHash = hex("a", 64); }],
    ["declared bytes", (value: any) => { value.byteLength = 1; }],
    ["licence agreement", (value: any) => { value.detectedLicenses = ["Apache-2.0"]; }],
    ["duplicate licences", (value: any) => { value.detectedLicenses = ["MIT", "MIT"]; }],
    ["date", (value: any) => { value.visitDate = "2026-13-01T00:00:00Z"; }],
    ["unsupported extension", (value: any) => { rewritePath(value, "src/sample.js"); }],
    ["uppercase extension", (value: any) => { rewritePath(value, "src/sample.PY"); }],
    ["compound extension", (value: any) => { rewritePath(value, "src/sample.py.ts"); }],
  ])("rejects a mismatched %s", async (_name: string, mutate: (value: any) => void) => {
    const parsedProfile = await loadProfile();
    const python = structuredClone(candidate("Python", 1)) as any;
    mutate(python);
    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [python, candidate("TypeScript", 2)],
    })).toThrow(roundsModule.LanguageRoundsError);
  });

  it.each([
    ["repository", (value: any) => value.repository],
    ["author", (value: any) => value.authorName],
    ["licence", (value: any) => value.licenseName],
    ["path", (value: any) => value.path],
    ["commit", (value: any) => value.commit],
    ["blob", (value: any) => value.blob],
    ["Stack identity", (value: any) => value.stableRowId],
    ["answer label", () => "Python"],
    ["candidate ID", () => "local-experiment.language.python.v1"],
    ["polyglot", () => "export const surprise = (value: number) => value;"],
  ])("rejects excerpt %s leakage", async (_name: string, leaked: (value: any) => string) => {
    const parsedProfile = await loadProfile();
    const python = structuredClone(candidate("Python", 1)) as any;
    rewriteExcerpt(python, `${python.excerpt}\n# ${leaked(python)}`);
    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [python, candidate("TypeScript", 2)],
    })).toThrow(roundsModule.LanguageRoundsError);
  });

  it("rejects missing languages, TypeScript polyglot input, and unsigned templates", async () => {
    const parsedProfile = await loadProfile();
    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [candidate("Python", 1), candidate("Python", 3)],
    })).toThrow(roundsModule.LanguageRoundsError);

    const typescript = structuredClone(candidate("TypeScript", 2)) as any;
    rewriteExcerpt(typescript, `${typescript.excerpt}\ndef surprise(value):\n    return value`);
    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [candidate("Python", 1), typescript],
    })).toThrow(roundsModule.LanguageRoundsError);

    const unsigned = structuredClone(parsedProfile) as any;
    unsigned.templates.language.evidence = "The record agrees.";
    expect(() => generateLanguageRounds({
      profile: unsigned,
      candidates: [candidate("Python", 1), candidate("TypeScript", 2)],
    })).toThrow(roundsModule.LanguageRoundsError);
  });

  it("accepts ordinary identifiers containing short labels and polyglot prefixes", async () => {
    const parsedProfile = await loadProfile();
    const python = structuredClone(candidate("Python", 1)) as any;
    rewriteExcerpt(python, `${python.excerpt}\ndef limited(value):\n    limit = value + 1\n    return limit`);
    const typescript = structuredClone(candidate("TypeScript", 2)) as any;
    rewriteExcerpt(typescript, `${typescript.excerpt}\ndefaultValue = increment2(1);`);

    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [python, typescript],
    })).not.toThrow();
  });

  it("rejects otherwise valid candidates from different crawl snapshots", async () => {
    const parsedProfile = await loadProfile();
    const typescript = structuredClone(candidate("TypeScript", 2)) as any;
    typescript.crawlSnapshotId = hex("e", 64);

    expect(() => generateLanguageRounds({
      profile: parsedProfile,
      candidates: [candidate("Python", 1), typescript],
    })).toThrow(roundsModule.LanguageRoundsError);
  });

  it("uses ordinal ordering without consulting the host locale", async () => {
    const parsedProfile = await loadProfile();
    const original = String.prototype.localeCompare;
    Object.defineProperty(String.prototype, "localeCompare", {
      configurable: true,
      value: () => { throw new Error("host locale consulted"); },
    });
    try {
      const output = generateLanguageRounds({
        profile: parsedProfile,
        candidates: [
          candidate("TypeScript", 4), candidate("Python", 3),
          candidate("TypeScript", 2), candidate("Python", 1),
        ],
      });
      expect(output.fixtures.map(({ source }: any) => source.repository)).toEqual([
        "example/source-1", "example/source-2",
      ]);
    } finally {
      Object.defineProperty(String.prototype, "localeCompare", {
        configurable: true,
        value: original,
      });
    }
  });
});
