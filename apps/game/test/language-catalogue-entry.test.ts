import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import type { PromotedH001Record } from "../../../packages/content/src/index.js";
import {
  LanguageCatalogueEntryError,
  createLanguageCatalogueEntry,
} from "../src/server/content/catalogue/language-entry.js";

interface Expectation {
  readonly not: Expectation;
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatch(expected: RegExp): void;
  toThrow(expected?: unknown): void;
}
interface TestApi {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): Expectation;
  it(name: string, callback: () => unknown): void;
}
const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as TestApi;
const contentHash = createHash("sha256")
  .update("export const answer: number = 42;")
  .digest("hex");

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
};

function promoted(): PromotedH001Record {
  return deepFreeze({
    status: "PROMOTED_H001",
    mode: "language",
    sourceClass: "licensed-github",
    purpose: "LANGUAGE_CANDIDATE",
    promotionIdentifier: "fixture-promotion-language-1",
    promotionReceipt: {
      status: "PROMOTED_H001",
      promotionIdentifier: "fixture-promotion-language-1",
      mode: "language",
      sourceClass: "licensed-github",
      purpose: "LANGUAGE_CANDIDATE",
      draftHash: "d".repeat(64),
      catalogueHash: "e".repeat(64),
      roundId: "fixture-round-language-1",
      roundVersionId: "fixture-round-language-v1",
      contentStableId: "fixture-language-1",
      contentHash,
      contentVersionId: "fixture-content-language-v1",
      evidenceVersionId: "fixture-evidence-language-v1",
    },
    content: {
      stableId: "fixture-language-1",
      hash: contentHash,
      versionId: "fixture-content-language-v1",
      excerpt: "export const answer: number = 42;",
    },
    round: {
      roundId: "fixture-round-language-1",
      roundVersionId: "fixture-round-language-v1",
      prompt: "Which language is this?",
      candidates: [
        { candidateId: "typescript", label: "TypeScript" },
        { candidateId: "javascript", label: "JavaScript" },
      ],
      correctCandidateId: "typescript",
      clues: [
        { order: 1, label: "Look at the type annotation." },
        { order: 2, label: "The runtime syntax is JavaScript-compatible." },
      ],
      versions: {
        candidateSet: "fixture-language-candidates-v1",
        clueSet: "fixture-language-clues-v1",
        scoring: "scoring-v1",
        rules: "rules-v1",
        renderer: "renderer-v1",
        reveal: "fixture-language-reveal-v1",
        modeContract: "language-contract-v1",
        calibration: "fixture-language-calibration-v1",
        sourceRegime: "licensed-github-vs-project-controlled-v1",
      },
    },
    reveal: {
      evidence: "Two qualified technical reviewers approved TypeScript.",
      attribution: "owner/repo, MIT",
      sourceIdentity: "owner/repo",
      sourceUrl: `https://github.com/owner/repo/blob/${"1".repeat(40)}/src/code.ts`,
      helpfulSignals: ["The type annotation is language-specific."],
      misleadingSignals: ["Much of the syntax is shared with JavaScript."],
      versions: {
        content: contentHash,
        evidence: "fixture-evidence-language-v1",
        candidateSet: "fixture-language-candidates-v1",
        scoring: "scoring-v1",
        rules: "rules-v1",
        reveal: "fixture-language-reveal-v1",
      },
    },
    provenance: null,
  });
}

describe("licensed-GitHub language catalogue adapter", () => {
  it("creates a frozen pre-reveal round and separate server reveal record", () => {
    const entry = createLanguageCatalogueEntry(promoted());
    expect(entry.status).toBe("APPROVED_LANGUAGE_CATALOGUE_ENTRY");
    expect(entry.publicRound.mode.kind).toBe("language");
    expect(entry.serverReveal.correctCandidateId).toBe("typescript");
    expect(entry.serverReveal.attribution).toBe("owner/repo, MIT");
    expect(Object.isFrozen(entry.publicRound.mode.candidates)).toBe(true);
    expect(JSON.stringify(entry.publicRound)).not.toMatch(
      /correctCandidate|source|github|attribution|evidence|rights|review|policy|snapshot/iu,
    );
  });

  it("preserves every candidate, clue, content and reveal version binding", () => {
    const entry = createLanguageCatalogueEntry(promoted());
    expect(entry.publicRound.versions).toEqual({
      candidateSet: "fixture-language-candidates-v1",
      clueSet: "fixture-language-clues-v1",
      scoring: "scoring-v1",
      rules: "rules-v1",
    });
    expect(entry.bindings).toEqual({
      promotionIdentifier: "fixture-promotion-language-1",
      contentStableId: "fixture-language-1",
      contentVersionId: "fixture-content-language-v1",
      contentHash,
      evidenceVersionId: "fixture-evidence-language-v1",
      rendererVersionId: "renderer-v1",
      revealVersionId: "fixture-language-reveal-v1",
      catalogueHash: "e".repeat(64),
    });
  });

  it("rejects non-language, ambiguous, drifted and non-frozen handoffs", () => {
    const valid = promoted();
    expect(() => createLanguageCatalogueEntry(deepFreeze({
      ...valid, mode: "provenance", purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    }))).toThrow(LanguageCatalogueEntryError);
    expect(() => createLanguageCatalogueEntry(deepFreeze({
      ...valid,
      round: {
        ...valid.round,
        candidates: [
          ...valid.round.candidates,
          { candidateId: "typescript", label: "TypeScript duplicate" },
        ],
      },
    }))).toThrow(LanguageCatalogueEntryError);
    expect(() => createLanguageCatalogueEntry(deepFreeze({
      ...valid,
      reveal: { ...valid.reveal, versions: { ...valid.reveal.versions, content: "b".repeat(64) } },
    }))).toThrow(LanguageCatalogueEntryError);
    expect(() => createLanguageCatalogueEntry(structuredClone(valid)))
      .toThrow(LanguageCatalogueEntryError);
  });

  it("has no acquisition/raw boundary import", () => {
    const source = readFileSync(
      new URL("../src/server/content/catalogue/language-entry.ts", import.meta.url),
      "utf8",
    );
    const serverEntry = readFileSync(
      new URL("../src/server/content/catalogue/index.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/\/acquisition|operator\/acquisition|rawSnapshot|token/iu);
    expect(serverEntry).toMatch(/^import "server-only";/u);
  });
});
