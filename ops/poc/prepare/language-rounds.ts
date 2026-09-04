import { createHash } from "node:crypto";

import { canonicalHash } from "./canonical";
import {
  parsePrivateReveal,
  parsePublicRound,
  type ExperimentFixture,
  type PrivateRevealRecord,
  type PublicRoundRecord,
} from "./model";
import { deepFreeze, validUtcTimestamp } from "./model-validation";
import type { CrawlProfile } from "./profile";
import type { RevalidatedStackCandidate } from "./stack-revalidation";

type Language = "Python" | "TypeScript";
type Candidate = RevalidatedStackCandidate & Readonly<Record<string, unknown>>;
type ClassifiedCandidate = Readonly<{ candidate: Candidate; language: Language }>;

export class LanguageRoundsError extends Error {
  public constructor() {
    super("LANGUAGE_ROUNDS_REJECTED");
    this.name = "LanguageRoundsError";
  }
}

export interface LanguageRoundsOptions {
  readonly profile: CrawlProfile;
  readonly candidates: readonly RevalidatedStackCandidate[];
}

export interface GeneratedLanguageRounds {
  readonly fixtures: readonly ExperimentFixture[];
  readonly publicRounds: readonly PublicRoundRecord[];
  readonly privateReveals: Readonly<Record<string, PrivateRevealRecord>>;
}

const CANDIDATE_KEYS = [
  "discoverySource", "repository", "repositoryUrl", "authorName", "authorLogin",
  "authorBasis", "authorSourceUrl", "path", "blob", "rawContentHash", "excerptHash",
  "licenseName", "licenseSpdx", "licenseFileUrl", "commit", "commitUrl", "blobUrl",
  "profileVersion", "crawlSnapshotId", "excerpt", "stackRelease", "stackRevision",
  "configuration", "stableRowId", "swhBlobId", "swhContentId", "swhDirectoryId",
  "swhSnapshotId", "swhRevisionId", "stackRepository", "stackPath", "detectedLicenses",
  "detectedLanguage", "generated", "vendor", "sourceEncoding", "byteLength", "visitDate",
  "revisionDate", "committerDate",
] as const;
const fail = (): never => { throw new LanguageRoundsError(); };
const text = (value: unknown): string =>
  typeof value === "string" && value.trim() === value && value.length > 0 ? value : fail();
const codeText = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fail();
const gitId = (value: unknown): string => /^[0-9a-f]{40}$/u.test(text(value)) ? value as string : fail();
const sha256Id = (value: unknown): string => /^[0-9a-f]{64}$/u.test(text(value)) ? value as string : fail();
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const encodedPath = (value: string): string => value.split("/").map(encodeURIComponent).join("/");

const exactShape = (candidate: Candidate): void => {
  const actual = Object.keys(candidate).sort();
  const expected = [...CANDIDATE_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
};

const languageFor = (profile: CrawlProfile, candidate: Candidate): Language => {
  if (candidate.configuration !== "Python" && candidate.configuration !== "TypeScript") fail();
  if (candidate.detectedLanguage !== candidate.configuration) fail();
  const language = candidate.configuration;
  const configured = profile.stack.configurations.find(({ configuration }) => configuration === language) ?? fail();
  const path = text(candidate.path);
  const matching = profile.stack.configurations.flatMap(({ extensions }) =>
    extensions.filter((extension) => path.endsWith(extension)));
  if (matching.length !== 1 || !configured.extensions.includes(matching[0]!)) fail();
  const stem = path.slice(0, -matching[0]!.length);
  if (profile.stack.configurations.some(({ extensions }) => extensions.some((extension) => stem.endsWith(extension)))) fail();
  return language as Language;
};

const exactBindings = (profile: CrawlProfile, candidate: Candidate): void => {
  exactShape(candidate);
  if (candidate.discoverySource !== "STACK_V2" || candidate.authorBasis !== "SELECTED_COMMIT"
    || candidate.stackRelease !== profile.stack.release || candidate.stackRevision !== profile.stack.revision
    || candidate.profileVersion !== profile.profileVersion || candidate.generated !== false
    || candidate.vendor !== false || candidate.sourceEncoding !== "UTF-8") fail();
  const repository = text(candidate.repository);
  const path = text(candidate.path);
  const commit = gitId(candidate.commit);
  const blob = gitId(candidate.blob);
  const root = `https://github.com/${repository}`;
  if (candidate.repositoryUrl !== root || candidate.stackRepository !== repository
    || candidate.stackPath !== path || candidate.swhRevisionId !== commit
    || candidate.swhContentId !== blob || candidate.commitUrl !== `${root}/commit/${commit}`
    || candidate.authorSourceUrl !== candidate.commitUrl
    || candidate.blobUrl !== `${root}/blob/${commit}/${encodedPath(path)}`
    || !text(candidate.licenseFileUrl).startsWith(`${root}/blob/${commit}/`)) fail();
  for (const value of [candidate.swhBlobId, candidate.swhDirectoryId, candidate.swhSnapshotId]) gitId(value);
  for (const value of [candidate.rawContentHash, candidate.crawlSnapshotId, candidate.stableRowId]) sha256Id(value);
  const excerpt = codeText(candidate.excerpt);
  const excerptBytes = Buffer.byteLength(excerpt);
  if (sha256Id(candidate.excerptHash) !== sha256(excerpt)
    || !Number.isSafeInteger(candidate.byteLength) || (candidate.byteLength as number) < excerptBytes
    || excerptBytes < profile.screening.minimumExcerptBytes || excerptBytes > profile.screening.excerptBytes) fail();
  text(candidate.authorName);
  if (candidate.authorLogin !== null) text(candidate.authorLogin);
  const licenses = Array.isArray(candidate.detectedLicenses) ? candidate.detectedLicenses.map(text) : fail();
  if (licenses.length === 0 || new Set(licenses).size !== licenses.length
    || !licenses.includes(text(candidate.licenseSpdx)) || !profile.licenses.includes(candidate.licenseSpdx as string)) fail();
  text(candidate.licenseName);
  for (const value of [candidate.visitDate, candidate.revisionDate, candidate.committerDate]) {
    if (!validUtcTimestamp(value)) fail();
  }
};

const containsWord = (haystack: string, needle: string): boolean => {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`, "iu").test(haystack);
};
const rejectSpoilers = (candidate: Candidate, language: Language): void => {
  const excerpt = codeText(candidate.excerpt);
  const structuralValues = [
    candidate.repository, candidate.repositoryUrl, candidate.authorSourceUrl, candidate.path,
    candidate.commit, candidate.commitUrl, candidate.blob, candidate.blobUrl,
    candidate.licenseFileUrl, candidate.stableRowId,
    candidate.swhBlobId, candidate.swhContentId, candidate.swhDirectoryId,
    candidate.swhSnapshotId, candidate.swhRevisionId,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const lowered = excerpt.toLocaleLowerCase("en-US");
  if (structuralValues.some((value) => lowered.includes(value.toLocaleLowerCase("en-US")))) fail();
  const protectedLabels = [candidate.authorName, candidate.authorLogin, candidate.licenseName, candidate.licenseSpdx,
    "Python", "TypeScript", "local-experiment.language.python.v1",
    "local-experiment.language.typescript.v1"]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (protectedLabels.some((value) => containsWord(excerpt, value))) fail();
  const pythonSignals = /(?:^|\n)\s*(?:def\b|from\s+\w+\s+import|import\s+\w+)|\bNone\b/u;
  const typeScriptSignals = /(?:^|\n)\s*(?:export\s+|interface\s+|type\s+)|=>|:\s*(?:string|number|boolean)\b/u;
  if ((language === "Python" && typeScriptSignals.test(excerpt))
    || (language === "TypeScript" && pythonSignals.test(excerpt))) fail();
};

const classify = (profile: CrawlProfile, candidate: RevalidatedStackCandidate): ClassifiedCandidate => {
  const value = candidate as Candidate;
  exactBindings(profile, value);
  const language = languageFor(profile, value);
  rejectSpoilers(value, language);
  return Object.freeze({ candidate: value, language });
};

export const validateLanguageCandidate = (options: Readonly<{
  profile: CrawlProfile;
  candidate: RevalidatedStackCandidate;
}>): RevalidatedStackCandidate => classify(options.profile, options.candidate).candidate;

const select = (options: LanguageRoundsOptions): readonly ClassifiedCandidate[] => {
  if (options.candidates.length < options.profile.selection.languageRounds) fail();
  const classified = options.candidates.map((candidate) => classify(options.profile, candidate));
  if (new Set(classified.map(({ candidate }) => candidate.crawlSnapshotId)).size !== 1) fail();
  for (const key of options.profile.deduplication) {
    const values = classified.map(({ candidate }) => text(candidate[key]));
    if (new Set(values).size !== values.length) fail();
  }
  const indexes = new Map(options.profile.stack.configurations.map(({ language }, index) => [language, index]));
  const ordinal = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
  const ordered = [...classified].sort((left, right) => {
    const configuration = (indexes.get(left.language) ?? fail()) - (indexes.get(right.language) ?? fail());
    if (configuration !== 0) return configuration;
    for (const key of ["stableRowId", "repository", "swhRevisionId", "path", "blob"] as const) {
      const order = ordinal(text(left.candidate[key]), text(right.candidate[key]));
      if (order !== 0) return order;
    }
    return 0;
  });
  const selected = options.profile.stack.configurations.map(({ language }) =>
    ordered.find((candidate) => candidate.language === language) ?? fail());
  return Object.freeze(selected);
};

const substitute = (template: string, language: Language): string => {
  if (!template.includes("{language}") || template.replace("{language}", "").includes("{language}")) fail();
  return template.replace("{language}", language);
};
const roundCandidates = () => Object.freeze([
  Object.freeze({ id: "local-experiment.language.python.v1", label: "Python" }),
  Object.freeze({ id: "local-experiment.language.typescript.v1", label: "TypeScript" }),
]);
const attribution = (source: Readonly<Record<string, unknown>>): string => [
  text(source.authorName), text(source.repository),
  `${text(source.licenseName)} (${text(source.licenseSpdx)})`, text(source.blobUrl),
].join(" · ");

const fixtureFor = (classified: ClassifiedCandidate, profile: CrawlProfile): ExperimentFixture => {
  const { candidate, language } = classified;
  const template = profile.templates.language;
  if (template.clues.length !== 2) fail();
  const sourceValue = Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "excerpt"));
  const source = deepFreeze(structuredClone(sourceValue));
  const candidates = roundCandidates();
  const roundId = `local-language-${canonicalHash({
    kind: "pinned-language-record", repository: candidate.repository, commit: candidate.commit,
    path: candidate.path, blob: candidate.blob,
  }).slice(0, 24)}`;
  const clues = Object.freeze([template.clues[0]!, substitute(template.clues[1]!, language)]);
  const evidence = substitute(template.evidence, language);
  const explanation = substitute(template.explanation, language);
  const roundVersion = canonicalHash({ source, excerpt: candidate.excerpt, template, language });
  return Object.freeze({
    kind: "LANGUAGE", roundId, roundVersion, excerpt: candidate.excerpt,
    prompt: template.prompt, candidates, clues,
    correctCandidateId: candidates[language === "Python" ? 0 : 1]!.id,
    evidence, explanation, attribution: attribution(source),
    helpfulSignals: Object.freeze([evidence]), misleadingSignals: Object.freeze([template.clues[0]!]),
    source,
  });
};

const projectionsFor = (fixture: ExperimentFixture, profile: CrawlProfile) => {
  const candidates = fixture.candidates.map(({ id, label }) => ({ candidateId: id, label }));
  const clues = fixture.clues.map((label, index) => ({ order: index + 1, label }));
  const candidateSet = canonicalHash(candidates);
  const scoring = canonicalHash({ scheme: "local-experiment-zero-one-two-clues.v1" });
  const rules = canonicalHash({ prompt: fixture.prompt, languages: profile.stack.configurations.map(({ language }) => language) });
  const publicRound = parsePublicRound({
    roundId: fixture.roundId, roundVersionId: fixture.roundVersion,
    excerpt: { versionId: fixture.source.excerptHash, text: fixture.excerpt },
    mode: {
      kind: "language", contractVersionId: canonicalHash({ candidates, prompt: fixture.prompt }),
      calibrationVersionId: canonicalHash({ profileVersion: profile.profileVersion }),
      prompt: fixture.prompt, candidates, clues,
    },
    versions: { candidateSet, clueSet: canonicalHash(clues), scoring, rules },
  });
  const privateReveal = parsePrivateReveal({
    roundId: fixture.roundId, roundVersionId: fixture.roundVersion,
    correctCandidateId: fixture.correctCandidateId, evidence: fixture.evidence,
    explanation: fixture.explanation, attribution: fixture.attribution,
    helpfulSignals: fixture.helpfulSignals, misleadingSignals: fixture.misleadingSignals,
    versions: {
      content: publicRound.excerpt.versionId, candidateSet, scoring, rules,
      evidence: canonicalHash({ evidence: fixture.evidence }),
      reveal: canonicalHash({ explanation: fixture.explanation, attribution: fixture.attribution,
        correctCandidateId: fixture.correctCandidateId }),
    },
  });
  return Object.freeze({ publicRound, privateReveal });
};

export const generateLanguageRounds = (
  options: LanguageRoundsOptions,
): GeneratedLanguageRounds => {
  const fixtures = Object.freeze(select(options).map((candidate) => fixtureFor(candidate, options.profile)));
  const projections = fixtures.map((fixture) => projectionsFor(fixture, options.profile));
  const publicRounds = Object.freeze(projections.map(({ publicRound }) => publicRound));
  const privateReveals = Object.freeze(Object.fromEntries(projections.map(({ privateReveal }) =>
    [privateReveal.roundId, privateReveal])));
  return Object.freeze({ fixtures, publicRounds, privateReveals });
};
