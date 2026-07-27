import { computeRetention, createLegalHold, deleteWhenDue, LifecycleError } from "./lifecycle";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const h64 = "a".repeat(64);

describe("snapshot lifecycle", () => {
  it("computes categorical authoritative deadlines and rejects caller time", () => {
    expect(computeRetention({
      category: "SENSITIVE_REJECTED", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z",
      authoritativeDetectionTime: "2026-01-01T00:10:00Z",
    }).dueAt).toBe("2026-01-01T00:10:00Z");
    expect(computeRetention({
      category: "SENSITIVE_REJECTED", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z",
      authoritativeDetectionTime: "2026-01-01T02:00:00Z",
    }).dueAt).toBe("2026-01-01T01:00:00Z");
    expect(computeRetention({
      category: "OTHER_REJECTED", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z",
    }).dueAt).toBe("2026-01-02T00:00:00Z");
    expect(computeRetention({
      category: "UNRESOLVED_DRAFT", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z",
    }).dueAt).toBe("2026-01-31T00:00:00Z");
    expect(computeRetention({
      category: "REVIEW_FINALIZED", outcome: "PROMOTED", objectId: h64,
      authoritativeDecisionTime: "2026-01-01T00:00:00Z",
    }).dueAt).toBe("2026-01-31T00:00:00Z");
    expect(computeRetention({
      category: "REVIEW_FINALIZED", outcome: "REJECTED", objectId: h64,
      authoritativeDecisionTime: "2026-01-01T00:00:00Z",
    }).dueAt).toBe("2026-01-31T00:00:00Z");
    expect(() => computeRetention({
      category: "OTHER_REJECTED", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z", callerObservationTime: "x",
    } as never)).toThrow();
  });

  it("deletes only due unheld objects and verifies absence", async () => {
    const record = computeRetention({
      category: "OTHER_REJECTED", objectId: h64,
      authoritativeReceiptTime: "2026-01-01T00:00:00Z",
    });
    let exists = true;
    const adapter = {
      deleteObject: async (id: string) => { expect(id).toBe(h64); exists = false; },
      objectExists: async () => exists,
    };
    expect(await deleteWhenDue(record, "2026-01-01T23:59:59Z", adapter)).toBe(false);
    const hold = createLegalHold({
      holdId: "hold-1", owner: "legal", basis: "investigation", affectedObjectIds: [h64],
      recordedAt: "2026-01-01T00:00:00Z", reviewDate: "2026-02-01T00:00:00Z",
      releaseAction: "CONTINUE_HOLD",
    });
    expect(Object.isFrozen(hold)).toBe(true);
    expect(await deleteWhenDue(record, "2026-01-03T00:00:00Z", adapter, hold)).toBe(false);
    const released = createLegalHold({ ...hold, releaseAction: "RELEASE" });
    expect(await deleteWhenDue(record, "2026-01-03T00:00:00Z", adapter, released)).toBe(true);
    exists = true;
    await expect(deleteWhenDue(record, "2026-01-03T00:00:00Z", {
      deleteObject: async () => undefined, objectExists: async () => true,
    })).rejects.toThrow("DELETION_UNVERIFIED");
    await expect(deleteWhenDue({ ...record, objectId: "bad" }, "2026-01-03T00:00:00Z", adapter))
      .rejects.toThrow(LifecycleError);
    await expect(deleteWhenDue(record, "2026-01-03T00:00:00Z", {
      deleteObject: async () => { throw new Error("raw /tmp/canary"); },
      objectExists: async () => false,
    })).rejects.toThrow("DELETION_FAILED");
  });
});
