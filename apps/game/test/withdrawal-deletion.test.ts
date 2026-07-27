import { describe, expect, it } from "vitest";

import {
  DeletionCase,
  PrivacyRuleError,
  WithdrawalCoordinator,
  applyLegalHold,
  calculateRetentionDeadline,
  createLegalHold,
  renewLegalHold,
  type AtomicWithdrawalBundle,
} from "../src/server/privacy/withdrawal/withdrawal.js";

const withdrawalInput = {
  participantLineageId: "lineage-1",
  authenticationProof: "secret-auth-proof",
  requestedAt: "2026-07-02T10:00:00.000Z",
};

const harness = (options: { authenticated?: boolean; failCommit?: boolean; failAfterCascadeCommit?: boolean } = {}) => {
  let prepared = 0;
  let commits = 0;
  const revoked = new Set<string>();
  let committed: AtomicWithdrawalBundle | undefined;
  const coordinator = new WithdrawalCoordinator({
    authenticator: { authenticate: () => options.authenticated ?? true },
    deletionCaseIdGenerator: { generate: () => "deletion-case-1" },
    credentialCascade: {
      prepare: (participantLineageId) => {
        prepared += 1;
        return Object.freeze({
          participantLineageId,
          descendantCredentialIds: ["daily-1", "reveal-1"],
          commit: () => {
            revoked.add("daily-1");
            revoked.add("reveal-1");
          },
          rollback: () => {
            revoked.delete("daily-1");
            revoked.delete("reveal-1");
          },
        });
      },
    },
    transaction: {
      commit: (bundle) => {
        commits += 1;
        if (options.failCommit) throw new Error("atomic commit failed");
        bundle.cascade.commit();
        if (options.failAfterCascadeCommit) throw new Error("commit failed after cascade");
        committed = bundle;
      },
    },
  });
  return { coordinator, prepared: () => prepared, commits: () => commits, committed: () => committed, revoked };
};

describe("withdrawal and deletion", () => {
  it("does nothing when accountless authentication fails", () => {
    const subject = harness({ authenticated: false });
    expect(() => subject.coordinator.withdraw(withdrawalInput)).toThrowError(
      new PrivacyRuleError("Withdrawal authentication failed"),
    );
    expect({ prepared: subject.prepared(), commits: subject.commits() }).toEqual({ prepared: 0, commits: 0 });
    expect(subject.coordinator.safeState("lineage-1")).toBeUndefined();
  });

  it("commits every distinct withdrawal effect in one authoritative transaction", () => {
    const subject = harness();
    const result = subject.coordinator.withdraw(withdrawalInput);
    expect(subject.prepared()).toBe(1);
    expect(subject.commits()).toBe(1);
    expect(subject.committed()?.facts.map(({ factType }) => factType)).toEqual([
      "CONSENT_WITHDRAWN",
      "ANALYSIS_EXCLUDED",
      "CREDENTIAL_CASCADE_REVOKED",
      "OPTIONAL_TELEMETRY_DISABLED",
      "OPTIONAL_PROCESSING_STOPPED",
      "DELETION_CASE_OPENED",
      "WITHDRAWAL_AUDITED",
    ]);
    expect(subject.committed()?.cascade.descendantCredentialIds).toEqual(["daily-1", "reveal-1"]);
    expect([...subject.revoked]).toEqual(["daily-1", "reveal-1"]);
    expect(result.deletionCase.caseId).toBe("deletion-case-1");
    expect(result.physicalDeletionMode).toBe("ASYNCHRONOUS");
    expect(subject.coordinator.safeState("lineage-1")).toMatchObject({
      consent: "WITHDRAWN",
      analysis: "EXCLUDED",
      optionalTelemetry: "DISABLED",
      optionalProcessing: "STOPPED",
    });
  });

  it("publishes no state and performs no external revocation when atomic commit fails", () => {
    const subject = harness({ failCommit: true });
    expect(() => subject.coordinator.withdraw(withdrawalInput)).toThrowError("atomic commit failed");
    expect(subject.prepared()).toBe(1);
    expect(subject.commits()).toBe(1);
    expect(subject.coordinator.safeState("lineage-1")).toBeUndefined();
    expect(subject.coordinator.auditRecords()).toEqual([]);
    expect(subject.revoked.size).toBe(0);
  });

  it("rolls staged credential revocation back when the transaction fails after cascade commit", () => {
    const subject = harness({ failAfterCascadeCommit: true });
    expect(() => subject.coordinator.withdraw(withdrawalInput)).toThrowError("commit failed after cascade");
    expect(subject.revoked.size).toBe(0);
    expect(subject.coordinator.safeState("lineage-1")).toBeUndefined();
    expect(subject.coordinator.auditRecords()).toEqual([]);
  });

  it("enforces optional telemetry and processing only after a committed withdrawal", () => {
    const successful = harness();
    let processed = 0;
    expect(successful.coordinator.optionalTelemetryDecision("lineage-1")).toEqual({ allowed: true });
    expect(successful.coordinator.runOptionalProcessing("lineage-1", () => processed++)).toEqual({ allowed: true });
    successful.coordinator.withdraw(withdrawalInput);
    expect(successful.coordinator.optionalTelemetryDecision("lineage-1")).toEqual({ allowed: false, reason: "WITHDRAWN" });
    expect(successful.coordinator.runOptionalProcessing("lineage-1", () => processed++)).toEqual({ allowed: false, reason: "WITHDRAWN" });
    expect(processed).toBe(1);

    for (const subject of [harness({ authenticated: false }), harness({ failCommit: true })]) {
      expect(() => subject.coordinator.withdraw(withdrawalInput)).toThrowError();
      expect(subject.coordinator.optionalTelemetryDecision("lineage-1")).toEqual({ allowed: true });
      expect(subject.coordinator.runOptionalProcessing("lineage-1", () => undefined)).toEqual({ allowed: true });
    }
  });

  it("tracks append-only asynchronous deletion steps and exact 7/30/35-day boundaries", () => {
    let deletionCase = DeletionCase.open({
      caseId: "case-1",
      participantLineageId: "lineage-1",
      openedAt: "2026-07-02T10:00:00.000Z",
    });
    expect(deletionCase.deadlines()).toEqual({
      acknowledgementDueAt: "2026-07-09T10:00:00.000Z",
      activeStoresDueAt: "2026-08-01T10:00:00.000Z",
      backupsDueAt: "2026-08-06T10:00:00.000Z",
    });
    for (const [at, field] of [
      ["2026-07-09T10:00:00.000Z", "acknowledgementOverdue"],
      ["2026-08-01T10:00:00.000Z", "activeStoresOverdue"],
      ["2026-08-06T10:00:00.000Z", "backupsOverdue"],
    ] as const) {
      expect(deletionCase.statusAt(at)[field]).toBe(false);
      expect(deletionCase.statusAt(new Date(Date.parse(at) + 1).toISOString())[field]).toBe(true);
    }
    deletionCase = deletionCase
      .record({ stepType: "ACKNOWLEDGED", occurredAt: "2026-07-03T10:00:00Z" })
      .record({ stepType: "ACTIVE_STORES_COMPLETED", occurredAt: "2026-07-04T10:00:00Z" })
      .record({ stepType: "DERIVED_RECORDS_COMPLETED", occurredAt: "2026-07-04T11:00:00Z", treatment: "DELETE" })
      .record({ stepType: "PROVIDER_PROPAGATED", occurredAt: "2026-07-04T13:00:00Z", providerReference: "provider-case-1" })
      .record({ stepType: "BACKUPS_AGED_OUT", occurredAt: "2026-07-05T10:00:00Z" });
    expect(deletionCase.history().map(({ stepType }) => stepType)).toEqual([
      "CASE_OPENED", "ACKNOWLEDGED", "ACTIVE_STORES_COMPLETED", "DERIVED_RECORDS_COMPLETED",
      "PROVIDER_PROPAGATED", "BACKUPS_AGED_OUT",
    ]);
    expect(Object.isFrozen(deletionCase.history())).toBe(true);
    expect(deletionCase.stepState()).toEqual({
      acknowledged: true,
      activeStoresCompleted: true,
      derivedTreatment: "DELETE",
      providerPropagated: true,
      backupsAgedOut: true,
      deadlineMisses: [],
    });
    expect(deletionCase.statusAt("2026-09-01T00:00:00Z")).toMatchObject({
      acknowledgementOverdue: false,
      activeStoresOverdue: false,
      backupsOverdue: false,
    });
    expect(() => deletionCase.record({
      stepType: "DERIVED_RECORDS_COMPLETED",
      occurredAt: "2026-07-04T12:00:00Z",
      treatment: "IRREVERSIBLY_DELINK",
    })).toThrowError("Derived-record treatment is already final");

    const delinked = DeletionCase.open({
      caseId: "case-2", participantLineageId: "lineage-2", openedAt: "2026-07-02T10:00:00Z",
    }).record({
      stepType: "DERIVED_RECORDS_COMPLETED",
      occurredAt: "2026-07-04T12:00:00Z",
      treatment: "IRREVERSIBLY_DELINK",
    });
    expect(delinked.stepState().derivedTreatment).toBe("IRREVERSIBLY_DELINK");
  });

  it("rejects a deletion step before case open", () => {
    const opened = DeletionCase.open({ caseId: "late-case", participantLineageId: "lineage-1", openedAt: "2026-07-02T10:00:00Z" });
    expect(() => opened.record({ stepType: "ACKNOWLEDGED", occurredAt: "2026-07-02T09:59:59Z" })).toThrowError("Deletion step cannot precede case open");
  });

  it("ignores future deletion steps in an as-of status query", () => {
    const opened = DeletionCase.open({ caseId: "future-case", participantLineageId: "lineage-1", openedAt: "2026-07-02T10:00:00Z" });
    const futureAcknowledged = opened.record({ stepType: "ACKNOWLEDGED", occurredAt: "2026-07-10T10:00:00Z" });
    expect(futureAcknowledged.statusAt("2026-07-09T10:00:00.001Z").acknowledgementOverdue).toBe(true);
  });

  it.each([
    ["acknowledgement", "ACKNOWLEDGED", "2026-07-09T10:00:00.001Z", "ACKNOWLEDGEMENT", "acknowledgementOverdue"],
    ["active stores", "ACTIVE_STORES_COMPLETED", "2026-08-01T10:00:00.001Z", "ACTIVE_STORES", "activeStoresOverdue"],
    ["backups", "BACKUPS_AGED_OUT", "2026-08-06T10:00:00.001Z", "BACKUPS", "backupsOverdue"],
  ] as const)("preserves a durable late %s miss after completion", (_label, stepType, occurredAt, miss, statusField) => {
      const opened = DeletionCase.open({ caseId: `late-${stepType}`, participantLineageId: "lineage-1", openedAt: "2026-07-02T10:00:00Z" });
      const completed = opened.record({ stepType, occurredAt });
      expect(completed.stepState().deadlineMisses).toContain(miss);
      expect(completed.history().some((step) => step.stepType === "DEADLINE_MISSED")).toBe(true);
      expect(completed.statusAt("2026-09-01T00:00:00Z")[statusField]).toBe(false);
  });

  it.each([
    ["raw", { storageClass: "RAW_GAMEPLAY_OR_RECRUITMENT_BRIDGE", betaClosedAt: "2026-07-10T00:00:00Z", withdrawalAt: "2026-07-02T00:00:00Z" }, "2026-08-01T00:00:00.000Z", "WITHDRAWAL_PLUS_30_DAYS"],
    ["raw beta close", { storageClass: "RAW_GAMEPLAY_OR_RECRUITMENT_BRIDGE", betaClosedAt: "2026-07-01T00:00:00Z", withdrawalAt: "2026-07-02T00:00:00Z" }, "2026-07-31T00:00:00.000Z", "BETA_CLOSE_PLUS_30_DAYS"],
    ["provider", { storageClass: "PROVIDER_CDN_APP_LOG", createdAt: "2026-07-01T00:00:00Z", propagatedDeletionDeadline: "2026-07-05T00:00:00Z" }, "2026-07-05T00:00:00.000Z", "PROPAGATED_OR_PROVIDER_RULE"],
    ["provider creation", { storageClass: "PROVIDER_CDN_APP_LOG", createdAt: "2026-07-01T00:00:00Z", propagatedDeletionDeadline: "2026-08-05T00:00:00Z" }, "2026-07-31T00:00:00.000Z", "CREATION_PLUS_30_DAYS"],
    ["temporary", { storageClass: "TEMP_EXPORT_OR_SUPPORT", createdAt: "2026-07-10T00:00:00Z", requestAt: "2026-07-02T00:00:00Z" }, "2026-07-09T00:00:00.000Z", "REQUEST_PLUS_7_DAYS"],
    ["temporary creation", { storageClass: "TEMP_EXPORT_OR_SUPPORT", createdAt: "2026-07-01T00:00:00Z", requestAt: "2026-07-02T00:00:00Z" }, "2026-07-08T00:00:00.000Z", "CREATION_PLUS_7_DAYS"],
    ["backup", { storageClass: "PROJECT_BACKUP", createdAt: "2026-07-01T00:00:00Z", propagatedAt: "2026-07-02T00:00:00Z" }, "2026-08-05T00:00:00.000Z", "CREATION_PLUS_35_DAYS"],
    ["backup propagation", { storageClass: "PROJECT_BACKUP", createdAt: "2026-07-10T00:00:00Z", propagatedAt: "2026-07-02T00:00:00Z" }, "2026-08-06T00:00:00.000Z", "PROPAGATION_PLUS_35_DAYS"],
  ] as const)("uses the earliest %s retention deadline with evidence", (_label, input, deadline, source) => {
    const result = calculateRetentionDeadline(input);
    expect(result).toMatchObject({ deadline, controllingSource: source });
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.isOverdueAt(deadline)).toBe(false);
    expect(result.isOverdueAt(new Date(Date.parse(deadline) + 1).toISOString())).toBe(true);
  });

  it("preserves base deadlines under valid scoped holds and requires counsel evidence for renewal", () => {
    const hold = createLegalHold({
      holdId: "hold-1", approver: "Privacy Counsel", purpose: "Named dispute", fields: ["answer-events"],
      copyIds: ["copy-1"], startedAt: "2026-07-01T00:00:00Z", reviewEveryDays: 30, expiresAt: "2026-12-28T00:00:00Z",
    });
    expect(hold.nextReviewAt).toBe("2026-07-31T00:00:00.000Z");
    expect(applyLegalHold("2026-08-01T00:00:00Z", hold, { field: "answer-events", copyId: "copy-1" })).toMatchObject({
      baseDeadline: "2026-08-01T00:00:00.000Z", holdExpiresAt: "2026-12-28T00:00:00.000Z",
    });
    expect(applyLegalHold("2026-08-01T00:00:00Z", hold, { field: "other", copyId: "copy-1" })).toMatchObject({
      baseDeadline: "2026-08-01T00:00:00.000Z", effectiveDeadline: "2026-08-01T00:00:00.000Z",
    });
    expect(() => createLegalHold({ ...hold, fields: [] })).toThrowError();
    expect(() => createLegalHold({ ...hold, copyIds: [" "] })).toThrowError();
    expect(() => createLegalHold({ ...hold, expiresAt: "2027-01-01T00:00:00Z" })).toThrowError();
    expect(() => createLegalHold({ ...hold, reviewEveryDays: 31 })).toThrowError();
    expect(() => renewLegalHold(hold, {
      qualifiedCounsel: "", writtenEvidenceId: "", renewedAt: "2026-12-01T00:00:00Z", newExpiresAt: "2027-05-01T00:00:00Z",
    })).toThrowError();
    const renewed = renewLegalHold(hold, {
      qualifiedCounsel: "Qualified Counsel", writtenEvidenceId: "written-renewal-1",
      renewedAt: "2026-12-01T00:00:00Z", newExpiresAt: "2027-05-01T00:00:00Z",
    });
    expect(renewed.renewalEvidenceId).toBe("written-renewal-1");
    expect(applyLegalHold("2026-08-01T00:00:00Z", renewed, { field: "answer-events", copyId: "copy-1" }).baseDeadline).toBe("2026-08-01T00:00:00.000Z");
  });

  const shortHold = () => createLegalHold({
    holdId: "hold-2", approver: "Privacy Counsel", purpose: "Dispute", fields: ["events"], copyIds: ["copy-1"],
    startedAt: "2026-07-01T00:00:00Z", reviewEveryDays: 30, expiresAt: "2026-08-01T00:00:00Z",
  });

  it("never lets an applicable legal hold shorten retention", () => {
    const hold = shortHold();
    expect(applyLegalHold("2026-09-01T00:00:00Z", hold, { field: "events", copyId: "copy-1" }).effectiveDeadline).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects a legal hold expiring before its start", () => {
    const hold = shortHold();
    expect(() => createLegalHold({ ...hold, expiresAt: "2026-06-30T00:00:00Z" })).toThrowError("Legal hold expiry must follow its start");
  });

  it("rejects renewal before the legal hold starts", () => {
    const hold = shortHold();
    expect(() => renewLegalHold(hold, { qualifiedCounsel: "Counsel", writtenEvidenceId: "evidence", renewedAt: "2026-06-30T00:00:00Z", newExpiresAt: "2026-12-01T00:00:00Z" })).toThrowError("Renewal cannot precede hold start");
  });

  it("rejects renewed expiry before its renewal instant", () => {
    const hold = shortHold();
    expect(() => renewLegalHold(hold, { qualifiedCounsel: "Counsel", writtenEvidenceId: "evidence", renewedAt: "2026-07-15T00:00:00Z", newExpiresAt: "2026-07-14T00:00:00Z" })).toThrowError("Renewed expiry must follow renewal");
  });

  it("retains qualified counsel, written evidence and exact renewed review", () => {
    const hold = shortHold();
    const renewed = renewLegalHold(hold, { qualifiedCounsel: "Named Qualified Counsel", writtenEvidenceId: "written-2", renewedAt: "2026-07-15T00:00:00Z", newExpiresAt: "2026-12-01T00:00:00Z" });
    expect(renewed).toMatchObject({ qualifiedCounsel: "Named Qualified Counsel", renewalEvidenceId: "written-2", nextReviewAt: "2026-08-14T00:00:00.000Z" });
    expect(applyLegalHold("2026-09-01T00:00:00Z", renewed, { field: "events", copyId: "copy-1" }).baseDeadline).toBe("2026-09-01T00:00:00.000Z");
  });

  it("renews at the current hold expiry but rejects one instant after expiry", () => {
    const hold = shortHold();
    expect(renewLegalHold(hold, {
      qualifiedCounsel: "Counsel", writtenEvidenceId: "at-boundary",
      renewedAt: "2026-08-01T00:00:00.000Z", newExpiresAt: "2026-12-01T00:00:00Z",
    }).renewalEvidenceId).toBe("at-boundary");
    expect(() => renewLegalHold(hold, {
      qualifiedCounsel: "Counsel", writtenEvidenceId: "too-late",
      renewedAt: "2026-08-01T00:00:00.001Z", newExpiresAt: "2026-12-01T00:00:00Z",
    })).toThrowError("Expired legal hold cannot be renewed");
  });

  it.each([
    ["acknowledgement", "ACKNOWLEDGED", "2026-07-03T00:00:00Z", "2026-07-10T00:00:00Z"],
    ["active stores", "ACTIVE_STORES_COMPLETED", "2026-07-03T00:00:00Z", "2026-08-02T00:00:00Z"],
    ["backups", "BACKUPS_AGED_OUT", "2026-07-03T00:00:00Z", "2026-08-07T00:00:00Z"],
  ] as const)("rejects a duplicate terminal %s without changing history", (_label, stepType, firstAt, duplicateAt) => {
    const completed = DeletionCase.open({ caseId: `duplicate-${stepType}`, participantLineageId: "lineage-1", openedAt: "2026-07-02T00:00:00Z" })
      .record({ stepType, occurredAt: firstAt });
    const history = completed.history();
    expect(() => completed.record({ stepType, occurredAt: duplicateAt })).toThrowError("Deletion terminal step already recorded");
    expect(completed.history()).toEqual(history);
    expect(completed.history().some((step) => step.stepType === "DEADLINE_MISSED")).toBe(false);
  });

  it("keeps safe state, telemetry and audits free of forbidden identity and content fields", () => {
    const subject = harness();
    subject.coordinator.withdraw(withdrawalInput);
    const output = JSON.stringify({
      state: subject.coordinator.safeState("lineage-1"),
      telemetry: subject.coordinator.safeTelemetry("lineage-1"),
      audits: subject.coordinator.auditRecords(),
    });
    for (const forbidden of [
      "secret-auth-proof", "rawCode", "prompt", "freeText", "ipFingerprint", "fullUserAgent",
      "secret", "authenticationProof", "recruitmentIdentity",
    ]) expect(output).not.toContain(forbidden);
  });
});
