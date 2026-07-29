import { createHash } from "node:crypto";

import {
  createAcquisitionDraft,
  serializeAcquisitionDraft,
  type AcquisitionDraft,
} from "../draft/acquisition-draft";
import {
  classifyAgentMarker,
  type AgentMarkerInput,
  type AgentMarkerResult,
} from "../github/agent-marker";
import { screenBlob, type ScreenedBlob } from "../github/blob-screen";
import {
  reconstructChangedLines,
  type ChangedLinesResult,
} from "../github/changed-lines";
import {
  createCheckpoint,
  type AcquisitionCheckpoint,
  type VerifiedObject,
} from "../github/checkpoint";
import { GitHubRateLimitPause } from "../github/transport";
import {
  screenLicenseEvidence,
  type LicenseAdmissionEvidence,
} from "../github/license-evidence";
import {
  resolveApprovedSubtree,
  walkApprovedTree,
  type GitTreeResponse,
} from "../github/tree-walk";
import {
  isIssuedOperatorRun,
  type AuthorizedOperatorRun,
} from "../policy/operator-authorization";
import {
  canonicalSha256,
  type AuthorizedPolicy,
} from "../policy/policy-register";
import { computeRetention } from "../storage/lifecycle";
import type { SnapshotIdentity } from "../storage/encrypted-store";
import {
  isIssuedAuthorizedCommitReceipt,
  type AuthorizedCommitReceipt,
} from "./authorized-source";
import {
  ACQUISITION_TOOL_HASH as TOOL_HASH,
  ACQUISITION_TOOL_ID as TOOL_ID,
  ACQUISITION_TOOL_VERSION as TOOL_VERSION,
} from "./tool-binding";

const SCHEMA_VERSION = "draft-v1";
const SCHEMA_HASH = canonicalSha256({
  schema: SCHEMA_VERSION,
  state: "DRAFT_REVIEW_REQUIRED",
});
const H40 = /^[0-9a-f]{40}$/u;
const H64 = /^[0-9a-f]{64}$/u;

export class AcquisitionOrchestrationError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "AcquisitionOrchestrationError";
  }
}
const fail = (code: string): never => {
  throw new AcquisitionOrchestrationError(code);
};

interface SnapshotStore {
  put(input: {
    readonly identity: SnapshotIdentity;
    readonly plaintext: Uint8Array;
  }): Promise<{ readonly identity: SnapshotIdentity; readonly created: boolean }>;
  remove(identity: SnapshotIdentity): Promise<boolean>;
}
interface AuditSink {
  append(event: unknown): Promise<readonly unknown[]>;
}
export interface ResumableGitObject {
  readonly kind: "tree" | "blob";
  readonly gitSha: string;
  readonly createdByRun: boolean;
  readonly snapshot: SnapshotIdentity;
  readonly plaintext: Uint8Array;
}
export interface AcquisitionOrchestrationInput {
  readonly logicalRunId: string;
  readonly resuming: boolean;
  readonly receipt: AuthorizedCommitReceipt;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly attributionPolicyDocument: AgentMarkerInput["policy"];
  readonly operatorRun: AuthorizedOperatorRun;
  readonly loadTree: (sha: string) => Promise<GitTreeResponse>;
  readonly loadBlob: (sha: string) => Promise<Uint8Array>;
  readonly store: SnapshotStore;
  readonly audit: AuditSink;
  readonly resumeObjects?: readonly ResumableGitObject[];
  readonly checkpointVerifiedObject: (
    object: Omit<ResumableGitObject, "plaintext">,
  ) => void;
}
export interface AcquisitionOrchestrationResult {
  readonly draft: AcquisitionDraft;
  readonly checkpoint: AcquisitionCheckpoint;
  readonly artifacts: {
    readonly draft: SnapshotIdentity;
    readonly checkpoint: SnapshotIdentity;
    readonly index: SnapshotIdentity;
  };
}

interface LoadedObjects {
  readonly treeShas: Set<string>;
  readonly trees: Map<string, GitTreeResponse>;
  readonly blobs: Map<string, Uint8Array>;
  readonly identities: Map<string, SnapshotIdentity>;
  readonly loadTree: (sha: string) => Promise<GitTreeResponse>;
  readonly loadBlob: (sha: string) => Promise<Uint8Array>;
  readonly persistVerified: (
    kind: "tree" | "blob",
    gitSha: string,
    path: string,
  ) => Promise<SnapshotIdentity | undefined>;
  readonly persistAcceptedBlob: (
    gitSha: string,
    plaintext: Uint8Array,
  ) => Promise<SnapshotIdentity>;
  readonly rollbackTraversal: () => Promise<void>;
}
interface Candidate {
  readonly path: string;
  readonly childSha: string;
  readonly parentSha: string;
  readonly child: ScreenedBlob;
  readonly parent: ScreenedBlob;
  readonly diff: ChangedLinesResult | null;
}

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const gitBlobSha = (value: Uint8Array): string =>
  createHash("sha1").update(`blob ${value.byteLength}\0`).update(value).digest("hex");
const artifactIdentity = (plaintext: Uint8Array): SnapshotIdentity => {
  const digest = sha256(plaintext);
  return Object.freeze({
    objectId: digest,
    plaintextSha256: digest,
    byteLength: plaintext.byteLength,
  });
};
const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const categorical = async <Value>(
  operation: () => Promise<Value>,
  code: string,
): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof GitHubRateLimitPause) throw error;
    if (error instanceof AcquisitionOrchestrationError) throw error;
    return fail(code);
  }
};

const validateBindings = (input: AcquisitionOrchestrationInput): void => {
  const { receipt, repositoryPolicy, attributionPolicy, operatorRun } = input;
  const commit = receipt.commit;
  const author = commit?.author;
  const committer = commit?.committer;
  const verification = commit?.verification;
  if (
    !isIssuedAuthorizedCommitReceipt(receipt)
    || receipt.status !== "AUTHORIZED_COMMIT_RECEIPT"
    || !H40.test(receipt.childSha)
    || !H40.test(receipt.parentSha)
    || receipt.childSha === receipt.parentSha
    || !H64.test(input.logicalRunId)
    || typeof input.resuming !== "boolean"
    || receipt.repository !== operatorRun.repository
    || receipt.purpose !== operatorRun.purpose
    || receipt.responseDate !== operatorRun.githubDate
    || receipt.repositoryPolicyHash !== repositoryPolicy.policyHash
    || receipt.attributionPolicyHash !== attributionPolicy.policyHash
    || receipt.operatorEntryId !== operatorRun.entryId
    || repositoryPolicy.policyClass !== "REPOSITORY_ADMISSION"
    || attributionPolicy.policyClass !== "ATTRIBUTION_MARKER"
    || repositoryPolicy.purpose !== receipt.purpose
    || attributionPolicy.purpose !== receipt.purpose
    || repositoryPolicy.registerVersion !== attributionPolicy.registerVersion
    || repositoryPolicy.registerHash !== attributionPolicy.registerHash
    || !isIssuedOperatorRun(operatorRun)
  ) fail("AUTHORIZATION_BINDING_REJECTED");
  if (
    !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u.test(receipt.subtree)
    || !H40.test(receipt.childTreeSha)
    || !H40.test(receipt.parentTreeSha)
    || !H64.test(receipt.repositoryMetadataHash)
    || typeof receipt.repositoryId !== "string" || receipt.repositoryId.length === 0
    || typeof receipt.licenseIdentifier !== "string" || receipt.licenseIdentifier.length === 0
    || typeof commit?.message !== "string" || commit.message.length === 0
    || commit.message.length > 16_384
    || typeof author?.name !== "string" || author.name.length === 0
    || typeof author.login !== "string" || author.login.length === 0
    || !["User", "Bot"].includes(author.type)
    || typeof committer?.name !== "string" || committer.name.length === 0
    || typeof committer.login !== "string" || committer.login.length === 0
    || !["User", "Bot"].includes(committer.type)
    || typeof verification?.verified !== "boolean"
    || typeof verification.reason !== "string" || verification.reason.length === 0
  ) fail("SOURCE_BINDING_REJECTED");
};

const treePlaintext = (tree: GitTreeResponse): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(tree));
const cachedTree = (plaintext: Uint8Array): GitTreeResponse => {
  try {
    return JSON.parse(
      new TextDecoder("utf8", { fatal: true }).decode(plaintext),
    ) as GitTreeResponse;
  } catch {
    return fail("RESUME_OBJECT_REJECTED");
  }
};
const objectKey = (kind: "tree" | "blob", gitSha: string): string =>
  `${kind}:${gitSha}`;

const loadedObjects = (
  input: AcquisitionOrchestrationInput,
  runId: string,
): LoadedObjects => {
  const trees = new Map<string, GitTreeResponse>();
  const blobs = new Map<string, Uint8Array>();
  const treeShas = new Set<string>();
  const identities = new Map<string, SnapshotIdentity>();
  const created: SnapshotIdentity[] = [];
  for (const object of input.resumeObjects ?? []) {
    if (
      !H40.test(object.gitSha)
      || object.plaintext.byteLength !== object.snapshot.byteLength
      || sha256(object.plaintext) !== object.snapshot.plaintextSha256
      || object.snapshot.objectId !== object.snapshot.plaintextSha256
      || typeof object.createdByRun !== "boolean"
      || identities.has(objectKey(object.kind, object.gitSha))
    ) fail("RESUME_OBJECT_REJECTED");
    const key = objectKey(object.kind, object.gitSha);
    identities.set(key, Object.freeze({ ...object.snapshot }));
    if (object.createdByRun
      && !created.some(({ objectId }) => objectId === object.snapshot.objectId)) {
      created.push(Object.freeze({ ...object.snapshot }));
    }
    if (object.kind === "tree") {
      trees.set(object.gitSha, cachedTree(object.plaintext));
      treeShas.add(object.gitSha);
    } else {
      blobs.set(object.gitSha, new Uint8Array(object.plaintext));
    }
  }
  const persist = async (
    kind: "tree" | "blob",
    gitSha: string,
    plaintext: Uint8Array,
  ): Promise<SnapshotIdentity> => {
    const key = objectKey(kind, gitSha);
    const cached = identities.get(key);
    if (cached !== undefined) return cached;
    const identity = artifactIdentity(plaintext);
    const stored = await input.store.put({ identity, plaintext });
    try {
      await appendAudit(input, auditEvent(
        input, runId, "RAW_OBJECT_CREATED", identity.objectId,
        stored.created ? "VERIFIED_OBJECT_STORED" : "VERIFIED_OBJECT_REUSED",
        identities.size,
      ));
      input.checkpointVerifiedObject({
        kind,
        gitSha,
        createdByRun: stored.created,
        snapshot: identity,
      });
    } catch (error) {
      if (stored.created) {
        const removed = await input.store.remove(identity)
          .catch(() => fail("SNAPSHOT_ROLLBACK_REJECTED"));
        if (!removed) fail("SNAPSHOT_ROLLBACK_REJECTED");
      }
      throw error;
    }
    identities.set(key, identity);
    if (stored.created) created.push(identity);
    if (kind === "tree") treeShas.add(gitSha);
    return identity;
  };
  const loaded: LoadedObjects = {
    trees,
    blobs,
    treeShas,
    identities,
    loadTree: async (sha) => {
      const cached = trees.get(sha);
      if (cached !== undefined) return cached;
      const value = await input.loadTree(sha);
      trees.set(sha, value);
      return value;
    },
    loadBlob: async (sha) => {
      const cached = blobs.get(sha);
      if (cached !== undefined) return cached;
      const value = await input.loadBlob(sha);
      if (!(value instanceof Uint8Array)) fail("OBJECT_ACQUISITION_REJECTED");
      const copy = new Uint8Array(value);
      blobs.set(sha, copy);
      return copy;
    },
    persistVerified: async (kind, gitSha, path) => {
      const key = objectKey(kind, gitSha);
      const cached = identities.get(key);
      if (cached !== undefined) return cached;
      if (kind === "blob") {
        try {
          screenBlob({
            path,
            bytes: blobs.get(gitSha) ?? fail("OBJECT_CHECKPOINT_REJECTED"),
          }, new Set());
        } catch {
          return undefined;
        }
      }
      const plaintext = kind === "tree"
        ? treePlaintext(trees.get(gitSha) ?? fail("OBJECT_CHECKPOINT_REJECTED"))
        : new Uint8Array(
          blobs.get(gitSha) ?? fail("OBJECT_CHECKPOINT_REJECTED"),
        );
      return persist(kind, gitSha, plaintext);
    },
    persistAcceptedBlob: (gitSha, plaintext) =>
      persist("blob", gitSha, new Uint8Array(plaintext)),
    rollbackTraversal: async () => {
      let removalFailed = false;
      for (const [ordinal, identity] of [...created].reverse().entries()) {
        const removed = await input.store.remove(identity)
          .catch(() => false);
        if (!removed) {
          removalFailed = true;
          continue;
        }
        await input.audit.append(auditEvent(
          input, runId, "RAW_OBJECT_DELETED", identity.objectId,
          "TERMINAL_REJECTION_ROLLBACK", ordinal,
        )).catch(() => undefined);
      }
      created.length = 0;
      if (removalFailed) fail("SNAPSHOT_ROLLBACK_REJECTED");
    },
  };
  return loaded;
};

const walkRevision = async (
  rootTreeSha: string,
  subtree: string,
  objects: LoadedObjects,
) => {
  const resolved = await resolveApprovedSubtree({
    rootTreeSha,
    approvedSubtree: subtree,
    loadTree: objects.loadTree,
    checkpoint: async ({ kind, sha, path }) => {
      await objects.persistVerified(kind, sha, path);
    },
  });
  const walk = await walkApprovedTree({
    rootTreeSha: resolved.subtreeTreeSha,
    approvedSubtree: subtree,
    loadTree: objects.loadTree,
    loadBlob: objects.loadBlob,
    checkpoint: async (_state, { kind, sha, path }) => {
      await objects.persistVerified(kind, sha, path);
    },
  });
  return { resolved, walk };
};

const safeScreen = (
  path: string,
  value: Uint8Array | undefined,
  seen: ReadonlySet<string>,
): ScreenedBlob | undefined => {
  if (value === undefined) return undefined;
  try {
    return screenBlob({ path, bytes: value }, seen);
  } catch {
    return undefined;
  }
};

const provenanceDiff = (
  input: AcquisitionOrchestrationInput,
  path: string,
  parentSha: string,
  childSha: string,
  parent: ScreenedBlob,
  child: ScreenedBlob,
): ChangedLinesResult | undefined => {
  try {
    return reconstructChangedLines({
      parentCommits: [input.receipt.parentSha],
      changeKind: "modified",
      parentPath: path,
      childPath: path,
      parent: { ...parent, blobSha: parentSha, kind: "regular", binary: false },
      child: { ...child, blobSha: childSha, kind: "regular", binary: false },
    });
  } catch {
    return undefined;
  }
};

const selectCandidate = (
  input: AcquisitionOrchestrationInput,
  objects: LoadedObjects,
  child: Awaited<ReturnType<typeof walkRevision>>,
  parent: Awaited<ReturnType<typeof walkRevision>>,
): Candidate => {
  const parentByPath = new Map(parent.walk.selectedBlobs.map((value) => [value.path, value.sha]));
  const seen = new Set<string>();
  for (const selected of [...child.walk.selectedBlobs]
    .sort((left, right) => left.path.localeCompare(right.path))) {
    const parentSha = parentByPath.get(selected.path);
    if (parentSha === undefined) continue;
    const screenedChild = safeScreen(selected.path, objects.blobs.get(selected.sha), seen);
    const screenedParent = safeScreen(selected.path, objects.blobs.get(parentSha), new Set());
    if (screenedChild === undefined || screenedParent === undefined) continue;
    const diff = input.receipt.purpose === "LANGUAGE_CANDIDATE"
      ? null
      : provenanceDiff(
        input, selected.path, parentSha, selected.sha, screenedParent, screenedChild,
      );
    if (input.receipt.purpose !== "LANGUAGE_CANDIDATE" && diff === undefined) continue;
    seen.add(screenedChild.normalizedSha256);
    return {
      path: selected.path,
      childSha: selected.sha,
      parentSha,
      child: screenedChild,
      parent: screenedParent,
      diff: diff ?? null,
    };
  }
  return fail("NO_ELIGIBLE_CANDIDATE");
};

const languageForPath = (path: string): string => {
  const extension = path.split(".").at(-1)?.toLowerCase();
  const languages: Readonly<Record<string, string>> = {
    c: "C", cc: "C++", cpp: "C++", cs: "C#", go: "Go", h: "C",
    hpp: "C++", html: "HTML", java: "Java", js: "JavaScript",
    jsx: "JavaScript", kt: "Kotlin", php: "PHP", py: "Python", rb: "Ruby",
    rs: "Rust", scala: "Scala", sh: "Shell", sql: "SQL", swift: "Swift",
    ts: "TypeScript", tsx: "TypeScript", vue: "Vue",
  };
  return extension === undefined ? fail("LANGUAGE_PROPOSAL_REJECTED")
    : languages[extension] ?? fail("LANGUAGE_PROPOSAL_REJECTED");
};

const recognizedRule = (input: AcquisitionOrchestrationInput) => {
  const lines = input.receipt.commit.message.split("\n");
  const author = input.receipt.commit.author;
  const matches = input.attributionPolicyDocument.rules.filter((rule) =>
    (rule.kind === "marker"
      && typeof rule.exactMarker === "string"
      && lines.includes(rule.exactMarker))
    || (rule.kind === "verified-bot"
      && author.type === "Bot"
      && rule.botLogin === author.login));
  if (matches.length !== 1) fail("ATTRIBUTION_EVIDENCE_REJECTED");
  const selected = matches[0] ?? fail("ATTRIBUTION_EVIDENCE_REJECTED");
  return {
    ruleId: selected.ruleId,
    parsedMarker: selected.kind === "marker" ? selected.exactMarker : undefined,
    botIdentity: selected.kind === "verified-bot"
      ? { login: author.login, verified: true, vendorControlled: true }
      : undefined,
  };
};

const markerEvidence = (
  input: AcquisitionOrchestrationInput,
): Readonly<Record<string, unknown>> => {
  const facts = input.receipt.commit;
  const recognized = recognizedRule(input);
  let result: AgentMarkerResult;
  try {
    result = classifyAgentMarker({
      purpose: input.receipt.purpose,
      author: { name: facts.author.name, login: facts.author.login },
      committer: { name: facts.committer.name, login: facts.committer.login },
      verification: facts.verification,
      commitMessage: facts.message,
      parsedMarker: recognized.parsedMarker,
      policyBinding: {
        policyVersion: input.attributionPolicy.policyVersion,
        policyHash: input.attributionPolicy.policyHash,
        ruleId: recognized.ruleId,
      },
      policy: input.attributionPolicyDocument,
      botIdentity: recognized.botIdentity,
    });
  } catch {
    return fail("ATTRIBUTION_EVIDENCE_REJECTED");
  }
  const common = {
    kind: result.classification,
    classification: result.classification,
    publicPhrase: result.publicPhrase,
    author: result.author,
    committer: result.committer,
    verification: result.verification,
    commitMessageHash: result.commitMessageSha256,
    parsedMarker: result.parsedMarker ?? null,
    ruleId: result.ruleBinding.ruleId,
    ruleBindingHash: canonicalSha256(result.ruleBinding),
    vendorSessionDecision: result.parsedMarker === undefined
      ? "VERIFIED_VENDOR_CONTROLLED_SESSION"
      : "NOT_APPLICABLE",
    ...(result.modelName === undefined ? {} : { modelName: result.modelName }),
    ...(result.accountAttribution === undefined
      ? {} : { accountAttribution: result.accountAttribution }),
  };
  return deepFreeze({ ...common, evidenceHash: canonicalSha256(common) });
};

const licenseEntry = (
  input: AcquisitionOrchestrationInput,
  objects: LoadedObjects,
): { readonly path: string; readonly sha: string } => {
  const root = objects.trees.get(input.receipt.childTreeSha)
    ?? fail("LICENSE_REJECTED");
  const matches = root.tree.filter(({ path, type, mode }) =>
    /^(?:licen[cs]e|copying)(?:\.(?:md|txt))?$/iu.test(path)
    && type === "blob"
    && (mode === "100644" || mode === "100755"));
  if (matches.length !== 1) fail("LICENSE_REJECTED");
  const selected = matches[0] ?? fail("LICENSE_REJECTED");
  return { path: selected.path, sha: selected.sha };
};

const persistSnapshots = async (
  objects: LoadedObjects,
  candidate: Candidate,
  licenseSha: string,
  licenseBytes: Uint8Array,
): Promise<readonly { readonly gitSha: string; readonly identity: SnapshotIdentity }[]> => {
  const requested = [
    {
      gitSha: candidate.childSha,
      plaintext: objects.blobs.get(candidate.childSha) ?? fail("SNAPSHOT_REJECTED"),
    },
    {
      gitSha: candidate.parentSha,
      plaintext: objects.blobs.get(candidate.parentSha) ?? fail("SNAPSHOT_REJECTED"),
    },
    { gitSha: licenseSha, plaintext: new Uint8Array(licenseBytes) },
  ];
  const unique = new Map<string, typeof requested[number]>();
  requested.forEach((item) => unique.set(item.gitSha, item));
  const receipts = [];
  for (const item of unique.values()) {
    const checkpointed = objects.identities.get(objectKey("blob", item.gitSha));
    if (checkpointed !== undefined) {
      receipts.push({ gitSha: item.gitSha, identity: checkpointed });
      continue;
    }
    if (gitBlobSha(item.plaintext) !== item.gitSha) fail("SNAPSHOT_REJECTED");
    const identity = await objects.persistAcceptedBlob(item.gitSha, item.plaintext);
    receipts.push({ gitSha: item.gitSha, identity });
  }
  return receipts;
};

const persistDerivedArtifacts = async (
  input: AcquisitionOrchestrationInput,
  draft: AcquisitionDraft,
  progress: AcquisitionCheckpoint,
) => {
  const created: SnapshotIdentity[] = [];
  const rollback = async (): Promise<void> => {
    for (const identity of [...created].reverse()) {
      const removed = await input.store.remove(identity)
        .catch(() => fail("DRAFT_ARTIFACT_ROLLBACK_REJECTED"));
      if (!removed) fail("DRAFT_ARTIFACT_ROLLBACK_REJECTED");
    }
  };
  try {
    const put = async (plaintext: Uint8Array): Promise<SnapshotIdentity> => {
      const identity = artifactIdentity(plaintext);
      const stored = await input.store.put({
        identity,
        plaintext,
      });
      if (stored.created) created.push(stored.identity);
      return stored.identity;
    };
    const draftIdentity = await put(serializeAcquisitionDraft(draft));
    const checkpointIdentity = await put(
      new TextEncoder().encode(JSON.stringify(progress)),
    );
    const indexIdentity = await put(new TextEncoder().encode(JSON.stringify({
      version: 1,
      status: draft.state,
      draftId: draft.draftId,
      draftHash: draft.draftHash,
      checkpointHash: progress.checkpointHash,
      artifactObjects: {
        draft: draftIdentity,
        checkpoint: checkpointIdentity,
      },
    })));
    return Object.freeze({
      artifacts: Object.freeze({
        draft: draftIdentity,
        checkpoint: checkpointIdentity,
        index: indexIdentity,
      }),
      rollback,
    });
  } catch (error) {
    await rollback();
    if (error instanceof AcquisitionOrchestrationError) throw error;
    return fail("DRAFT_PERSISTENCE_REJECTED");
  }
};

const auditRun = (
  input: AcquisitionOrchestrationInput,
  runId: string,
): Readonly<Record<string, unknown>> => ({ ...input.operatorRun, runId });
const auditEvent = (
  input: AcquisitionOrchestrationInput,
  runId: string,
  eventType: string,
  subjectHash: string,
  reasonCode: string,
  ordinal = 0,
) => ({
  eventIdentity: canonicalSha256({ runId, eventType, subjectHash, reasonCode, ordinal }),
  eventTime: input.operatorRun.authoritativeReceiptTime,
  eventType,
  reasonCode,
  run: auditRun(input, runId),
  subjectHash,
});
const appendAudit = (
  input: AcquisitionOrchestrationInput,
  event: unknown,
): Promise<readonly unknown[]> =>
  categorical(() => input.audit.append(event), "AUDIT_REJECTED");

const checkpoint = (
  input: AcquisitionOrchestrationInput,
  childSubtree: string,
  objects: LoadedObjects,
): AcquisitionCheckpoint => createCheckpoint({
  repository: input.receipt.repository,
  commit: input.receipt.childSha,
  parent: input.receipt.parentSha,
  rootTree: input.receipt.childTreeSha,
  subtree: input.receipt.subtree,
  subtreeTree: childSubtree,
  repositoryPolicyVersion: input.repositoryPolicy.policyVersion,
  repositoryPolicyHash: input.repositoryPolicy.policyHash,
  attributionPolicyVersion: input.attributionPolicy.policyVersion,
  attributionPolicyHash: input.attributionPolicy.policyHash,
  policyRegisterVersion: input.repositoryPolicy.registerVersion,
  policyRegisterHash: input.repositoryPolicy.registerHash,
  repositoryPolicyEntryId: input.repositoryPolicy.entryId,
  attributionPolicyEntryId: input.attributionPolicy.entryId,
  operatorRegisterVersion: input.operatorRun.registerVersion,
  operatorRegisterHash: input.operatorRun.registerHash,
  operatorEntryId: input.operatorRun.entryId,
  toolVersion: TOOL_VERSION,
  toolHash: TOOL_HASH,
  schemaVersion: SCHEMA_VERSION,
  schemaHash: SCHEMA_HASH,
  purpose: input.receipt.purpose,
  observationTime: input.operatorRun.callerObservationTime,
  visitedTreeShas: [...objects.treeShas].sort(),
  verifiedObjects: [...objects.identities.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, identity]): VerifiedObject => ({
      gitSha: key.slice(key.indexOf(":") + 1),
      sha256: identity.plaintextSha256,
    })),
});

const draftInput = (
  input: AcquisitionOrchestrationInput,
  candidate: Candidate,
  licence: LicenseAdmissionEvidence,
  progress: AcquisitionCheckpoint,
  snapshots: readonly { readonly identity: SnapshotIdentity }[],
  evidence: Readonly<Record<string, unknown>>,
) => {
  const isLanguage = input.receipt.purpose === "LANGUAGE_CANDIDATE";
  const proposal = isLanguage ? {
    proposedLanguage: languageForPath(candidate.path),
    detectorVersion: "extension-map-v1",
  } : null;
  const languageProposal = proposal === null ? null : {
    ...proposal,
    proposalHash: canonicalSha256({
      detectorVersion: proposal.detectorVersion,
      path: candidate.path,
      proposedLanguage: proposal.proposedLanguage,
    }),
    decision: "HUMAN_REVIEW_REQUIRED",
  };
  const diff = candidate.diff === null ? null : {
    algorithmVersion: candidate.diff.algorithmVersion,
    startLine: candidate.diff.coordinates.startLine,
    endLine: candidate.diff.coordinates.endLine,
    changedLineNumbers: candidate.diff.changedLines.map(({ line }) => line),
    changedLinesHash: sha256(candidate.diff.changedLines.map(({ text }) => text).join("\n")),
    excerptHash: candidate.diff.excerptSha256,
    parentBlob: candidate.parentSha,
    childBlob: candidate.childSha,
    parentNormalizedHash: candidate.parent.normalizedSha256,
    childNormalizedHash: candidate.child.normalizedSha256,
  };
  const retention = computeRetention({
    category: "UNRESOLVED_DRAFT",
    objectId: snapshots[0]?.identity.objectId ?? fail("SNAPSHOT_REJECTED"),
    authoritativeReceiptTime: input.operatorRun.authoritativeReceiptTime,
  });
  return {
    run: {
      draftIdempotencyKey: progress.draftIdempotencyKey,
      toolId: TOOL_ID,
      toolVersion: TOOL_VERSION,
      toolHash: TOOL_HASH,
      schemaVersion: SCHEMA_VERSION,
      schemaHash: SCHEMA_HASH,
    },
    source: {
      repository: input.receipt.repository,
      repositoryId: input.receipt.repositoryId,
      childCommit: input.receipt.childSha,
      parentCommit: input.receipt.parentSha,
      childTree: input.receipt.childTreeSha,
      parentTree: input.receipt.parentTreeSha,
      subtree: input.receipt.subtree,
      path: candidate.path,
      childBlob: candidate.childSha,
      parentBlob: candidate.parentSha,
      sourceUrl: `https://github.com/${input.receipt.repository}/blob/${input.receipt.childSha}/${candidate.path}`,
      commitUrl: `https://github.com/${input.receipt.repository}/commit/${input.receipt.childSha}`,
      parentRawHash: candidate.parent.rawSha256,
      childRawHash: candidate.child.rawSha256,
      parentNormalizedHash: candidate.parent.normalizedSha256,
      childNormalizedHash: candidate.child.normalizedSha256,
      repositoryMetadataHash: input.receipt.repositoryMetadataHash,
    },
    acquisition: {
      purpose: input.receipt.purpose,
      observationTime: input.operatorRun.callerObservationTime,
      receiptTime: input.operatorRun.authoritativeReceiptTime,
      checkpointHash: progress.checkpointHash,
      screeningOutcomes: isLanguage
        ? ["SAFE_TEXT", "LICENSE_ADMISSION_SCREENING_ONLY", "LANGUAGE_PROPOSAL_REVIEW_REQUIRED"]
        : ["SAFE_TEXT", "LICENSE_ADMISSION_SCREENING_ONLY", "CHANGED_LINES_BOUND", "ATTRIBUTION_MARKER_BOUND"],
      snapshotIds: snapshots.map(({ identity }) => identity.objectId),
      retentionDeadline: retention.dueAt,
    },
    license: {
      identifier: licence.identifier,
      path: licence.licensePath,
      blobSha: licence.licenseBlobSha,
      textHash: licence.licenseTextSha256,
      repositoryPolicyVersion: licence.repositoryPolicyVersion,
      repositoryPolicyHash: licence.repositoryPolicyHash,
    },
    attribution: {
      policyVersion: input.attributionPolicy.policyVersion,
      policyHash: input.attributionPolicy.policyHash,
      evidence,
    },
    policy: {
      registerVersion: input.repositoryPolicy.registerVersion,
      registerHash: input.repositoryPolicy.registerHash,
      repositoryEntryId: input.repositoryPolicy.entryId,
      attributionEntryId: input.attributionPolicy.entryId,
    },
    operator: {
      name: input.operatorRun.operatorName,
      osIdentity: input.operatorRun.osIdentity,
      registerVersion: input.operatorRun.registerVersion,
      registerHash: input.operatorRun.registerHash,
      entryId: input.operatorRun.entryId,
    },
    diff,
    languageProposal,
  };
};

const executeOrchestration = async (
  input: AcquisitionOrchestrationInput,
  objects: LoadedObjects,
  runId: string,
): Promise<AcquisitionOrchestrationResult> => {
  const child = await categorical(
    () => walkRevision(input.receipt.childTreeSha, input.receipt.subtree, objects),
    "OBJECT_ACQUISITION_REJECTED",
  );
  const parent = await categorical(
    () => walkRevision(input.receipt.parentTreeSha, input.receipt.subtree, objects),
    "OBJECT_ACQUISITION_REJECTED",
  );
  const candidate = selectCandidate(input, objects, child, parent);
  const evidence = input.receipt.purpose === "LANGUAGE_CANDIDATE"
    ? { kind: "LANGUAGE_ONLY_NOT_APPLICABLE" }
    : markerEvidence(input);
  const boundLicense = licenseEntry(input, objects);
  const licenseBytes = await categorical(
    () => objects.loadBlob(boundLicense.sha),
    "LICENSE_REJECTED",
  );
  let licence: LicenseAdmissionEvidence;
  try {
    licence = screenLicenseEvidence({
      identifier: input.receipt.licenseIdentifier,
      metadataIdentifiers: [input.receipt.licenseIdentifier],
      licenseFilePresent: true,
      licensePath: boundLicense.path,
      licenseBlobSha: boundLicense.sha,
      licenseTextSha256: sha256(licenseBytes),
      licenseBytes,
      repositoryPolicyVersion: input.repositoryPolicy.policyVersion,
      repositoryPolicyHash: input.repositoryPolicy.policyHash,
    });
  } catch {
    return fail("LICENSE_REJECTED");
  }
  const snapshots = await categorical(
    () => persistSnapshots(
      objects, candidate, boundLicense.sha, licenseBytes,
    ),
    "SNAPSHOT_REJECTED",
  );
  const progress = checkpoint(
    input, child.resolved.subtreeTreeSha, objects,
  );
  let draft: AcquisitionDraft;
  try {
    draft = createAcquisitionDraft(draftInput(
      input, candidate, licence, progress, snapshots, evidence,
    ));
  } catch {
    return fail("DRAFT_REJECTED");
  }
  const persisted = await persistDerivedArtifacts(input, draft, progress);
  try {
    await appendAudit(input, auditEvent(
      input, runId, "DRAFT_COMPLETED", persisted.artifacts.index.objectId,
      "DRAFT_REVIEW_REQUIRED",
    ));
  } catch (error) {
    await persisted.rollback();
    throw error;
  }
  return deepFreeze({ draft, checkpoint: progress, artifacts: persisted.artifacts });
};

export const orchestrateAcquisitionDraft = async (
  input: AcquisitionOrchestrationInput,
): Promise<AcquisitionOrchestrationResult> => {
  validateBindings(input);
  const runId = input.logicalRunId;
  const subject = canonicalSha256(input.receipt);
  if (!input.resuming) {
    await appendAudit(input, auditEvent(
      input, runId, "RUN_STARTED", subject, "AUTHORIZED_RECEIPT_ACCEPTED",
    ));
  }
  const objects = loadedObjects(input, runId);
  try {
    return await executeOrchestration(input, objects, runId);
  } catch (error) {
    if (error instanceof GitHubRateLimitPause) throw error;
    const code = error instanceof AcquisitionOrchestrationError
      ? error.message : "ORCHESTRATION_REJECTED";
    await objects.rollbackTraversal();
    await input.audit.append(auditEvent(
      input, runId, "RUN_REJECTED", subject, code,
    )).catch(() => undefined);
    return fail(code);
  }
};
