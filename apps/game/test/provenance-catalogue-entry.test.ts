import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { PromotedH001Record } from "../../../packages/content/src/index.js";
import {
  ProvenanceCatalogueEntryError,
  createProvenanceCatalogueEntry,
} from "../src/server/content/catalogue/provenance-entry.js";

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

const excerpt = "export const answer = assistedLookup(input);";
const contentHash = createHash("sha256").update(excerpt).digest("hex");
const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
};

function promoted(
  classification: "AGENT_RECORDED" | "NAMED_MODEL_RECORDED" = "AGENT_RECORDED",
): PromotedH001Record {
  const named = classification === "NAMED_MODEL_RECORDED";
  return deepFreeze({
    status: "PROMOTED_H001",
    mode: "provenance",
    sourceClass: "licensed-github",
    purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
    promotionIdentifier: "fixture-promotion-provenance-1",
    promotionReceipt: {
      status: "PROMOTED_H001",
      promotionIdentifier: "fixture-promotion-provenance-1",
      mode: "provenance",
      sourceClass: "licensed-github",
      purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
      draftHash: "d".repeat(64),
      catalogueHash: "e".repeat(64),
      roundId: "fixture-round-provenance-1",
      roundVersionId: "fixture-round-provenance-v1",
      contentStableId: "fixture-provenance-1",
      contentHash,
      contentVersionId: "fixture-content-provenance-v1",
      evidenceVersionId: "fixture-evidence-provenance-v1",
    },
    content: {
      stableId: "fixture-provenance-1", hash: contentHash,
      versionId: "fixture-content-provenance-v1", excerpt,
    },
    round: {
      roundId: "fixture-round-provenance-1",
      roundVersionId: "fixture-round-provenance-v1",
      prompt: "Is an AI coding agent durably recorded as participating in this code change?",
      candidates: [
        {
          candidateId: "RECORDED_AGENT_PARTICIPATION",
          label: "RECORDED_AGENT_PARTICIPATION",
        },
        {
          candidateId: "PROJECT_CONTROLLED_HUMAN_ONLY",
          label: "PROJECT_CONTROLLED_HUMAN_ONLY",
        },
      ],
      correctCandidateId: "RECORDED_AGENT_PARTICIPATION",
      clues: [
        { order: 1, label: "Consider the kind of durable record being tested." },
        { order: 2, label: "Code style alone is not evidence." },
      ],
      versions: {
        candidateSet: "fixture-provenance-candidates-v1",
        clueSet: "fixture-provenance-clues-v1", scoring: "scoring-v1",
        rules: "rules-v1", renderer: "renderer-v1",
        reveal: "fixture-provenance-reveal-v1",
        modeContract: "provenance-contract-v1",
        calibration: "fixture-provenance-calibration-v1",
        sourceRegime: "licensed-github-vs-project-controlled-v1",
      },
    },
    reveal: {
      evidence: named
        ? "The accepted durable record names Claude 4.1."
        : "The accepted durable record names an AI coding agent.",
      attribution: "Vendor Agent Bot; owner/repo, MIT",
      sourceIdentity: "owner/repo",
      sourceUrl: `https://github.com/owner/repo/blob/${"1".repeat(40)}/src/code.ts`,
      helpfulSignals: ["The answer follows accepted repository evidence."],
      misleadingSignals: ["Style does not establish participation."],
      versions: {
        content: contentHash, evidence: "fixture-evidence-provenance-v1",
        candidateSet: "fixture-provenance-candidates-v1", scoring: "scoring-v1",
        rules: "rules-v1", reveal: "fixture-provenance-reveal-v1",
      },
    },
    provenance: {
      classification,
      recordedModelName: named ? "Claude 4.1" : null,
      publicClaim: named ? "Claude 4.1" : "AI coding agent",
    },
  });
}

function projectControlledNegative() {
  const positive = structuredClone(promoted()) as unknown as Record<string, unknown>;
  const round = positive.round as Record<string, unknown>;
  const reveal = positive.reveal as Record<string, unknown>;
  round.correctCandidateId = "PROJECT_CONTROLLED_HUMAN_ONLY";
  reveal.evidence =
    "The identified creator affirmatively attests no AI coding agent participated.";
  reveal.attribution = "Commissioned and controlled by the CodeGuessr project.";
  reveal.sourceIdentity = "CodeGuessr project";
  reveal.sourceUrl = null;
  return deepFreeze({
    ...positive,
    sourceClass: "project-owned-human",
    purpose: "PROJECT_CONTROLLED_HUMAN_ONLY",
    promotionReceipt: null,
    round,
    reveal,
    provenance: {
      classification: "PROJECT_CONTROLLED_HUMAN_ONLY",
      recordedModelName: null,
      publicClaim:
        "No AI coding agent participation is affirmatively recorded for this project-controlled change.",
      creationOrCommissionBasis: "Commissioned under the project contributor agreement.",
      recordedProjectAuthorization: "project-authorization-v1",
      noAgentParticipationAttestation:
        "The identified creator affirmatively attests no AI coding agent participated.",
    },
  });
}

describe("Revision 7 provenance catalogue adapter", () => {
  it("keeps source, answer, agent identity and evidence out of the public round", () => {
    const entry = createProvenanceCatalogueEntry(promoted());
    expect(entry.status).toBe("APPROVED_PROVENANCE_CATALOGUE_ENTRY");
    expect(entry.publicRound.mode.candidates).toEqual([
      {
        candidateId: "RECORDED_AGENT_PARTICIPATION",
        label: "RECORDED_AGENT_PARTICIPATION",
      },
      {
        candidateId: "PROJECT_CONTROLLED_HUMAN_ONLY",
        label: "PROJECT_CONTROLLED_HUMAN_ONLY",
      },
    ]);
    expect(JSON.stringify(entry.publicRound)).not.toMatch(
      /correctCandidate|sourceIdentity|sourceUrl|github|attribution|recordedModelName|classification|publicClaim|approvedEvidence|agent bot|owner\/repo/iu,
    );
  });

  it("keeps a generic claim generic while preserving separate account attribution", () => {
    const entry = createProvenanceCatalogueEntry(promoted());
    expect(entry.serverReveal.correctCandidateId)
      .toBe("RECORDED_AGENT_PARTICIPATION");
    expect(entry.serverReveal.classification).toBe("AGENT_RECORDED");
    expect(entry.serverReveal.recordedModelName).toBe(null);
    expect(entry.serverReveal.publicClaim).toBe("AI coding agent");
    expect(entry.serverReveal.attribution).toBe("Vendor Agent Bot; owner/repo, MIT");
  });

  it("reveals an exact named model only for NAMED_MODEL_RECORDED", () => {
    const entry = createProvenanceCatalogueEntry(promoted("NAMED_MODEL_RECORDED"));
    expect(entry.serverReveal.classification).toBe("NAMED_MODEL_RECORDED");
    expect(entry.serverReveal.recordedModelName).toBe("Claude 4.1");
    expect(entry.serverReveal.publicClaim).toBe("Claude 4.1");
  });

  it("accepts only an affirmatively evidenced project-controlled negative", () => {
    const entry = createProvenanceCatalogueEntry(projectControlledNegative());
    expect(entry.serverReveal.correctCandidateId)
      .toBe("PROJECT_CONTROLLED_HUMAN_ONLY");
    expect(entry.serverReveal.classification).toBe("PROJECT_CONTROLLED_HUMAN_ONLY");
    expect(entry.serverReveal.recordedModelName).toBe(null);
    expect(entry.serverReveal.publicClaim).toBe(
      "No AI coding agent participation is affirmatively recorded for this project-controlled change.",
    );
    const incomplete = structuredClone(projectControlledNegative()) as Record<string, unknown>;
    delete (incomplete.provenance as Record<string, unknown>)
      .noAgentParticipationAttestation;
    expect(() => createProvenanceCatalogueEntry(deepFreeze(incomplete)))
      .toThrow(ProvenanceCatalogueEntryError);
  });

  it("rejects semantic upgrades, candidate drift, wrong mode and mutable handoffs", () => {
    const generic = promoted();
    expect(() => createProvenanceCatalogueEntry(deepFreeze({
      ...generic,
      provenance: { ...generic.provenance!, recordedModelName: "inferred-model" },
    }))).toThrow(ProvenanceCatalogueEntryError);
    expect(() => createProvenanceCatalogueEntry(deepFreeze({
      ...generic,
      round: {
        ...generic.round,
        candidates: [...generic.round.candidates].reverse(),
      },
    }))).toThrow(ProvenanceCatalogueEntryError);
    expect(() => createProvenanceCatalogueEntry(deepFreeze({
      ...generic, mode: "language", purpose: "LANGUAGE_CANDIDATE",
    }))).toThrow(ProvenanceCatalogueEntryError);
    expect(() => createProvenanceCatalogueEntry(structuredClone(generic)))
      .toThrow(ProvenanceCatalogueEntryError);
  });

  it("has no acquisition or telemetry dependency and remains server-only", () => {
    const source = readFileSync(
      new URL("../src/server/content/catalogue/provenance-entry.ts", import.meta.url),
      "utf8",
    );
    const serverEntry = readFileSync(
      new URL("../src/server/content/catalogue/index.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /\/acquisition|operator\/acquisition|rawSnapshot|token|measurement|telemetry/iu,
    );
    expect(serverEntry).toMatch(/^import "server-only";/u);
  });
});
