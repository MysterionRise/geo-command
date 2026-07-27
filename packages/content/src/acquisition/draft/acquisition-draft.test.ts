import { createAcquisitionDraft, DraftError, serializeAcquisitionDraft, type AcquisitionDraft } from "./acquisition-draft";
import { parseEvidenceRecord, type EvidenceRecord } from "../../evidence/records";
import type { PublicationEligibility } from "../../review/publication-eligibility";
import type { ManifestRound } from "../../../../domain/src/manifest";
import type { RoundDefinition } from "../../../../domain/src/round";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): { toBe(value: unknown): void; toEqual(value: unknown): void; toThrow(value?: unknown): void };
  it(name: string, callback: () => unknown): void;
};
const h40 = "a".repeat(40);
const parentCommit = "c".repeat(40);
const h64 = "b".repeat(64);
const parentH64 = "d".repeat(64);
const input = {
  run: { draftIdempotencyKey: h64, toolId: "acquirer", toolVersion: "1", toolHash: h64, schemaVersion: "draft-v1", schemaHash: h64 },
  source: {
    repository: "owner/repo", repositoryId: "R_1", childCommit: h40, parentCommit,
    childTree: h40, parentTree: h40, subtree: "src", path: "src/code.ts",
    childBlob: h40, parentBlob: parentCommit, sourceUrl: `https://github.com/owner/repo/blob/${h40}/src/code.ts`,
    commitUrl: `https://github.com/owner/repo/commit/${h40}`, parentRawHash: h64, childRawHash: h64,
    parentNormalizedHash: parentH64, childNormalizedHash: h64, repositoryMetadataHash: h64,
  },
  acquisition: {
    purpose: "LANGUAGE_CANDIDATE", observationTime: "2026-07-27T15:00:00Z",
    receiptTime: "2026-07-27T15:00:00Z", checkpointHash: h64,
    screeningOutcomes: ["SAFE_TEXT"], snapshotIds: ["snapshot-1"],
    retentionDeadline: "2026-08-26T15:00:00Z",
  },
  license: { identifier: "MIT", path: "LICENSE", blobSha: h40, textHash: h64, repositoryPolicyVersion: "repo-v1", repositoryPolicyHash: h64 },
  attribution: { policyVersion: "markers-v1", policyHash: h64, evidence: { kind: "LANGUAGE_ONLY_NOT_APPLICABLE" } },
  policy: { registerVersion: "policies-v1", registerHash: h64, repositoryEntryId: "repo-entry", attributionEntryId: "marker-entry" },
  operator: { name: "Operator", osIdentity: "uid:1000", registerVersion: "operators-v1", registerHash: h64, entryId: "operator-entry" },
  diff: null,
  languageProposal: { proposedLanguage: "TypeScript", detectorVersion: "detector-v1", proposalHash: h64, decision: "HUMAN_REVIEW_REQUIRED" },
} as const;

describe("quarantined acquisition draft", () => {
  it("creates byte-identical deeply frozen drafts from identical immutable input", () => {
    const first = createAcquisitionDraft(input);
    const second = createAcquisitionDraft(JSON.parse(JSON.stringify(input)));
    expect(first).toEqual(second);
    expect(serializeAcquisitionDraft(first)).toEqual(serializeAcquisitionDraft(second));
    expect(first.state).toBe("DRAFT_REVIEW_REQUIRED");
    expect(first.draftId).toBe(`draft:${h64}`);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.input.source)).toBe(true);
    expect(Object.isFrozen(first.input.acquisition.screeningOutcomes)).toBe(true);
  });

  it("accepts a complete provenance binding and deep-freezes its evidence", () => {
    const provenance = {
      ...input,
      acquisition: { ...input.acquisition, purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE" },
      languageProposal: null,
      diff: {
        algorithmVersion: "line-sequence-v1", startLine: 2, endLine: 2,
        excerptHash: h64, parentBlob: parentCommit, childBlob: h40,
        parentNormalizedHash: parentH64, childNormalizedHash: h64,
        changedLineNumbers: [2], changedLinesHash: h64,
      },
      attribution: {
        ...input.attribution,
        evidence: {
          kind: "AGENT_RECORDED", classification: "AGENT_RECORDED",
          evidenceHash: h64, commitMessageHash: h64, ruleId: "generic",
          ruleBindingHash: h64, publicPhrase: "AI coding agent",
          author: { name: "Developer", login: "developer" },
          committer: { name: "Developer", login: "developer" },
          verification: { verified: true, reason: "valid" },
          parsedMarker: "Agent-assisted-by: Vendor Agent",
          vendorSessionDecision: "NOT_APPLICABLE",
        },
      },
    } as const;
    const draft = createAcquisitionDraft(provenance);
    expect(Object.isFrozen(draft.input.diff)).toBe(true);
    expect(Object.isFrozen(draft.input.attribution.evidence)).toBe(true);
    expect(createAcquisitionDraft({
      ...provenance,
      attribution: {
        ...provenance.attribution,
        evidence: {
          ...provenance.attribution.evidence,
          parsedMarker: null,
          vendorSessionDecision: "VERIFIED_VENDOR_CONTROLLED_SESSION",
          accountAttribution: "vendor-bot",
        },
      },
    }).state).toBe("DRAFT_REVIEW_REQUIRED");
    expect(() => createAcquisitionDraft({
      ...provenance,
      source: { ...provenance.source, parentBlob: h40, parentNormalizedHash: h64 },
      diff: { ...provenance.diff, parentBlob: h40, parentNormalizedHash: h64 },
    })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({
      ...provenance,
      diff: { ...provenance.diff, endLine: 23 },
    })).toThrow("DRAFT_IDENTITY_REJECTED");
  });

  it("accepts an exact named-model marker and binds its public phrase", () => {
    const generic = {
      ...input,
      acquisition: { ...input.acquisition, purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE" },
      languageProposal: null,
      diff: {
        algorithmVersion: "line-sequence-v1", startLine: 2, endLine: 3,
        changedLineNumbers: [2, 3], changedLinesHash: h64, excerptHash: h64,
        parentBlob: parentCommit, childBlob: h40,
        parentNormalizedHash: parentH64, childNormalizedHash: h64,
      },
      attribution: {
        ...input.attribution,
        evidence: {
          kind: "NAMED_MODEL_RECORDED", classification: "NAMED_MODEL_RECORDED",
          modelName: "Claude", publicPhrase: "Claude", evidenceHash: h64,
          commitMessageHash: h64, ruleId: "claude", ruleBindingHash: h64,
          author: { name: "Developer", login: "developer" },
          committer: { name: "Developer", login: "developer" },
          verification: { verified: true, reason: "valid" },
          parsedMarker: "Co-authored-by: Claude <noreply@anthropic.com>",
          vendorSessionDecision: "NOT_APPLICABLE",
        },
      },
    } as const;
    expect(createAcquisitionDraft(generic).input.attribution.evidence).toEqual(generic.attribution.evidence);
    expect(() => createAcquisitionDraft({
      ...generic,
      attribution: {
        ...generic.attribution,
        evidence: { ...generic.attribution.evidence, publicPhrase: "a model" },
      },
    })).toThrow("DRAFT_EVIDENCE_INCOMPATIBLE");
  });

  it("rejects unknown sensitive fields, mutable refs, malformed hashes/times, and duplicates", () => {
    expect(() => createAcquisitionDraft({ ...input, token: "secret" } as never)).toThrow("DRAFT_FIELDS_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, run: { ...input.run, runId: "audit-run" } } as never)).toThrow("DRAFT_FIELDS_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, languageProposal: { ...input.languageProposal, token: "secret" } } as never)).toThrow("DRAFT_FIELDS_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, run: { ...input.run, toolId: 1 } } as never)).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, source: { ...input.source, childCommit: "main" } })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, acquisition: { ...input.acquisition, receiptTime: "bad" } })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, acquisition: { ...input.acquisition, screeningOutcomes: [] } })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, acquisition: { ...input.acquisition, screeningOutcomes: ["safe-text"] } })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, acquisition: { ...input.acquisition, snapshotIds: ["bad id"] } })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({ ...input, acquisition: { ...input.acquisition, snapshotIds: ["same", "same"] } })).toThrow("DUPLICATE_DRAFT_IDENTITY");
  });

  it("rejects mismatched canonical source URLs and paths", () => {
    for (const source of [
      { ...input.source, commitUrl: "https://github.com/other/repo/commit/a" },
      { ...input.source, sourceUrl: `${input.source.sourceUrl}?raw=1` },
      { ...input.source, path: "other/code.ts" },
    ]) expect(() => createAcquisitionDraft({ ...input, source })).toThrow("DRAFT_SOURCE_REJECTED");
  });

  it("rejects incompatible purpose evidence", () => {
    expect(() => createAcquisitionDraft({
      ...input,
      acquisition: { ...input.acquisition, purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE" },
    } as never)).toThrow("DRAFT_EVIDENCE_INCOMPATIBLE");
  });

  it("rejects unbound changed-line and provenance evidence", () => {
    const provenance = {
      ...input,
      acquisition: { ...input.acquisition, purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE" },
      languageProposal: null,
      diff: {
        algorithmVersion: "other", startLine: 2, endLine: 3,
        changedLineNumbers: [3, 2, 2], changedLinesHash: h64, excerptHash: h64,
        parentBlob: parentCommit, childBlob: h40,
        parentNormalizedHash: parentH64, childNormalizedHash: h64,
      },
      attribution: {
        ...input.attribution,
        evidence: {
          kind: "AGENT_RECORDED", classification: "AGENT_RECORDED",
          publicPhrase: "AI coding agent", evidenceHash: h64, commitMessageHash: h64,
          ruleId: "generic", ruleBindingHash: h64,
          author: { name: "Developer", login: "developer", rawCode: "secret" },
          committer: { name: "Developer", login: "developer" },
          verification: { verified: true, reason: "valid" },
          parsedMarker: "Agent-assisted-by: Vendor Agent",
          vendorSessionDecision: "NOT_APPLICABLE",
        },
      },
    } as const;
    expect(() => createAcquisitionDraft(provenance)).toThrow();
    expect(() => createAcquisitionDraft({
      ...provenance,
      diff: { ...provenance.diff, algorithmVersion: "line-sequence-v1", changedLineNumbers: [4] },
    })).toThrow("DRAFT_IDENTITY_REJECTED");
    expect(() => createAcquisitionDraft({
      ...provenance,
      diff: { ...provenance.diff, algorithmVersion: "line-sequence-v1", changedLineNumbers: [2] },
      attribution: {
        ...provenance.attribution,
        evidence: {
          ...provenance.attribution.evidence,
          author: { name: "Developer", login: "developer" },
          vendorSessionDecision: "VERIFIED_VENDOR_CONTROLLED_SESSION",
          accountAttribution: "vendor-bot",
        },
      },
    })).toThrow("DRAFT_FIELDS_REJECTED");
  });

  it("cannot validate as evidence or expose publication capabilities", () => {
    const draft = createAcquisitionDraft(input);
    expect(() => parseEvidenceRecord(draft)).toThrow();
    expect("publish" in draft).toBe(false);
    expect("promote" in draft).toBe(false);
    expect("play" in draft).toBe(false);
  });

  it("uses categorical errors only", () => {
    expect(() => createAcquisitionDraft({ ...input, rawCode: "canary" } as never)).toThrow(DraftError);
  });
});

const compileTimeQuarantine = (draft: AcquisitionDraft): void => {
  // @ts-expect-error acquisition drafts are not evidence
  const evidence: EvidenceRecord = draft;
  // @ts-expect-error acquisition drafts are not publication eligibility
  const publication: PublicationEligibility = draft;
  // @ts-expect-error acquisition drafts are not manifest rounds
  const manifest: ManifestRound = draft;
  // @ts-expect-error acquisition drafts are not playable round definitions
  const round: RoundDefinition = draft;
  void [evidence, publication, manifest, round];
};
void compileTimeQuarantine;
