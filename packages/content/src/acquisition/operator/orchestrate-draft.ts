import { createHash } from "node:crypto";

import {
  createAcquisitionDraft,
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

const TOOL_ID = "codeguessr-github-acquirer";
const TOOL_VERSION = "1.0.0";
const TOOL_HASH = canonicalSha256({
  id: TOOL_ID,
  version: TOOL_VERSION,
  components: [
    "immutable-subtree-v1",
    "blob-screen-v1",
    "line-sequence-v1",
    "draft-v1",
  ],
});
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
export interface AcquisitionOrchestrationInput {
  readonly receipt: AuthorizedCommitReceipt;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly attributionPolicyDocument: AgentMarkerInput["policy"];
  readonly operatorRun: AuthorizedOperatorRun;
  readonly loadTree: (sha: string) => Promise<GitTreeResponse>;
  readonly loadBlob: (sha: string) => Promise<Uint8Array>;
  readonly store: SnapshotStore;
  readonly audit: AuditSink;
}
export interface AcquisitionOrchestrationResult {
  readonly draft: AcquisitionDraft;
  readonly checkpoint: AcquisitionCheckpoint;
}

interface LoadedObjects {
  readonly treeShas: Set<string>;
  readonly trees: Map<string, GitTreeResponse>;
  readonly blobs: Map<string, Uint8Array>;
  readonly loadTree: (sha: string) => Promise<GitTreeResponse>;
  readonly loadBlob: (sha: string) => Promise<Uint8Array>;
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

const loadedObjects = (input: AcquisitionOrchestrationInput): LoadedObjects => {
  const trees = new Map<string, GitTreeResponse>();
  const blobs = new Map<string, Uint8Array>();
  const treeShas = new Set<string>();
  return {
    trees,
    blobs,
    treeShas,
    loadTree: async (sha) => {
      const cached = trees.get(sha);
      if (cached !== undefined) return cached;
      const value = await input.loadTree(sha);
      trees.set(sha, value);
      treeShas.add(sha);
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
  };
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
  });
  const walk = await walkApprovedTree({
    rootTreeSha: resolved.subtreeTreeSha,
    approvedSubtree: subtree,
    loadTree: objects.loadTree,
    loadBlob: objects.loadBlob,
    checkpoint: () => undefined,
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
  input: AcquisitionOrchestrationInput,
  objects: LoadedObjects,
  candidate: Candidate,
  licenseSha: string,
  licenseBytes: Uint8Array,
  runId: string,
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
    const identity = {
      objectId: sha256(item.plaintext),
      plaintextSha256: sha256(item.plaintext),
      byteLength: item.plaintext.byteLength,
    };
    const stored = await input.store.put({ identity, plaintext: item.plaintext });
    try {
      await appendAudit(input, auditEvent(
        input, runId, "RAW_OBJECT_CREATED", identity.objectId,
        stored.created ? "VERIFIED_OBJECT_STORED" : "VERIFIED_OBJECT_REUSED",
        receipts.length,
      ));
    } catch (error) {
      if (stored.created) {
        const removed = await input.store.remove(identity)
          .catch(() => fail("SNAPSHOT_ROLLBACK_REJECTED"));
        if (!removed) fail("SNAPSHOT_ROLLBACK_REJECTED");
      }
      throw error;
    }
    receipts.push({ gitSha: item.gitSha, identity });
  }
  return receipts;
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
  snapshots: readonly { readonly gitSha: string; readonly identity: SnapshotIdentity }[],
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
  verifiedObjects: snapshots.map(({ gitSha, identity }): VerifiedObject => ({
    gitSha,
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
      input, objects, candidate, boundLicense.sha, licenseBytes, runId,
    ),
    "SNAPSHOT_REJECTED",
  );
  const progress = checkpoint(
    input, child.resolved.subtreeTreeSha, objects, snapshots,
  );
  let draft: AcquisitionDraft;
  try {
    draft = createAcquisitionDraft(draftInput(
      input, candidate, licence, progress, snapshots, evidence,
    ));
  } catch {
    return fail("DRAFT_REJECTED");
  }
  await appendAudit(input, auditEvent(
    input, runId, "DRAFT_COMPLETED", draft.draftHash, "DRAFT_REVIEW_REQUIRED",
  ));
  return deepFreeze({ draft, checkpoint: progress });
};

export const orchestrateAcquisitionDraft = async (
  input: AcquisitionOrchestrationInput,
): Promise<AcquisitionOrchestrationResult> => {
  validateBindings(input);
  const runId = canonicalSha256({
    receipt: input.receipt,
    operatorRegisterHash: input.operatorRun.registerHash,
  });
  const subject = canonicalSha256(input.receipt);
  await appendAudit(input, auditEvent(
    input, runId, "RUN_STARTED", subject, "AUTHORIZED_RECEIPT_ACCEPTED",
  ));
  try {
    return await executeOrchestration(input, loadedObjects(input), runId);
  } catch (error) {
    const code = error instanceof AcquisitionOrchestrationError
      ? error.message : "ORCHESTRATION_REJECTED";
    await input.audit.append(auditEvent(
      input, runId, "RUN_REJECTED", subject, code,
    )).catch(() => undefined);
    return fail(code);
  }
};
