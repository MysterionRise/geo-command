import { describe, expect, it } from "vitest";

import type { RestoreLedger } from "../src/server/content/vault/vault.js";
import {
  ProviderRuleError,
  RestoreCoordinator,
  createProviderInventory,
  type RestrictedVaultRestorePort,
} from "../src/server/privacy/providers/providers.js";
import { providerSchedule } from "../../../ops/privacy/provider-schedule.js";

const categories = [
  "STORE", "LOG", "BACKUP", "EXPORT", "SUPPORT_SYSTEM", "OPERATOR_COPY", "SUBPROCESSOR",
] as const;
const entry = (category: (typeof categories)[number], overrides: Record<string, unknown> = {}) => ({
  entryId: category.toLowerCase(),
  category,
  approvedBy: "Don",
  purpose: "Bound synthetic test operation",
  processingBasis: "Synthetic consent basis",
  fields: [`${category.toLowerCase()}-field`],
  accessOwner: "Test Data Steward",
  retention: { signedBy: "Don", ceilingDays: 30 },
  deletionCapability: "DELETE_AND_PROPAGATE",
  propagationRule: "Propagate test deletion",
  backupExpiryDays: 35,
  restorationBehavior: "SEALED_PENDING_RECONCILIATION",
  actualGuarantees: { retentionDays: 30, backupExpiryDays: 35, deletionSupported: true },
  providerIdentity: `test-provider-${category.toLowerCase()}`,
  approval: { approvalId: `test-approval-${category.toLowerCase()}`, approvalHash: `test-hash-${category.toLowerCase()}`, approvedAt: "2026-07-13T09:00:00Z", approver: "Don" },
  ...overrides,
});
const inventoryInput = () => ({
  dataFlowRegister: {
    versionId: "data-flow-v1",
    approvedBy: "Don",
    nodes: categories.map((category) => ({
      entryId: category.toLowerCase(),
      category,
      usage: "USED" as const,
      fields: [`${category.toLowerCase()}-field`],
      processingBasisApplicable: true,
      providerIdentity: `test-provider-${category.toLowerCase()}`,
      purpose: "Bound synthetic test operation",
      processingBasis: "Synthetic consent basis",
      accessOwner: "Test Data Steward",
      deletionCapability: "DELETE_AND_PROPAGATE",
      propagationRule: "Propagate test deletion",
      restorationBehavior: "SEALED_PENDING_RECONCILIATION" as const,
      retention: { signedBy: "Don", ceilingDays: 30 },
      backup: { signedBy: "Don", ceilingDays: 35 },
      approval: { approvalId: `test-approval-${category.toLowerCase()}`, approvalHash: `test-hash-${category.toLowerCase()}`, approvedAt: "2026-07-13T09:00:00Z", approver: "Don" },
    })),
  },
  providerInventoryVersionId: "providers-v1",
  entries: categories.map((category) => entry(category)),
});

const operator = { operatorId: "restore-primary", operatorName: "Primary Operator", role: "RESTORE_OPERATOR" as const };
const backup = { operatorId: "restore-backup", operatorName: "Backup Operator", role: "RESTORE_OPERATOR" as const };
const verifier = { operatorId: "restore-verifier", operatorName: "Independent Verifier", role: "RESTORE_VERIFIER" as const };
const watermarks: Record<RestoreLedger, string> = {
  WITHDRAWAL: "withdrawal-10", CONSENT: "consent-10", DELETION: "deletion-10", REVOCATION: "revocation-10",
};

const restoreHarness = () => {
  const calls: string[] = [];
  const applied: unknown[] = [];
  let released: readonly string[] = [];
  const vault: RestrictedVaultRestorePort = {
    beginSealed: ({ restoreId }) => calls.push(`SEALED:${restoreId}`),
    applyLedger: (input) => {
      calls.push(`APPLY:${input.ledger}`);
      applied.push(input);
    },
    release: ({ includedCopyIds }) => {
      calls.push("RELEASE");
      released = includedCopyIds;
    },
  };
  const coordinator = new RestoreCoordinator({
    vault,
    currentWatermarks: watermarks,
    primaryOperator: operator,
    backupOperator: backup,
    configuredVerifier: verifier,
  });
  return { coordinator, calls, applied, released: () => released };
};

const passedReplay = (ledger: RestoreLedger) => ({
  restoreId: "restore-1",
  ledger,
  evidenceId: `${ledger.toLowerCase()}-evidence`,
  evidenceHash: `${ledger.toLowerCase()}-hash`,
  watermark: watermarks[ledger],
  outcome: "PASSED" as const,
  effects: {
    withdrawnCopyIds: ledger === "WITHDRAWAL" ? ["copy-withdrawn"] : [],
    nonconsentingCopyIds: ledger === "CONSENT" ? ["copy-no-consent"] : [],
    deletedCopyIds: ledger === "DELETION" ? ["copy-deleted"] : [],
    revokedCopyIds: ledger === "REVOCATION" ? ["copy-revoked"] : [],
  },
  operator,
  replayedAt: "2026-07-13T10:00:00Z",
});

describe("provider inventory and restore reconciliation", () => {
  it("freezes a complete exact versioned seven-category inventory", () => {
    const inventory = createProviderInventory(inventoryInput());
    expect(inventory.entries.map(({ category }) => category)).toEqual(categories);
    expect(Object.isFrozen(inventory)).toBe(true);
    expect(Object.isFrozen(inventory.entries)).toBe(true);
    expect(inventory.deploymentDecision()).toEqual({ deployment: "ALLOWED", processing: "ALLOWED", status: "VALIDATED_TEST_FIXTURE" });
    expect(Object.isFrozen(inventory.dataFlowRegister.nodes)).toBe(true);
  });

  it.each([
    ["missing", { entries: categories.slice(0, -1).map((category) => entry(category)) }],
    ["extra", { entries: [...categories.map((category) => entry(category)), entry("STORE", { entryId: "extra" })] }],
    ["duplicate", { entries: [...categories.map((category) => entry(category)), entry("STORE")] }],
  ])("rejects %s inventory IDs", (_label, override) => {
    expect(() => createProviderInventory({ ...inventoryInput(), ...override })).toThrowError(ProviderRuleError);
  });

  it.each([
    ["category", { category: "LOG" }],
    ["fields", { fields: ["other-field"] }],
    ["retention", { retention: { signedBy: "Don", ceilingDays: 29 } }],
    ["backup", { backupExpiryDays: 34 }],
  ])("rejects inventory/register %s mismatch", (_label, invalid) => {
    const input = inventoryInput();
    input.entries[0] = entry("STORE", invalid);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it.each(["", " ", "rawCode", "prompt", "freeText", "ipFingerprint", "fullUserAgent", "secret", "recruitmentIdentity"])(
    "rejects register field %j",
    (field) => {
      const input = inventoryInput();
      input.dataFlowRegister.nodes[0] = { ...input.dataFlowRegister.nodes[0]!, fields: [field] };
      expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
    },
  );

  it("validates the versioned project-controlled provider schedule", () => {
    const inventory = createProviderInventory(providerSchedule);
    expect(inventory.dataFlowRegister.nodes.map(({ category }) => category)).toEqual(categories);
    expect(inventory.entries).toEqual([]);
    expect(inventory.deploymentDecision()).toEqual({
      deployment: "BLOCKED", processing: "BLOCKED", status: "BLOCKED_PENDING_DON_PROVIDER_SCHEDULE",
    });
    expect(Object.isFrozen(inventory.blockers)).toBe(true);
    expect(inventory.blockers.length).toBeGreaterThan(0);
  });

  it.each([
    ["provider identity", { providerIdentity: "other" }],
    ["approval ID", { approval: { approvalId: "other", approvalHash: "test-hash-store", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" } }],
    ["approval hash", { approval: { approvalId: "test-approval-store", approvalHash: "other", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" } }],
    ["approval time", { approval: { approvalId: "test-approval-store", approvalHash: "test-hash-store", approvedAt: "2026-07-13T10:00:00Z", approver: "Don" } }],
  ])("rejects USED %s mismatch", (_label, invalid) => {
    const input = inventoryInput();
    input.entries[0] = entry("STORE", invalid);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it.each([
    ["purpose", { purpose: "Different purpose" }],
    ["processing basis", { processingBasis: "Different basis" }],
    ["access owner", { accessOwner: "Different owner" }],
    ["deletion capability", { deletionCapability: "DIFFERENT" }],
    ["propagation rule", { propagationRule: "Different propagation" }],
    ["restoration behavior", { restorationBehavior: "DIRECT_RELEASE" }],
  ])("rejects USED register/entry %s mismatch", (_label, invalid) => {
    const input = inventoryInput();
    input.entries[0] = entry("STORE", invalid);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it("allows multiple unique USED entries in one category while retaining complete category coverage", () => {
    const input = inventoryInput();
    input.dataFlowRegister.nodes.push({
      ...input.dataFlowRegister.nodes[0]!, entryId: "store-secondary", fields: ["store-secondary-field"],
      providerIdentity: "test-provider-store-secondary",
      approval: { approvalId: "test-approval-store-secondary", approvalHash: "test-hash-store-secondary", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" },
    });
    input.entries.push(entry("STORE", {
      entryId: "store-secondary", fields: ["store-secondary-field"], providerIdentity: "test-provider-store-secondary",
      approval: { approvalId: "test-approval-store-secondary", approvalHash: "test-hash-store-secondary", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" },
    }));
    expect(createProviderInventory(input).entries.filter(({ category }) => category === "STORE")).toHaveLength(2);

    const missingCategory = inventoryInput();
    missingCategory.dataFlowRegister.nodes = missingCategory.dataFlowRegister.nodes.filter(({ category }) => category !== "STORE");
    missingCategory.entries = missingCategory.entries.filter(({ category }) => category !== "STORE");
    expect(() => createProviderInventory(missingCategory)).toThrowError(ProviderRuleError);
  });

  it("accepts evidenced NOT_USED without an entry and blocks evidenced UNRESOLVED", () => {
    const notUsed = inventoryInput();
    notUsed.dataFlowRegister.nodes[0] = {
      ...notUsed.dataFlowRegister.nodes[0]!, usage: "NOT_USED" as const,
      decisionEvidence: "test-decision-1", decisionReason: "Not used in beta",
      decisionApproval: { approvalId: "not-used-approval-1", approvalHash: "not-used-hash-1", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" },
    };
    notUsed.entries = notUsed.entries.slice(1);
    expect(createProviderInventory(notUsed).deploymentDecision().deployment).toBe("ALLOWED");

    const unresolved = inventoryInput();
    unresolved.dataFlowRegister.nodes[0] = { ...unresolved.dataFlowRegister.nodes[0]!, usage: "UNRESOLVED" as const, blocker: "Awaiting Don-approved provider evidence" };
    unresolved.entries = unresolved.entries.slice(1);
    expect(createProviderInventory(unresolved).deploymentDecision()).toEqual({ deployment: "BLOCKED", processing: "BLOCKED", status: "BLOCKED_PENDING_DON_PROVIDER_SCHEDULE" });
  });

  it.each([
    ["missing", undefined],
    ["blank ID", { approvalId: " ", approvalHash: "hash", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" }],
    ["blank hash", { approvalId: "id", approvalHash: " ", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" }],
    ["invalid time", { approvalId: "id", approvalHash: "hash", approvedAt: "bad", approver: "Don" }],
    ["wrong approver", { approvalId: "id", approvalHash: "hash", approvedAt: "2026-07-13T09:00:00Z", approver: "Owner" }],
  ])("never allows NOT_USED with %s decision approval", (_label, decisionApproval) => {
    const input = inventoryInput();
    input.dataFlowRegister.nodes[0] = {
      ...input.dataFlowRegister.nodes[0]!, usage: "NOT_USED" as const,
      decisionEvidence: "decision", decisionReason: "Not used", decisionApproval,
    };
    input.entries = input.entries.slice(1);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it.each([
    ["non-Don approval", { approvedBy: "Owner" }],
    ["blank purpose", { purpose: " " }],
    ["blank basis", { processingBasis: " " }],
    ["duplicate fields", { fields: ["one", "one"] }],
    ["blank owner", { accessOwner: " " }],
    ["unsigned retention", { retention: { signedBy: "Owner", ceilingDays: 30 } }],
    ["missing deletion", { deletionCapability: "" }],
    ["missing propagation", { propagationRule: "" }],
    ["unsafe restore", { restorationBehavior: "DIRECT_RELEASE" }],
    ["retention overrun", { actualGuarantees: { retentionDays: 31, backupExpiryDays: 35, deletionSupported: true } }],
    ["backup overrun", { actualGuarantees: { retentionDays: 30, backupExpiryDays: 36, deletionSupported: true } }],
    ["no deletion guarantee", { actualGuarantees: { retentionDays: 30, backupExpiryDays: 35, deletionSupported: false } }],
    ["forbidden telemetry", { fields: ["rawCode"] }],
  ])("fails deployment closed for %s", (_label, invalid) => {
    const input = inventoryInput();
    input.entries[0] = entry("STORE", invalid);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it("requires distinct named primary and backup restore operators with least privilege", () => {
    const { coordinator, calls } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok", "copy-deleted"], startedAt: "2026-07-13T09:00:00Z" });
    expect(calls).toEqual(["SEALED:restore-1"]);
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED", reconciliation: "PENDING" });
    expect(() => new RestoreCoordinator({ vault: {} as RestrictedVaultRestorePort, currentWatermarks: watermarks, primaryOperator: operator, backupOperator: operator })).toThrowError();
    for (const invalid of [
      { ...backup, operatorId: "" }, { ...backup, operatorName: "" }, { ...backup, role: "RESTORE_VERIFIER" as const },
    ]) expect(() => new RestoreCoordinator({ vault: {} as RestrictedVaultRestorePort, currentWatermarks: watermarks, primaryOperator: operator, backupOperator: invalid })).toThrowError();
    expect(() => coordinator.begin({ restoreId: "restore-2", operator: { ...operator, operatorId: "unconfigured" }, copyIds: ["copy"], startedAt: "2026-07-13T09:00:00Z" })).toThrowError();
  });

  it("denies a configured operator ID paired with a spoofed name", () => {
    const { coordinator } = restoreHarness();
    expect(() => coordinator.begin({
      restoreId: "restore-spoof", operator: { ...operator, operatorName: "Spoofed Name" },
      copyIds: ["copy"], startedAt: "2026-07-13T09:00:00Z",
    })).toThrowError();
    expect(coordinator.auditRecords().at(-1)).toMatchObject({ outcome: "DENIED", actorName: "UNVERIFIED" });
  });

  it.each([
    ["wrong restore", { restoreId: "wrong" }],
    ["blank evidence", { evidenceId: " " }],
    ["blank hash", { evidenceHash: " " }],
    ["stale watermark", { watermark: "withdrawal-9" }],
    ["failed replay", { outcome: "FAILED" }],
  ])("keeps a restore sealed for %s", (_label, override) => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    expect(() => coordinator.recordReplay({ ...passedReplay("WITHDRAWAL"), ...override } as ReturnType<typeof passedReplay>)).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
  });

  it("rejects duplicate or missing ledger evidence and reconciliation failure", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    coordinator.recordReplay(passedReplay("WITHDRAWAL"));
    expect(() => coordinator.recordReplay(passedReplay("WITHDRAWAL"))).toThrowError();
    expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: false, reconciledAt: "2026-07-13T11:00:00Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
  });

  it.each(["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const)(
    "keeps release sealed when %s evidence is missing despite passed reconciliation",
    (missing) => {
      const { coordinator } = restoreHarness();
      coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
      for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) if (ledger !== missing) coordinator.recordReplay(passedReplay(ledger));
      expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" })).toThrowError();
      expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
    },
  );

  it("keeps immutable replay evidence and denies release before reconciliation", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    coordinator.recordReplay(passedReplay("WITHDRAWAL"));
    expect(Object.isFrozen(coordinator.replayEvidence("restore-1"))).toBe(true);
    expect(Object.isFrozen(coordinator.replayEvidence("restore-1")[0])).toBe(true);
    expect(() => coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T12:00:00Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
  });

  it("keeps a fully replayed restore sealed when reconciliation reports failure", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: false, reconciledAt: "2026-07-13T11:00:00Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
  });

  it("applies all four ledgers in order and excludes affected copies before independent release", () => {
    const { coordinator, calls, applied, released } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok", "copy-withdrawn", "copy-no-consent", "copy-deleted", "copy-revoked"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    expect(calls.slice(1)).toEqual(["APPLY:WITHDRAWAL", "APPLY:CONSENT", "APPLY:DELETION", "APPLY:REVOCATION"]);
    expect(applied).toEqual(["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"].map((ledger) => expect.objectContaining({
      restoreId: "restore-1", ledger, watermark: watermarks[ledger as RestoreLedger], evidenceId: `${ledger.toLowerCase()}-evidence`, effects: expect.any(Object),
    })));
    expect(() => coordinator.release({ restoreId: "restore-1", verifier: operator, releasedAt: "2026-07-13T12:00:00Z" })).toThrowError();
    coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T12:00:00Z" });
    expect(released()).toEqual(["copy-ok"]);
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "RELEASED", deletedDataClaim: "NEVER_RESTORED" });
  });

  it("requires a named role-correct verifier independent of the actual initiator", () => {
    for (const invalidVerifier of [
      operator,
      { ...verifier, operatorName: "" },
      { ...verifier, role: "RESTORE_OPERATOR" as const },
    ]) {
      const { coordinator } = restoreHarness();
      coordinator.begin({ restoreId: "restore-1", operator: backup, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
      for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay({ ...passedReplay(ledger), operator: backup });
      coordinator.reconcile({ restoreId: "restore-1", operator: backup, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
      expect(() => coordinator.release({ restoreId: "restore-1", verifier: invalidVerifier, releasedAt: "2026-07-13T12:00:00Z" })).toThrowError();
      expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
    }
  });

  it("keeps minimized frozen audit and status outputs free of forbidden fields and secrets", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator: backup, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    const serialized = JSON.stringify({ status: coordinator.safeStatus("restore-1"), audits: coordinator.auditRecords() });
    for (const field of ["rawCode", "prompt", "freeText", "ipFingerprint", "fullUserAgent", "secret", "recruitmentIdentity", "evidenceHash"]) expect(serialized).not.toContain(field);
    expect(Object.isFrozen(coordinator.auditRecords())).toBe(true);
    expect(coordinator.auditRecords().every(Object.isFrozen)).toBe(true);
    expect(coordinator.auditRecords()).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "BEGIN", actorName: "Backup Operator" }),
    ]));
  });

  it("rejects a runtime-unknown usage instead of treating it as unresolved", () => {
    const input = inventoryInput();
    input.dataFlowRegister.nodes[0] = { ...input.dataFlowRegister.nodes[0]!, usage: "INVALID" as "USED", blocker: "looks blocked" };
    input.entries = input.entries.slice(1);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it.each([
    ["node retention NaN", (input: ReturnType<typeof inventoryInput>) => { input.dataFlowRegister.nodes[0]!.retention.ceilingDays = Number.NaN; }],
    ["node retention zero", (input: ReturnType<typeof inventoryInput>) => { input.dataFlowRegister.nodes[0]!.retention.ceilingDays = 0; }],
    ["node retention fraction", (input: ReturnType<typeof inventoryInput>) => { input.dataFlowRegister.nodes[0]!.retention.ceilingDays = 1.5; }],
    ["node backup infinity", (input: ReturnType<typeof inventoryInput>) => { input.dataFlowRegister.nodes[0]!.backup.ceilingDays = Number.POSITIVE_INFINITY; }],
    ["entry retention NaN", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.retention.ceilingDays = Number.NaN; }],
    ["entry backup NaN", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.backupExpiryDays = Number.NaN; }],
    ["actual retention NaN", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.retentionDays = Number.NaN; }],
    ["actual retention negative", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.retentionDays = -1; }],
    ["actual retention fraction", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.retentionDays = 1.5; }],
    ["actual backup infinity", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.backupExpiryDays = Number.POSITIVE_INFINITY; }],
    ["actual backup negative", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.backupExpiryDays = -1; }],
    ["malformed string", (input: ReturnType<typeof inventoryInput>) => { input.entries[0]!.actualGuarantees.backupExpiryDays = "35" as unknown as number; }],
  ])("rejects malformed provider days: %s", (_label, mutate) => {
    const input = inventoryInput(); mutate(input);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it("allows zero-day actual guarantees under positive signed ceilings", () => {
    const input = inventoryInput();
    input.entries[0]!.actualGuarantees.retentionDays = 0;
    input.entries[0]!.actualGuarantees.backupExpiryDays = 0;
    expect(createProviderInventory(input).deploymentDecision().deployment).toBe("ALLOWED");
  });

  it.each(["NOT_USED", "UNRESOLVED"] as const)("allows empty fields for %s", (usage) => {
    const base = inventoryInput();
    const approval = { decisionEvidence: "decision", decisionReason: "reason", decisionApproval: { approvalId: "id", approvalHash: "hash", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" } };
    const usageDetails = usage === "NOT_USED" ? approval : { blocker: "pending evidence" };
    base.dataFlowRegister.nodes[0] = { ...base.dataFlowRegister.nodes[0]!, usage, fields: [], ...usageDetails };
    base.entries = base.entries.slice(1);
    expect(() => createProviderInventory(base)).not.toThrow();
  });

  it.each([
    ["USED", "blank", [" "]],
    ["USED", "duplicate", ["one", "one"]],
    ["USED", "forbidden", ["rawCode"]],
    ["NOT_USED", "blank", [" "]],
    ["NOT_USED", "duplicate", ["one", "one"]],
    ["NOT_USED", "forbidden", ["rawCode"]],
    ["UNRESOLVED", "blank", [" "]],
    ["UNRESOLVED", "duplicate", ["one", "one"]],
    ["UNRESOLVED", "forbidden", ["rawCode"]],
  ] as const)("rejects %s %s fields", (usage, _label, fields) => {
    const input = inventoryInput();
    const approval = { decisionEvidence: "decision", decisionReason: "reason", decisionApproval: { approvalId: "id", approvalHash: "hash", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" } };
    const usageDetails = usage === "NOT_USED" ? approval : { blocker: "pending evidence" };
    input.dataFlowRegister.nodes[0] = { ...input.dataFlowRegister.nodes[0]!, usage, fields: [...fields], ...usageDetails };
    if (usage !== "USED") input.entries = input.entries.slice(1);
    expect(() => createProviderInventory(input)).toThrowError(ProviderRuleError);
  });

  it("allows blank processing basis only when the register marks it not applicable", () => {
    const input = inventoryInput();
    input.dataFlowRegister.nodes[0] = { ...input.dataFlowRegister.nodes[0]!, processingBasisApplicable: false, processingBasis: "" };
    input.entries[0] = entry("STORE", { processingBasis: "" });
    expect(createProviderInventory(input).deploymentDecision().deployment).toBe("ALLOWED");
  });

  it("deep-freezes durable USED and NOT_USED approval evidence", () => {
    const used = createProviderInventory(inventoryInput());
    expect(Object.isFrozen(used.dataFlowRegister.nodes[0]?.approval)).toBe(true);
    expect(Object.isFrozen(used.entries[0]?.approval)).toBe(true);
    const input = inventoryInput();
    input.dataFlowRegister.nodes[0] = { ...input.dataFlowRegister.nodes[0]!, usage: "NOT_USED", decisionEvidence: "decision", decisionReason: "reason", decisionApproval: { approvalId: "id", approvalHash: "hash", approvedAt: "2026-07-13T09:00:00Z", approver: "Don" } };
    input.entries = input.entries.slice(1);
    const notUsed = createProviderInventory(input);
    expect(Object.isFrozen(notUsed.dataFlowRegister.nodes[0]?.decisionApproval)).toBe(true);
  });

  it("rejects replay evidence timestamped before restore begin", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    expect(() => coordinator.recordReplay({ ...passedReplay("WITHDRAWAL"), replayedAt: "2026-07-13T08:59:59Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED", reconciliation: "PENDING" });
  });

  it("rejects reconciliation timestamped before the latest replay", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T09:59:59Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED", reconciliation: "PENDING" });
  });

  it("rejects release timestamped before reconciliation", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    expect(() => coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T10:59:59Z" })).toThrowError();
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED", reconciliation: "PASSED" });
  });

  it.each([["blank", [""]], ["duplicate", ["copy", "copy"]]] as const)("rejects %s restore copy IDs", (_label, copyIds) => {
    const { coordinator } = restoreHarness();
    expect(() => coordinator.begin({ restoreId: "restore-copy", operator, copyIds, startedAt: "2026-07-13T09:00:00Z" })).toThrowError();
  });

  it("denies repeated reconciliation without reapplying ledgers", () => {
    const { coordinator, calls } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:01:00Z" })).toThrowError();
    expect(calls.filter((call) => call.startsWith("APPLY:"))).toHaveLength(4);
  });

  it("denies repeated release without rereleasing copies", () => {
    const { coordinator, calls } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T12:00:00Z" });
    expect(() => coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T12:01:00Z" })).toThrowError();
    expect(calls.filter((call) => call === "RELEASE")).toHaveLength(1);
  });

  it.each([
    ["blank ID", { ...verifier, operatorId: " " }],
    ["blank name", { ...verifier, operatorName: " " }],
    ["wrong role", { ...verifier, role: "RESTORE_OPERATOR" as const }],
    ["primary ID", { ...verifier, operatorId: operator.operatorId }],
    ["backup ID", { ...verifier, operatorId: backup.operatorId }],
    ["primary name", { ...verifier, operatorName: operator.operatorName }],
    ["backup name", { ...verifier, operatorName: backup.operatorName }],
  ])("rejects configured verifier with %s", (_label, configuredVerifier) => {
    expect(() => new RestoreCoordinator({ vault: {} as RestrictedVaultRestorePort, currentWatermarks: watermarks, primaryOperator: operator, backupOperator: backup, configuredVerifier })).toThrowError();
  });

  it.each([
    ["self-asserted ID", { ...verifier, operatorId: "self-asserted" }],
    ["spoofed name", { ...verifier, operatorName: "Spoofed Verifier" }],
  ])("denies release by a verifier with %s", (_label, assertedVerifier) => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    expect(() => coordinator.release({ restoreId: "restore-1", verifier: assertedVerifier, releasedAt: "2026-07-13T12:00:00Z" })).toThrowError();
    expect(coordinator.auditRecords().at(-1)).toMatchObject({ actorName: "UNVERIFIED", outcome: "DENIED" });
  });

  it.each(["begin", "replay", "reconcile", "release"] as const)("denies malformed %s time while staying sealed", (stage) => {
    const { coordinator } = restoreHarness();
    if (stage === "begin") {
      expect(() => coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "bad" })).toThrowError();
      return;
    }
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    if (stage === "replay") expect(() => coordinator.recordReplay({ ...passedReplay("WITHDRAWAL"), replayedAt: "bad" })).toThrowError();
    else {
      for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
      if (stage === "reconcile") expect(() => coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "bad" })).toThrowError();
      else {
        coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
        expect(() => coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "bad" })).toThrowError();
      }
    }
    expect(coordinator.safeStatus("restore-1")).toMatchObject({ reachability: "SEALED" });
    expect(coordinator.auditRecords().at(-1)).toMatchObject({ outcome: "DENIED", reasonCode: "INVALID_TIME" });
  });

  it("records sequenced named minimized audits for begin, four replays, denial, reconcile and release", () => {
    const { coordinator } = restoreHarness();
    coordinator.begin({ restoreId: "restore-1", operator, copyIds: ["copy-ok"], startedAt: "2026-07-13T09:00:00Z" });
    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) coordinator.recordReplay(passedReplay(ledger));
    expect(() => coordinator.recordReplay(passedReplay("WITHDRAWAL"))).toThrowError();
    coordinator.reconcile({ restoreId: "restore-1", operator, passed: true, reconciledAt: "2026-07-13T11:00:00Z" });
    coordinator.release({ restoreId: "restore-1", verifier, releasedAt: "2026-07-13T12:00:00Z" });
    expect(coordinator.auditRecords()).toEqual([
      expect.objectContaining({ sequence: 1, action: "BEGIN", actorName: "Primary Operator", occurredAt: "2026-07-13T09:00:00.000Z" }),
      ...(["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const).map((ledger, index) => expect.objectContaining({ sequence: index + 2, action: "REPLAY", ledger, actorName: "Primary Operator", occurredAt: "2026-07-13T10:00:00.000Z" })),
      expect.objectContaining({ sequence: 6, action: "REPLAY", outcome: "DENIED", reasonCode: "DUPLICATE_LEDGER" }),
      expect.objectContaining({ sequence: 7, action: "RECONCILE", actorName: "Primary Operator", occurredAt: "2026-07-13T11:00:00.000Z" }),
      expect.objectContaining({ sequence: 8, action: "RELEASE", actorName: "Independent Verifier", occurredAt: "2026-07-13T12:00:00.000Z" }),
    ]);
    expect(JSON.stringify(coordinator.auditRecords())).not.toContain("evidenceHash");
  });
});
