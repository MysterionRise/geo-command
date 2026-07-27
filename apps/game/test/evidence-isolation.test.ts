import { describe, expect, it } from "vitest";

import {
  EvidenceVault,
  VaultRuleError,
  createLegalHold,
  retentionDeadlineForRestrictedEvidence,
  type EncryptedEnvelope,
  type ProjectEncryption,
} from "../src/server/content/vault/vault.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class TestProjectEncryption implements ProjectEncryption {
  public lastEnvelope: EncryptedEnvelope | undefined;

  public seal(plaintext: Uint8Array): EncryptedEnvelope {
    const ciphertext = [...plaintext]
      .map((value) => (value ^ 0xa5).toString(16).padStart(2, "0"))
      .join("");
    this.lastEnvelope = Object.freeze({
      algorithm: "test-project-cipher",
      keyId: "project-key-1",
      nonce: "nonce-1",
      ciphertext,
    });
    return this.lastEnvelope;
  }

  public withUnsealed(
    envelope: EncryptedEnvelope,
    consume: (plaintext: Uint8Array) => void,
  ): void {
    const bytes = Uint8Array.from(
      envelope.ciphertext.match(/.{2}/gu)?.map((pair) => Number.parseInt(pair, 16) ^ 0xa5) ?? [],
    );
    try {
      consume(bytes);
    } finally {
      bytes.fill(0);
    }
  }
}

const custodian = {
  operatorId: "operator-custodian",
  operatorName: "Casey Custodian",
  roles: ["EVIDENCE_CUSTODIAN"] as const,
};

const reviewer = {
  operatorId: "operator-reviewer",
  operatorName: "Riley Reviewer",
  roles: ["RIGHTS_REVIEWER"] as const,
};

const securityReviewer = {
  operatorId: "operator-security",
  operatorName: "Sam Security",
  roles: ["SECURITY_REVIEWER"] as const,
};

const securityVerifier = {
  operatorId: "operator-security-verifier",
  operatorName: "Vera Verifier",
  roles: ["SECURITY_REVIEWER"] as const,
};

const minimization = {
  retainedFields: ["provider", "model", "generation-date"],
  removedFields: ["account-email", "unrelated-prompt-history"],
  redactionsApplied: ["credential-token", "personal-name"],
  reviewedBy: "reviewer-minimization",
  reviewedAt: "2026-07-01T12:00:00.000Z",
};

const storeEvidence = (
  vault: EvidenceVault,
  plaintext = "restricted raw evidence",
) =>
  vault.store({
    operator: custodian,
    evidenceId: "evidence-1",
    versionId: "evidence-1-v1",
    plaintext: encoder.encode(plaintext),
    allowedRoles: ["RIGHTS_REVIEWER"],
    minimization,
    retentionEvents: {
      betaClosedAt: "2026-07-10T00:00:00.000Z",
      itemWithdrawnAt: "2026-07-05T00:00:00.000Z",
      authenticatedRequestAt: "2026-07-03T00:00:00.000Z",
    },
    storedAt: "2026-07-01T12:30:00.000Z",
  });

describe("restricted evidence isolation", () => {
  it("stores only a project-encrypted envelope and cannot create a public projection", () => {
    const encryption = new TestProjectEncryption();
    const vault = new EvidenceVault(encryption);
    const receipt = storeEvidence(vault);

    expect(receipt).toMatchObject({
      evidenceId: "evidence-1",
      versionId: "evidence-1-v1",
      minimization: {
        removedFields: ["account-email", "unrelated-prompt-history"],
        redactionsApplied: ["credential-token", "personal-name"],
      },
    });
    expect(receipt).not.toHaveProperty("plaintext");
    expect(receipt).not.toHaveProperty("ciphertext");
    expect(encryption.lastEnvelope?.ciphertext).not.toContain("restricted raw evidence");
    expect(JSON.stringify(vault)).not.toContain("restricted raw evidence");

    for (const channel of [
      "PUBLIC_BUNDLE",
      "SOURCE_MAP",
      "PREFETCH",
      "ANALYTICS",
      "LOG",
    ] as const) {
      expect(() => vault.projectForPublicChannel("evidence-1", channel)).toThrowError(
        new VaultRuleError(`Restricted evidence cannot enter ${channel}`),
      );
    }
  });

  it("allows a named authorized operator to consume plaintext without returning it", () => {
    const vault = new EvidenceVault(new TestProjectEncryption());
    storeEvidence(vault, "rights review material");
    let consumed = "";

    const receipt = vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "evidence-1",
        accessedAt: "2026-07-02T10:00:00.000Z",
        purpose: "RIGHTS_REVIEW",
      },
      (plaintext) => {
        consumed = decoder.decode(plaintext);
      },
    );

    expect(consumed).toBe("rights review material");
    expect(receipt).toMatchObject({ outcome: "GRANTED", evidenceId: "evidence-1" });
    expect(receipt).not.toHaveProperty("plaintext");
    expect(receipt).not.toHaveProperty("ciphertext");
  });

  it("audits denied access without invoking the consumer or exposing payload", () => {
    const vault = new EvidenceVault(new TestProjectEncryption());
    storeEvidence(vault);
    let consumed = false;

    const receipt = vault.withEvidenceAccess(
      {
        operator: securityReviewer,
        evidenceId: "evidence-1",
        accessedAt: "2026-07-02T10:00:00.000Z",
        purpose: "SECURITY_REVIEW",
      },
      () => {
        consumed = true;
      },
    );

    expect(consumed).toBe(false);
    expect(receipt).toEqual({
      auditId: "audit-2",
      evidenceId: "evidence-1",
      outcome: "DENIED",
      reason: "ROLE_NOT_ALLOWED",
    });
    expect(receipt).not.toHaveProperty("payload");
    const audit = vault.auditTrail();
    expect(audit.at(-1)).toMatchObject({
      action: "ACCESS",
      outcome: "DENIED",
      operatorId: "operator-security",
      reason: "ROLE_NOT_ALLOWED",
    });
    expect(JSON.stringify(audit)).not.toContain("restricted raw evidence");
    expect(Object.isFrozen(audit)).toBe(true);
    expect(Object.isFrozen(audit.at(-1))).toBe(true);
  });

  it("rejects arbitrary access purpose text without copying it into the audit", () => {
    const vault = new EvidenceVault(new TestProjectEncryption());
    storeEvidence(vault);
    let consumed = false;

    const receipt = vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "evidence-1",
        accessedAt: "2026-07-02T10:00:00.000Z",
        purpose: "restricted raw evidence" as never,
      },
      () => {
        consumed = true;
      },
    );

    expect(consumed).toBe(false);
    expect(receipt).toMatchObject({
      outcome: "DENIED",
      reason: "PURPOSE_NOT_ALLOWED",
    });
    const serializedAudit = JSON.stringify(vault.auditTrail());
    expect(serializedAudit).not.toContain("restricted raw evidence");
    expect(vault.auditTrail().at(-1)).toMatchObject({
      purpose: "UNSPECIFIED",
      reason: "PURPOSE_NOT_ALLOWED",
    });
  });

  it("audits granted plaintext access before invoking a consumer that throws", () => {
    const vault = new EvidenceVault(new TestProjectEncryption());
    storeEvidence(vault, "throw-path material");

    expect(() =>
      vault.withEvidenceAccess(
        {
          operator: reviewer,
          evidenceId: "evidence-1",
          accessedAt: "2026-07-02T11:00:00.000Z",
          purpose: "RIGHTS_REVIEW",
        },
        () => {
          throw new Error("consumer failed");
        },
      ),
    ).toThrowError("consumer failed");

    expect(vault.auditTrail().at(-1)).toEqual({
      auditId: "audit-2",
      evidenceId: "evidence-1",
      operatorId: "operator-reviewer",
      operatorName: "Riley Reviewer",
      action: "ACCESS",
      outcome: "GRANTED",
      occurredAt: "2026-07-02T11:00:00.000Z",
      purpose: "RIGHTS_REVIEW",
    });
    expect(vault.auditTrail().at(-1)).not.toHaveProperty("payload");
    expect(vault.auditTrail().at(-1)).not.toHaveProperty("ciphertext");
  });

  it("uses ninety days after the earliest restricted-evidence retention event", () => {
    expect(
      retentionDeadlineForRestrictedEvidence({
        betaClosedAt: "2026-04-10T00:00:00.000Z",
        itemWithdrawnAt: "2026-04-05T00:00:00.000Z",
        authenticatedRequestAt: "2026-04-01T00:00:00.000Z",
      }),
    ).toBe("2026-06-30T00:00:00.000Z");
  });

  it("denies and audits access at the retention deadline without unsealing", () => {
    const vault = new EvidenceVault(new TestProjectEncryption());
    storeEvidence(vault, "expired material");
    let consumed = false;

    const receipt = vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "evidence-1",
        accessedAt: "2026-10-01T00:00:00.000Z",
        purpose: "RIGHTS_REVIEW",
      },
      () => {
        consumed = true;
      },
    );

    expect(consumed).toBe(false);
    expect(receipt).toMatchObject({ outcome: "DENIED", reason: "RETENTION_EXPIRED" });
    expect(vault.auditTrail().at(-1)).toMatchObject({
      action: "ACCESS",
      outcome: "DENIED",
      reason: "RETENTION_EXPIRED",
      purpose: "RIGHTS_REVIEW",
    });
  });

  it("rejects incomplete or overlong legal holds without written counsel renewal", () => {
    expect(() =>
      createLegalHold({
        holdId: "hold-1",
        approver: "",
        purpose: "rights dispute",
        fields: ["source-contract"],
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
      }),
    ).toThrowError(new VaultRuleError("Legal hold approver must be named"));

    expect(() =>
      createLegalHold({
        holdId: "hold-2",
        approver: "Qualified Approver",
        purpose: "rights dispute",
        fields: ["source-contract"],
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
      }),
    ).toThrowError(
      new VaultRuleError(
        "A legal hold beyond 180 days requires a written qualified-counsel renewal",
      ),
    );

    expect(
      createLegalHold({
        holdId: "hold-3",
        approver: "Qualified Approver",
        purpose: "rights dispute",
        fields: ["source-contract"],
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
        counselRenewal: {
          counselName: "Counsel Name",
          writtenRecordId: "written-renewal-1",
          qualifiedCounsel: true,
        },
      }),
    ).toMatchObject({
      reviewEveryDays: 30,
      nextReviewAt: "2026-01-31T00:00:00.000Z",
    });
  });

  it("deletes the local copy, propagates deletion and keeps restored data quarantined", () => {
    const encryption = new TestProjectEncryption();
    const vault = new EvidenceVault(encryption);
    storeEvidence(vault, "deleted material");
    const deletion = vault.deleteEvidence({
      operator: custodian,
      evidenceId: "evidence-1",
      requestedAt: "2026-07-03T00:00:00.000Z",
      destinations: ["project-backup", "restricted-export"],
    });

    expect(deletion).toMatchObject({
      outcome: "DELETED",
      propagation: [
        { destination: "project-backup", status: "PENDING" },
        { destination: "restricted-export", status: "PENDING" },
      ],
    });
    let reached = false;
    const denied = vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "evidence-1",
        accessedAt: "2026-07-03T00:05:00.000Z",
        purpose: "RIGHTS_REVIEW",
      },
      () => {
        reached = true;
      },
    );
    expect(reached).toBe(false);
    expect(denied).toMatchObject({ outcome: "DENIED", reason: "NOT_FOUND" });

    const restoredEnvelope = encryption.seal(encoder.encode("restored material"));
    vault.beginRestore({
      operator: securityReviewer,
      restoreId: "restore-1",
      startedAt: "2026-07-04T00:00:00.000Z",
      entries: [
        {
          evidenceId: "restored-evidence",
          versionId: "restored-v1",
          envelope: restoredEnvelope,
          allowedRoles: ["RIGHTS_REVIEWER"],
          minimization,
          retentionDeadline: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    let quarantinedReached = false;
    const quarantinedAccess = vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "restored-evidence",
        accessedAt: "2026-07-04T00:30:00.000Z",
        purpose: "RIGHTS_REVIEW",
      },
      () => {
        quarantinedReached = true;
      },
    );
    expect(quarantinedReached).toBe(false);
    expect(quarantinedAccess).toMatchObject({ outcome: "DENIED", reason: "NOT_FOUND" });

    expect(() =>
      vault.completeRestore({
        operator: securityReviewer,
        restoreId: "restore-1",
        reconciledAt: "2026-07-04T01:00:00.000Z",
        passed: true,
      }),
    ).toThrowError(
      new VaultRuleError(
        "Restore requires withdrawal, consent, deletion and revocation ledger replay",
      ),
    );

    for (const ledger of ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"] as const) {
      vault.recordLedgerReplay({
        operator: securityReviewer,
        restoreId: "restore-1",
        ledger,
        replayedAt: "2026-07-04T01:00:00.000Z",
      });
    }
    expect(() =>
      vault.completeRestore({
        operator: securityReviewer,
        restoreId: "restore-1",
        reconciledAt: "2026-07-04T01:30:00.000Z",
        passed: true,
      }),
    ).toThrowError(
      new VaultRuleError("Restore reconciliation requires an independent verifier"),
    );
    vault.completeRestore({
      operator: securityVerifier,
      restoreId: "restore-1",
      reconciledAt: "2026-07-04T01:31:00.000Z",
      passed: true,
    });

    let restored = "";
    vault.withEvidenceAccess(
      {
        operator: reviewer,
        evidenceId: "restored-evidence",
        accessedAt: "2026-07-04T02:00:00.000Z",
        purpose: "RIGHTS_REVIEW",
      },
      (plaintext) => {
        restored = decoder.decode(plaintext);
      },
    );
    expect(restored).toBe("restored material");
  });
});
