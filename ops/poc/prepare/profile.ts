const MEBIBYTE = 1024 * 1024;

export const SIGNED_CAPACITY_CEILINGS = Object.freeze({
  githubPages: 3,
  githubResults: 300,
  stackRowsPerLanguage: 10_000,
  stackMetadataBytes: 64 * MEBIBYTE,
  blobAttempts: 50,
  successfulBlobs: 50,
  perBlobBytes: 256 * 1024,
  totalBlobBytes: 16 * MEBIBYTE,
  concurrentRequests: 4,
  requestCount: 200,
  responseBytes: 8 * MEBIBYTE,
  waitMilliseconds: 15_000,
  totalWaitMilliseconds: 30_000,
  temporaryDiskBytes: 32 * MEBIBYTE,
} as const);

export type CapacityLimits = Readonly<Record<keyof typeof SIGNED_CAPACITY_CEILINGS, number>>;

export interface CrawlProfile {
  readonly profileVersion: string;
  readonly github: Readonly<{
    apiVersion: string;
    queries: readonly Readonly<{
      id: string;
      query: string;
      sort: "committer-date";
      order: "desc";
    }>[];
  }>;
  readonly stack: Readonly<{
    release: "v2.2.0";
    revision: "e565caa3a78c2423bd374333a472b049eb090e47";
    configurations: readonly Readonly<{
      language: "Python" | "TypeScript";
      configuration: "Python" | "TypeScript";
      extensions: readonly string[];
    }>[];
  }>;
  readonly markers: readonly string[];
  readonly licenses: readonly string[];
  readonly templates: Readonly<{
    provenance: Readonly<{
      prompt: string;
      recordedCandidate: string;
      unrecordedCandidate: string;
      clues: readonly string[];
      recordedEvidence: string;
      unrecordedEvidence: string;
      explanation: string;
    }>;
    language: Readonly<{
      prompt: string;
      clues: readonly string[];
      evidence: string;
      explanation: string;
    }>;
  }>;
  readonly ordering: Readonly<{
    github: readonly ["queryIndex", "committerDateDescending", "repository", "commit", "path", "blob"];
    stack: readonly ["configurationIndex", "stableRowId", "repository", "revision", "path", "blob"];
  }>;
  readonly deduplication: readonly [
    "repository", "commit", "path", "blob", "rawContentHash", "excerptHash",
  ];
  readonly capacity: CapacityLimits;
  readonly screening: Readonly<{ excerptBytes: number; minimumExcerptBytes: number }>;
  readonly selection: Readonly<{ provenanceRounds: 3; languageRounds: 2 }>;
}

export class CrawlProfileError extends Error {
  public constructor() {
    super("CRAWL_PROFILE_REJECTED");
    this.name = "CrawlProfileError";
  }
}

type UnknownRecord = Record<string, unknown>;
const fail = (): never => { throw new CrawlProfileError(); };
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactRecord = (value: unknown, keys: readonly string[]): UnknownRecord => {
  if (!isRecord(value)) return fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
  return value;
};

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

const deepFreeze = <T>(value: T, seen = new Set<object>()): DeepReadonly<T> => {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value) as DeepReadonly<T>;
};

const text = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) return fail();
  return value;
};

const integer = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) return fail();
  return value as number;
};

const stackLanguage = (value: unknown): "Python" | "TypeScript" => {
  if (value !== "Python" && value !== "TypeScript") return fail();
  return value;
};

const scanForbidden = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value === "string") {
    if (/https?:\/\//iu.test(value)) fail();
    if (/(?:authorization|cookie|credential|password|secret|token|aws[_-]?(?:access[_-]?key|secret[_-]?access[_-]?key|session[_-]?token))\s*(?::|=)\s*\S+/iu.test(value)) fail();
    if (/\bbearer\s+[a-z0-9._~+\/-]{4,}/iu.test(value)) fail();
  }
  if (!isRecord(value) && !Array.isArray(value)) return;
  if (seen.has(value as object)) fail();
  seen.add(value as object);
  for (const [key, nested] of Object.entries(value as UnknownRecord)) {
    if (/(?:credential|password|secret|token|authorization|cookie|url|endpoint)/iu.test(key)) fail();
    scanForbidden(nested, seen);
  }
  seen.delete(value as object);
};

const exactTexts = <Values extends readonly string[]>(
  value: unknown,
  expected: Values,
): Values => {
  if (!Array.isArray(value) || value.length !== expected.length) return fail();
  if (value.some((entry, index) => entry !== expected[index])) fail();
  return Object.freeze([...expected]) as unknown as Values;
};

const uniqueTexts = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) return fail();
  const values = value.map(text);
  if (new Set(values).size !== values.length) fail();
  return Object.freeze(values);
};

const parseQueries = (value: unknown): CrawlProfile["github"]["queries"] => {
  if (!Array.isArray(value) || value.length === 0) return fail();
  const queries = value.map((entry) => {
    const item = exactRecord(entry, ["id", "query", "sort", "order"]);
    if (item.sort !== "committer-date" || item.order !== "desc") fail();
    return Object.freeze({
      id: text(item.id),
      query: text(item.query),
      sort: "committer-date" as const,
      order: "desc" as const,
    });
  });
  if (new Set(queries.map(({ id }) => id)).size !== queries.length) fail();
  return Object.freeze(queries);
};

const parseConfigurations = (value: unknown): CrawlProfile["stack"]["configurations"] => {
  if (!Array.isArray(value) || value.length !== 2) return fail();
  const configurations = value.map((entry) => {
    const item = exactRecord(entry, ["language", "configuration", "extensions"]);
    const language = stackLanguage(item.language);
    if (item.configuration !== language) fail();
    const extensions = uniqueTexts(item.extensions);
    if (extensions.some((extension) => !/^\.[a-z]+$/u.test(extension))) fail();
    return Object.freeze({ language, configuration: language, extensions });
  });
  if (configurations[0]?.language !== "Python" || configurations[1]?.language !== "TypeScript") fail();
  return Object.freeze(configurations);
};

const parseCapacity = (value: unknown): CapacityLimits => {
  const keys = Object.keys(SIGNED_CAPACITY_CEILINGS) as (keyof CapacityLimits)[];
  const item = exactRecord(value, keys);
  const capacity = Object.fromEntries(keys.map((key) => {
    const parsed = integer(item[key]);
    if (parsed > SIGNED_CAPACITY_CEILINGS[key]) fail();
    return [key, parsed];
  })) as Record<keyof CapacityLimits, number>;
  return Object.freeze(capacity);
};

const parseTemplates = (value: unknown): CrawlProfile["templates"] => {
  const templates = exactRecord(value, ["provenance", "language"]);
  const provenance = exactRecord(templates.provenance, [
    "prompt", "recordedCandidate", "unrecordedCandidate", "clues", "recordedEvidence",
    "unrecordedEvidence", "explanation",
  ]);
  const language = exactRecord(templates.language, ["prompt", "clues", "evidence", "explanation"]);
  return Object.freeze({
    provenance: Object.freeze({
      prompt: text(provenance.prompt),
      recordedCandidate: text(provenance.recordedCandidate),
      unrecordedCandidate: text(provenance.unrecordedCandidate),
      clues: uniqueTexts(provenance.clues),
      recordedEvidence: text(provenance.recordedEvidence),
      unrecordedEvidence: text(provenance.unrecordedEvidence),
      explanation: text(provenance.explanation),
    }),
    language: Object.freeze({
      prompt: text(language.prompt),
      clues: uniqueTexts(language.clues),
      evidence: text(language.evidence),
      explanation: text(language.explanation),
    }),
  });
};

const parseOrdering = (value: unknown): CrawlProfile["ordering"] => {
  const ordering = exactRecord(value, ["github", "stack"]);
  return Object.freeze({
    github: exactTexts(ordering.github, [
      "queryIndex", "committerDateDescending", "repository", "commit", "path", "blob",
    ] as const),
    stack: exactTexts(ordering.stack, [
      "configurationIndex", "stableRowId", "repository", "revision", "path", "blob",
    ] as const),
  });
};

export const parseCrawlProfile = (value: unknown): CrawlProfile => {
  scanForbidden(value);
  const root = exactRecord(value, [
    "profileVersion", "github", "stack", "markers", "licenses", "templates",
    "ordering", "deduplication", "capacity", "screening", "selection",
  ]);
  const github = exactRecord(root.github, ["apiVersion", "queries"]);
  const stack = exactRecord(root.stack, ["release", "revision", "configurations"]);
  const screening = exactRecord(root.screening, ["excerptBytes", "minimumExcerptBytes"]);
  const selection = exactRecord(root.selection, ["provenanceRounds", "languageRounds"]);
  if (stack.release !== "v2.2.0" || stack.revision !== "e565caa3a78c2423bd374333a472b049eb090e47") fail();
  if (selection.provenanceRounds !== 3 || selection.languageRounds !== 2) fail();
  const excerptBytes = integer(screening.excerptBytes);
  const minimumExcerptBytes = integer(screening.minimumExcerptBytes);
  if (minimumExcerptBytes > excerptBytes) fail();
  return deepFreeze({
    profileVersion: text(root.profileVersion),
    github: Object.freeze({ apiVersion: text(github.apiVersion), queries: parseQueries(github.queries) }),
    stack: Object.freeze({
      release: "v2.2.0",
      revision: "e565caa3a78c2423bd374333a472b049eb090e47",
      configurations: parseConfigurations(stack.configurations),
    }),
    markers: uniqueTexts(root.markers),
    licenses: uniqueTexts(root.licenses),
    templates: parseTemplates(root.templates),
    ordering: parseOrdering(root.ordering),
    deduplication: exactTexts(root.deduplication, [
      "repository", "commit", "path", "blob", "rawContentHash", "excerptHash",
    ] as const),
    capacity: parseCapacity(root.capacity),
    screening: Object.freeze({ excerptBytes, minimumExcerptBytes }),
    selection: Object.freeze({ provenanceRounds: 3, languageRounds: 2 }),
  });
};
