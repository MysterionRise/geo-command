import { createHash } from "node:crypto";

import { appendAuditEvent } from "./audit";
import {
  acquireAuthorizedCommitReceipt,
  AuthorizedSourceError,
} from "./authorized-source";
import { BoundedGitHubTransport } from "../github/transport";
import {
  authorizeOperatorRun,
  READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
} from "../policy/operator-authorization";
import { authorizePolicy, canonicalSha256 } from "../policy/policy-register";
import {
  AcquisitionOrchestrationError,
  orchestrateAcquisitionDraft,
} from "./orchestrate-draft";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;

const receiptTime = "2026-07-27T20:00:00Z";
const githubDate = "Mon, 27 Jul 2026 20:00:00 GMT";
const childCommit = "a".repeat(40);
const parentCommit = "b".repeat(40);
const marker = "Co-authored-by: Claude <noreply@anthropic.com>";
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const blobSha = (value: Uint8Array): string =>
  createHash("sha1").update(`blob ${value.byteLength}\0`).update(value).digest("hex");
interface Entry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
}
const treeSha = (entries: readonly Entry[]): string => {
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
  const body = Buffer.concat(encoded);
  return createHash("sha1").update(`tree ${body.byteLength}\0`).update(body).digest("hex");
};
const tree = (entries: readonly Entry[]) => ({
  sha: treeSha(entries),
  truncated: false,
  tree: entries,
});

const controls = (purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE") => {
  const repositoryPolicy = {
    policyClass: "REPOSITORY_ADMISSION",
    policyVersion: "repository-v1",
    permittedPurposes: [purpose],
    repositories: [{ repository: "owner/repo", approvedSubtrees: ["src"] }],
  };
  const attributionPolicy = {
    policyClass: "ATTRIBUTION_MARKER",
    policyVersion: "markers-v1",
    permittedPurposes: [purpose],
    rules: [{
      ruleId: "claude-coauthor-v1",
      purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
      kind: "marker",
      exactMarker: marker,
      classification: "NAMED_MODEL_RECORDED",
      modelName: "Claude",
      documentation: {
        publisher: "Anthropic",
        url: "https://example.test/claude-code",
        capturedAt: receiptTime,
        contentHash: "d".repeat(64),
        productVersion: "1",
        expectedGitRepresentation: marker,
      },
    }],
  };
  const entry = (
    policy: typeof repositoryPolicy | typeof attributionPolicy,
    entryId: string,
  ) => ({
    entryId,
    policyClass: policy.policyClass,
    policyVersion: policy.policyVersion,
    policyHash: canonicalSha256(policy),
    permittedPurposes: [purpose],
    validFrom: receiptTime,
    approvals: [
      { role: "Don", approverId: "don", approvedAt: receiptTime },
      { role: "Rights/Safety Reviewer", approverId: "rights", approvedAt: receiptTime },
    ],
  });
  const register = {
    registerVersion: "policies-v1",
    entries: [
      entry(repositoryPolicy, "repository-entry"),
      entry(attributionPolicy, "attribution-entry"),
    ],
  };
  const authorize = (
    policy: typeof repositoryPolicy | typeof attributionPolicy,
    entryId: string,
  ) => authorizePolicy({
    policy,
    register: register as never,
    binding: {
      registerVersion: register.registerVersion,
      registerHash: canonicalSha256(register),
      entryId,
    },
    purpose,
    authoritativeReceiptTime: receiptTime,
  });
  const operatorRegister = {
    registerVersion: "operators-v1",
    entries: [{
      entryId: "operator-entry",
      operatorName: "Operator",
      osIdentity: "uid:1",
      repositories: ["owner/repo"],
      purposes: [purpose],
      tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
      validFrom: receiptTime,
      approvals: [
        { role: "Release Operator", approverId: "release", approvedAt: receiptTime },
        { role: "Security Reviewer", approverId: "security", approvedAt: receiptTime },
      ],
    }],
  };
  const operatorAuthorization = {
    register: operatorRegister as never,
    binding: {
      registerVersion: operatorRegister.registerVersion,
      registerHash: canonicalSha256(operatorRegister),
      entryId: "operator-entry",
    },
    operatorName: "Operator",
    osIdentity: "uid:1",
    repository: "owner/repo",
    purpose,
    tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
    callerObservationTime: receiptTime,
    authoritativeReceiptTime: receiptTime,
    githubDate,
    commit: childCommit,
    subtree: "src",
  };
  const operatorRun = authorizeOperatorRun(operatorAuthorization);
  return {
    repositoryPolicy: authorize(repositoryPolicy, "repository-entry"),
    attributionPolicy: authorize(attributionPolicy, "attribution-entry"),
    attributionPolicyDocument: attributionPolicy,
    operatorAuthorization,
    operatorRun,
  };
};

const fixture = async (
  purpose: "LANGUAGE_CANDIDATE" | "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
  childText = "export const answer: number = 42;\n",
  includeLicense = true,
  recordedMarker = marker,
) => {
  const parentBytes = bytes("export const answer: number = 41;\n");
  const childBytes = bytes(childText);
  const licenseBytes = bytes("MIT License\n");
  const parentBlob = blobSha(parentBytes);
  const childBlob = blobSha(childBytes);
  const licenseBlob = blobSha(licenseBytes);
  const parentSubtree = tree([
    { path: "answer.ts", mode: "100644", type: "blob", sha: parentBlob },
  ]);
  const childSubtree = tree([
    { path: "answer.ts", mode: "100644", type: "blob", sha: childBlob },
  ]);
  const parentRoot = tree([
    { path: "src", mode: "040000", type: "tree", sha: parentSubtree.sha },
  ]);
  const childRoot = tree([
    ...(includeLicense
      ? [{ path: "LICENSE", mode: "100644", type: "blob", sha: licenseBlob }]
      : []),
    { path: "src", mode: "040000", type: "tree", sha: childSubtree.sha },
  ] as Entry[]);
  const trees = new Map([
    [parentSubtree.sha, parentSubtree],
    [childSubtree.sha, childSubtree],
    [parentRoot.sha, parentRoot],
    [childRoot.sha, childRoot],
  ]);
  const blobs = new Map([
    [parentBlob, parentBytes],
    [childBlob, childBytes],
    [licenseBlob, licenseBytes],
  ]);
  const authorization = controls(purpose);
  const request = {
    repository: "owner/repo",
    subtree: "src",
    commit: childCommit,
    purpose,
    observationTime: receiptTime,
  } as const;
  const certified = await acquireAuthorizedCommitReceipt({
    request,
    repositoryPolicy: authorization.repositoryPolicy,
    attributionPolicy: authorization.attributionPolicy,
    preflightOperatorRun: authorization.operatorRun,
    operatorAuthorization: authorization.operatorAuthorization,
    transport: new BoundedGitHubTransport({
      fetch: async (request) => {
        if (request.url.endsWith(`/commits/${childCommit}`)) {
          return new Response(JSON.stringify({
            sha: childCommit,
            parents: [{ sha: parentCommit }],
            commit: {
              message: `Implement answer\n\n${recordedMarker}`,
              tree: { sha: childRoot.sha },
              verification: { verified: true, reason: "valid" },
              author: { name: "Developer" },
              committer: { name: "Developer" },
            },
            author: { login: "developer", type: "User" },
            committer: { login: "developer", type: "User" },
          }), { headers: { date: githubDate } });
        }
        if (request.url.endsWith(`/commits/${parentCommit}`)) {
          return new Response(JSON.stringify({
            sha: parentCommit,
            commit: { tree: { sha: parentRoot.sha } },
          }));
        }
        if (request.url === "https://api.github.com/repos/owner/repo") {
          return new Response(JSON.stringify({
            node_id: "R_kgDOExample",
            full_name: "owner/repo",
            visibility: "public",
            private: false,
            archived: false,
            disabled: false,
            license: { spdx_id: "MIT" },
          }));
        }
        throw new Error("unexpected source endpoint");
      },
    }),
  });
  const stored: string[] = [];
  const removed: string[] = [];
  const plaintexts = new Map<string, Uint8Array>();
  let audit: readonly Readonly<Record<string, unknown>>[] = [];
  const input = {
    logicalRunId: "f".repeat(64),
    resuming: false,
    receipt: certified.receipt,
    ...authorization,
    operatorRun: certified.operatorRun,
    loadTree: async (sha: string) => trees.get(sha) ?? Promise.reject(new Error("tree canary")),
    loadBlob: async (sha: string) => blobs.get(sha) ?? Promise.reject(new Error("blob canary")),
    store: {
      put: async ({
        identity,
        plaintext,
      }: {
        identity: { objectId: string };
        plaintext: Uint8Array;
      }) => {
        stored.push(identity.objectId);
        plaintexts.set(identity.objectId, new Uint8Array(plaintext));
        return { identity, created: true };
      },
      remove: async (identity: { objectId: string }) => {
        const index = stored.indexOf(identity.objectId);
        if (index < 0) return false;
        stored.splice(index, 1);
        plaintexts.delete(identity.objectId);
        removed.push(identity.objectId);
        return true;
      },
    },
    audit: {
      append: async (event: unknown) => {
        audit = appendAuditEvent(audit, event);
        return audit;
      },
    },
    checkpointVerifiedObject: () => undefined,
  };
  return {
    input, stored, removed, plaintexts, audit: () => audit,
    childBytes, parentBytes, licenseBytes,
  };
};

describe("authorized offline acquisition orchestration", () => {
  it("builds a deterministic quarantined language draft through real core boundaries", async () => {
    const value = await fixture(
      "LANGUAGE_CANDIDATE",
      "export const answer: number = 42;\r\n",
    );
    const result = await orchestrateAcquisitionDraft(value.input as never);
    expect(result.draft.state).toBe("DRAFT_REVIEW_REQUIRED");
    expect(result.draft.input.source.path).toBe("src/answer.ts");
    expect(result.draft.input.languageProposal).toEqual({
      decision: "HUMAN_REVIEW_REQUIRED",
      detectorVersion: "extension-map-v1",
      proposalHash: canonicalSha256({
        detectorVersion: "extension-map-v1",
        path: "src/answer.ts",
        proposedLanguage: "TypeScript",
      }),
      proposedLanguage: "TypeScript",
    });
    expect(result.draft.input.diff).toBe(null);
    expect(result.checkpoint.rootTree).toBe(value.input.receipt.childTreeSha);
    expect(result.checkpoint.verifiedObjects).toHaveLength(7);
    expect(result.artifacts.draft.plaintextSha256).toBe(result.artifacts.draft.objectId);
    expect(result.artifacts.checkpoint.plaintextSha256)
      .toBe(result.artifacts.checkpoint.objectId);
    expect(result.artifacts.index.plaintextSha256).toBe(result.artifacts.index.objectId);
    expect(result.artifacts.draft.objectId).not.toBe(result.draft.draftHash);
    expect(result.artifacts.checkpoint.objectId).not.toBe(result.checkpoint.checkpointHash);
    expect(JSON.parse(new TextDecoder().decode(
      value.plaintexts.get(result.artifacts.index.objectId),
    ))).toEqual({
      version: 1,
      status: "DRAFT_REVIEW_REQUIRED",
      draftId: result.draft.draftId,
      draftHash: result.draft.draftHash,
      checkpointHash: result.checkpoint.checkpointHash,
      artifactObjects: {
        draft: result.artifacts.draft,
        checkpoint: result.artifacts.checkpoint,
      },
    });
    expect(value.stored).toHaveLength(10);
    expect(value.stored).toEqual(expect.arrayContaining([
      sha256(value.childBytes),
      sha256(value.parentBytes),
      sha256(value.licenseBytes),
    ]));
    const eventTypes = value.audit().map((event) => event.eventType);
    expect(eventTypes[0]).toBe("RUN_STARTED");
    expect(eventTypes.filter((eventType) => eventType === "RAW_OBJECT_CREATED"))
      .toHaveLength(7);
    expect(eventTypes.at(-1)).toBe("DRAFT_COMPLETED");
    expect(value.audit().at(-1)?.subjectHash).toBe(result.artifacts.index.objectId);
    expect(Object.isFrozen(result)).toBe(true);
    expect("promote" in result.draft).toBe(false);
  });

  it("builds a changed-line-bound named-model participation draft", async () => {
    const value = await fixture("RECORDED_AGENT_PARTICIPATION_CANDIDATE");
    const result = await orchestrateAcquisitionDraft(value.input as never);
    expect(result.draft.input.languageProposal).toBe(null);
    expect(result.draft.input.diff).toMatchObject({
      algorithmVersion: "line-sequence-v1",
      changedLineNumbers: [1],
      childBlob: blobSha(value.childBytes),
      parentBlob: blobSha(value.parentBytes),
    });
    expect(result.draft.input.attribution.evidence).toMatchObject({
      kind: "NAMED_MODEL_RECORDED",
      classification: "NAMED_MODEL_RECORDED",
      modelName: "Claude",
      publicPhrase: "Claude",
      parsedMarker: marker,
      vendorSessionDecision: "NOT_APPLICABLE",
    });
  });

  it("rejects mismatched authorization receipts before objects, storage, or audit", async () => {
    const value = await fixture("LANGUAGE_CANDIDATE");
    let objectCalls = 0;
    const error = await orchestrateAcquisitionDraft({
      ...value.input,
      receipt: { ...value.input.receipt, repositoryPolicyHash: "f".repeat(64) },
      loadTree: async (...args: [string]) => {
        objectCalls += 1;
        return value.input.loadTree(...args);
      },
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("AUTHORIZATION_BINDING_REJECTED");
    expect(objectCalls).toBe(0);
    expect(value.stored).toEqual([]);
    expect(value.audit()).toEqual([]);
  });

  it("never persists a secret-bearing candidate and returns only a categorical error", async () => {
    const value = await fixture(
      "LANGUAGE_CANDIDATE",
      'export const apiKey = "ghp_abcdefghijklmnopqrstuvwxyz123456";\n',
    );
    const error = await orchestrateAcquisitionDraft(value.input as never)
      .catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("NO_ELIGIBLE_CANDIDATE");
    expect(value.stored).toEqual([]);
    expect(JSON.stringify(value.audit())).not.toContain("ghp_");
  });

  it("preserves a pre-existing reused object during terminal rollback", async () => {
    const value = await fixture(
      "LANGUAGE_CANDIDATE",
      'export const token = "ghp_abcdefghijklmnopqrstuvwxyz123456";\n',
    );
    const tree = await value.input.loadTree(value.input.receipt.childTreeSha);
    const plaintext = bytes(JSON.stringify(tree));
    const objectId = sha256(plaintext);
    const error = await orchestrateAcquisitionDraft({
      ...value.input,
      resuming: true,
      resumeObjects: [{
        kind: "tree",
        gitSha: value.input.receipt.childTreeSha,
        createdByRun: false,
        snapshot: {
          objectId,
          plaintextSha256: objectId,
          byteLength: plaintext.byteLength,
        },
        plaintext,
      }],
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("NO_ELIGIBLE_CANDIDATE");
    expect(value.removed).not.toContain(objectId);
  });

  it("rejects unrecognized attribution evidence before persistence", async () => {
    const value = await fixture(
      "RECORDED_AGENT_PARTICIPATION_CANDIDATE",
      undefined,
      true,
      "Co-authored-by: Unknown <unknown@example.test>",
    );
    const error = await orchestrateAcquisitionDraft(value.input as never)
      .catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("ATTRIBUTION_EVIDENCE_REJECTED");
    expect(value.stored).toEqual([]);
  });

  it("rejects a byte-identical structural receipt lookalike before object access", async () => {
    const value = await fixture("LANGUAGE_CANDIDATE");
    let objectCalls = 0;
    const error = await orchestrateAcquisitionDraft({
      ...value.input,
      receipt: JSON.parse(JSON.stringify(value.input.receipt)),
      loadTree: async (...args: [string]) => {
        objectCalls += 1;
        return value.input.loadTree(...args);
      },
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("AUTHORIZATION_BINDING_REJECTED");
    expect(objectCalls).toBe(0);
    expect(value.stored).toEqual([]);
  });

  it("rejects a licence blob that is not proven in the verified child tree", async () => {
    const value = await fixture("LANGUAGE_CANDIDATE", undefined, false);
    const error = await orchestrateAcquisitionDraft(value.input as never)
      .catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("LICENSE_REJECTED");
    expect(value.stored).toEqual([]);
  });

  it("rolls back a newly stored object when its audit event cannot be recorded", async () => {
    const value = await fixture("LANGUAGE_CANDIDATE");
    const error = await orchestrateAcquisitionDraft({
      ...value.input,
      audit: {
        append: async (event: any) => {
          if (event.eventType === "RAW_OBJECT_CREATED") throw new Error("audit canary");
          return value.input.audit.append(event);
        },
      },
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("AUDIT_REJECTED");
    expect(value.stored).toEqual([]);
    expect(JSON.stringify(value.audit())).not.toContain("audit canary");
  });

  it("rolls back newly stored derived artifacts when draft completion cannot be audited", async () => {
    const value = await fixture("LANGUAGE_CANDIDATE");
    const error = await orchestrateAcquisitionDraft({
      ...value.input,
      audit: {
        append: async (event: any) => {
          if (event.eventType === "DRAFT_COMPLETED") throw new Error("audit canary");
          return value.input.audit.append(event);
        },
      },
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AcquisitionOrchestrationError);
    expect(error.message).toBe("AUDIT_REJECTED");
    expect(value.stored).toEqual([]);
    expect(value.removed).toHaveLength(10);
  });

  it("rejects commit or subtree drift from the preflight run before network", async () => {
    const authorization = controls("LANGUAGE_CANDIDATE");
    let networkCalls = 0;
    const error = await acquireAuthorizedCommitReceipt({
      request: {
        repository: "owner/repo",
        subtree: "other",
        commit: "f".repeat(40),
        purpose: "LANGUAGE_CANDIDATE",
        observationTime: receiptTime,
      },
      repositoryPolicy: authorization.repositoryPolicy,
      attributionPolicy: authorization.attributionPolicy,
      preflightOperatorRun: authorization.operatorRun,
      operatorAuthorization: {
        ...authorization.operatorAuthorization,
        commit: "f".repeat(40),
        subtree: "other",
      },
      transport: new BoundedGitHubTransport({
        fetch: async () => {
          networkCalls += 1;
          throw new Error("network canary");
        },
      }),
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(AuthorizedSourceError);
    expect(error.message).toBe("SOURCE_AUTHORIZATION_REJECTED");
    expect(networkCalls).toBe(0);
  });
});
