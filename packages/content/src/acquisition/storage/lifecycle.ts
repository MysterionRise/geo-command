const H64 = /^[0-9a-f]{64}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
type Json = Record<string, unknown>;
export class LifecycleError extends Error {
  public constructor(code: string) { super(code); this.name = "LifecycleError"; }
}
const fail = (code: string): never => { throw new LifecycleError(code); };
const exact = (value: unknown, keys: readonly string[]): value is Json =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const time = (value: unknown): string => {
  const text = typeof value === "string" ? value : fail("TIME_REJECTED");
  if (!UTC.test(text) || Number.isNaN(Date.parse(text))
    || new Date(text).toISOString() !== text.replace("Z", ".000Z")) fail("TIME_REJECTED");
  return text;
};
const plusHours = (value: string, hours: number): string =>
  new Date(Date.parse(value) + hours * 3_600_000).toISOString().replace(".000Z", "Z");
const plusDays = (value: string, days: number): string => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().replace(".000Z", "Z");
};
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value as Json).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export interface RetentionRecord {
  readonly category: string; readonly objectId: string; readonly dueAt: string;
  readonly immediateDeadline?: string; readonly absoluteCeiling?: string;
  readonly authoritativeReceiptTime?: string; readonly authoritativeDetectionTime?: string;
  readonly authoritativeDecisionTime?: string; readonly outcome?: string;
}
export const computeRetention = (raw: unknown): RetentionRecord => {
  const input = raw as Json;
  const category = input?.category;
  const common = ["category", "objectId", "authoritativeReceiptTime"];
  if (!H64.test(input?.objectId as string)) fail("OBJECT_ID_REJECTED");
  let result: RetentionRecord;
  if (category === "SENSITIVE_REJECTED") {
    if (!exact(input, [...common, "authoritativeDetectionTime"])) fail("FIELDS_REJECTED");
    const receipt = time(input.authoritativeReceiptTime);
    const detection = time(input.authoritativeDetectionTime);
    if (detection < receipt) fail("TIME_ORDER_REJECTED");
    const ceiling = plusHours(receipt, 1);
    result = {
      category, objectId: input.objectId as string,
      authoritativeReceiptTime: receipt, authoritativeDetectionTime: detection,
      immediateDeadline: detection, absoluteCeiling: ceiling,
      dueAt: detection < ceiling ? detection : ceiling,
    };
  } else if (category === "OTHER_REJECTED" || category === "UNRESOLVED_DRAFT") {
    if (!exact(input, common)) fail("FIELDS_REJECTED");
    const receipt = time(input.authoritativeReceiptTime);
    result = {
      category, objectId: input.objectId as string,
      authoritativeReceiptTime: receipt,
      dueAt: category === "OTHER_REJECTED" ? plusHours(receipt, 24) : plusDays(receipt, 30),
    };
  } else if (category === "REVIEW_FINALIZED") {
    if (!exact(input, ["category", "objectId", "outcome", "authoritativeDecisionTime"])
      || !["PROMOTED", "REJECTED"].includes(input.outcome as string)) fail("CATEGORY_REJECTED");
    result = {
      category, objectId: input.objectId as string,
      outcome: input.outcome as string,
      authoritativeDecisionTime: time(input.authoritativeDecisionTime),
      dueAt: plusDays(time(input.authoritativeDecisionTime), 30),
    };
  } else return fail("CATEGORY_REJECTED");
  return freeze(result);
};

export interface LegalHold {
  readonly holdId: string; readonly owner: string; readonly basis: string;
  readonly affectedObjectIds: readonly string[]; readonly recordedAt: string;
  readonly reviewDate: string; readonly releaseAction: "CONTINUE_HOLD" | "RELEASE";
}
export const createLegalHold = (raw: unknown): LegalHold => {
  const keys = [
    "affectedObjectIds", "basis", "holdId", "owner", "recordedAt", "releaseAction", "reviewDate",
  ];
  const hold = exact(raw, keys) ? raw : fail("HOLD_FIELDS_REJECTED");
  const ids = Array.isArray(hold.affectedObjectIds)
    ? hold.affectedObjectIds : fail("HOLD_REJECTED");
  if (
    !["holdId", "owner", "basis"].every((key) =>
      typeof hold[key] === "string" && (hold[key] as string).length > 0)
    || ids.length === 0
    || ids.some((id) => typeof id !== "string" || !H64.test(id))
    || new Set(ids).size !== ids.length
    || !["CONTINUE_HOLD", "RELEASE"].includes(hold.releaseAction as string)
  ) fail("HOLD_REJECTED");
  if (time(hold.reviewDate) < time(hold.recordedAt)) fail("TIME_ORDER_REJECTED");
  return freeze({ ...hold, affectedObjectIds: [...ids] } as unknown as LegalHold);
};

interface DeletionAdapter {
  deleteObject(objectId: string): Promise<void>;
  objectExists(objectId: string): Promise<boolean>;
}
const retentionBasis = (record: RetentionRecord): Json => {
  if (record.category === "SENSITIVE_REJECTED") return {
    category: record.category, objectId: record.objectId,
    authoritativeReceiptTime: record.authoritativeReceiptTime,
    authoritativeDetectionTime: record.authoritativeDetectionTime,
  };
  if (record.category === "REVIEW_FINALIZED") return {
    category: record.category, objectId: record.objectId, outcome: record.outcome,
    authoritativeDecisionTime: record.authoritativeDecisionTime,
  };
  return {
    category: record.category, objectId: record.objectId,
    authoritativeReceiptTime: record.authoritativeReceiptTime,
  };
};
export const deleteWhenDue = async (
  record: RetentionRecord,
  authoritativeNow: string,
  adapter: DeletionAdapter,
  hold?: LegalHold,
): Promise<boolean> => {
  const validated = computeRetention(retentionBasis(record));
  if (JSON.stringify(validated) !== JSON.stringify(record)) fail("RETENTION_FORGED");
  if (hold !== undefined) createLegalHold(hold);
  const now = time(authoritativeNow);
  if (now < record.dueAt) return false;
  if (hold?.affectedObjectIds.includes(record.objectId)
    && hold.releaseAction === "CONTINUE_HOLD") {
    if (now >= hold.reviewDate) fail("HOLD_REVIEW_REQUIRED");
    return false;
  }
  try {
    await adapter.deleteObject(record.objectId);
    if (await adapter.objectExists(record.objectId)) fail("DELETION_UNVERIFIED");
  } catch (error) {
    if (error instanceof LifecycleError) throw error;
    return fail("DELETION_FAILED");
  }
  return true;
};
