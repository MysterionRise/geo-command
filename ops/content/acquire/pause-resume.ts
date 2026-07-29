import {
  authorizeRateLimitResume,
  canonicalSha256,
  createRateLimitCheckpoint,
  rateLimitBindings,
  rateLimitCheckpointIdentity,
  RateLimitCheckpointError,
  serializeRateLimitCheckpoint,
  type AcquisitionRequest,
  type AuthorizedOperatorRun,
  type AuthorizedPolicy,
  type GitHubRateLimitPause,
  type RateLimitCheckpoint,
  type ResumableGitObject,
  type SnapshotIdentity,
  type StoredGitObject,
} from "@codeguessr/content/operator/acquisition";
import { prepareOperatorState } from "./operator-state";

type PreparedState = Awaited<ReturnType<typeof prepareOperatorState>>;
type OpenedState = Awaited<ReturnType<PreparedState["open"]>>;
interface PauseExecution {
  readonly request: AcquisitionRequest;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly operatorRun: AuthorizedOperatorRun;
}
export interface ResumeReference {
  readonly checkpointObject: SnapshotIdentity;
}
export interface ResumeContext {
  readonly state: OpenedState;
  readonly checkpoint: RateLimitCheckpoint;
  readonly objects: readonly ResumableGitObject[];
}
export class PauseResumeError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "PauseResumeError";
  }
}
const fail = (code: string): never => {
  throw new PauseResumeError(code);
};
const event = (
  execution: PauseExecution,
  operatorRun: AuthorizedOperatorRun,
  eventType: "RAW_OBJECT_DELETED" | "RUN_PAUSED" | "RUN_RESUMED",
  subjectHash: string,
  reasonCode: string,
) => {
  const bindings = rateLimitBindings({
    ...execution,
    operatorRun,
  });
  const runId = bindings.logicalRunId;
  return {
    eventIdentity: canonicalSha256({ runId, eventType, subjectHash, reasonCode }),
    eventTime: operatorRun.authoritativeReceiptTime,
    eventType,
    reasonCode,
    run: { ...operatorRun, runId },
    subjectHash,
  };
};
export const cleanupRunOwnedObjects = async (input: {
  readonly execution: PauseExecution;
  readonly operatorRun: AuthorizedOperatorRun;
  readonly state: {
    readonly store: OpenedState["store"];
    readonly audit?: OpenedState["audit"];
  };
  readonly objects: readonly StoredGitObject[];
}): Promise<void> => {
  let removalFailed = false;
  const owned = [...new Map(input.objects
    .filter(({ createdByRun }) => createdByRun)
    .map((object) => [object.snapshot.objectId, object])).values()];
  for (const object of owned.reverse()) {
    let removed = false;
    try {
      removed = await input.state.store.remove(object.snapshot);
    } catch {
      removalFailed = true;
      continue;
    }
    if (!removed || input.state.audit === undefined) continue;
    await input.state.audit.append(event(
      input.execution,
      input.operatorRun,
      "RAW_OBJECT_DELETED",
      object.snapshot.objectId,
      "TERMINAL_REJECTION_ROLLBACK",
    )).catch(() => undefined);
  }
  if (removalFailed) fail("TERMINAL_CLEANUP_REJECTED");
};
const resumeCheckpoint = async (
  reference: ResumeReference,
  execution: PauseExecution,
  store: Awaited<ReturnType<PreparedState["openStore"]>>,
  nowEpochMs: number,
): Promise<Readonly<{
  checkpoint: RateLimitCheckpoint;
  objects: readonly ResumableGitObject[];
}>> => {
  try {
    const plaintext = await store.read(reference.checkpointObject);
    const checkpoint = authorizeRateLimitResume({
      plaintext,
      expectedBindings: rateLimitBindings(execution),
      nowEpochMs,
    });
    const objects: ResumableGitObject[] = [];
    for (const stored of checkpoint.storedObjects) {
      objects.push(Object.freeze({
        ...stored,
        plaintext: await store.read(stored.snapshot),
      }));
    }
    return Object.freeze({ checkpoint, objects: Object.freeze(objects) });
  } catch (error) {
    if (error instanceof RateLimitCheckpointError && error.message === "RESUME_NOT_READY") {
      return fail(error.message);
    }
    return fail("RESUME_CHECKPOINT_REJECTED");
  }
};

export const openRateLimitResume = async (
  reference: ResumeReference,
  execution: PauseExecution,
  prepared: PreparedState,
  nowEpochMs: number,
): Promise<ResumeContext> => {
  const store = await prepared.openStore()
    .catch(() => fail("OPERATOR_STATE_REJECTED"));
  const resumed = await resumeCheckpoint(reference, execution, store, nowEpochMs);
  let audit: OpenedState["audit"];
  try {
    audit = await prepared.openAudit(execution.operatorRun);
  } catch {
    await cleanupRunOwnedObjects({
      execution,
      operatorRun: execution.operatorRun,
      state: { store },
      objects: resumed.checkpoint.storedObjects,
    });
    return fail("OPERATOR_STATE_REJECTED");
  }
  try {
    await audit.append(event(
      execution, execution.operatorRun, "RUN_RESUMED",
      resumed.checkpoint.checkpointHash, "RATE_LIMIT_RESUME_AUTHORIZED",
    ));
  } catch {
    await cleanupRunOwnedObjects({
      execution,
      operatorRun: execution.operatorRun,
      state: { store, audit },
      objects: resumed.checkpoint.storedObjects,
    });
    return fail("RESUME_AUDIT_REJECTED");
  }
  return Object.freeze({
    state: Object.freeze({ store, audit }),
    checkpoint: resumed.checkpoint,
    objects: resumed.objects,
  });
};

export const persistRateLimitPause = async (input: {
  readonly execution: PauseExecution;
  readonly operatorRun: AuthorizedOperatorRun;
  readonly prepared: PreparedState;
  readonly opened?: OpenedState;
  readonly pause: GitHubRateLimitPause;
  readonly nowEpochMs: number;
  readonly verifiedObjects: readonly StoredGitObject[];
}) => {
  const state = input.opened ?? Object.freeze({
    store: await input.prepared.openStore()
      .catch(() => fail("OPERATOR_STATE_REJECTED")),
    audit: await input.prepared.openAudit(input.operatorRun)
      .catch(() => fail("OPERATOR_STATE_REJECTED")),
  });
  const checkpoint = createRateLimitCheckpoint({
    bindings: rateLimitBindings({ ...input.execution, operatorRun: input.operatorRun }),
    resumeAfterEpochMs: input.pause.resumeAfterEpochMs,
    pauseAtEpochMs: input.nowEpochMs,
    storedObjects: input.verifiedObjects,
  });
  const plaintext = serializeRateLimitCheckpoint(checkpoint);
  const identity = rateLimitCheckpointIdentity(plaintext);
  let stored: Awaited<ReturnType<typeof state.store.put>>;
  try {
    stored = await state.store.put({ identity, plaintext });
  } catch {
    await cleanupRunOwnedObjects({
      execution: input.execution,
      operatorRun: input.operatorRun,
      state,
      objects: input.verifiedObjects,
    });
    return fail("PAUSE_PERSISTENCE_REJECTED");
  }
  try {
    await state.audit.append(event(
      input.execution, input.operatorRun, "RUN_PAUSED",
      checkpoint.checkpointHash, "GITHUB_RATE_LIMIT_REACHED",
    ));
  } catch {
    if (stored.created) await state.store.remove(identity).catch(() => false);
    await cleanupRunOwnedObjects({
      execution: input.execution,
      operatorRun: input.operatorRun,
      state,
      objects: input.verifiedObjects,
    });
    return fail("PAUSE_AUDIT_REJECTED");
  }
  return Object.freeze({
    status: "PAUSED" as const,
    resumeAfterEpochMs: checkpoint.resumeAfterEpochMs,
    checkpointHash: checkpoint.checkpointHash,
    checkpointObject: identity,
    storedObjectCount: checkpoint.storedObjects.length,
  });
};
