import { describe, expect, it } from "vitest";

import {
  ConsentPolicyRegistry,
  ConsentRuleError,
  ParticipantStateLedger,
  createAdultEligibilityPolicy,
  type ExclusionReason,
} from "../src/server/identity/consent/consent.js";

const policyInput = {
  versionId: "adult-policy-v1",
  approvedBy: "Don",
  signatureId: "policy-signature-1",
  signedAt: "2026-07-01T09:00:00.000Z",
  effectiveFrom: "2026-07-02T00:00:00.000Z",
  adultOnly: true as const,
  permittedJurisdictions: ["GB", "IE"],
  externalDeveloperCriteria: "Currently works professionally with software",
  requiresExternalDeveloper: true,
  permittedProjectRelationships: ["NONE", "FORMER_CONTRACTOR"],
  disqualifyingConflicts: ["CURRENT_EMPLOYEE", "ROUND_AUTHOR"],
  consentTerms: "Voluntary beta participation and measurement consent",
  withdrawalTerms: "Authenticated accountless withdrawal is available",
  operationalTesterTreatment: "Operational testers are excluded from analysis",
};

const eligibleLedger = () =>
  ParticipantStateLedger.create("lineage-1")
    .record({ recordType: "INVITATION_RECORDED", occurredAt: "2026-07-02T09:00:00Z" })
    .record({
      recordType: "CONSENT_RECORDED",
      occurredAt: "2026-07-02T09:01:00Z",
      policyVersionId: "adult-policy-v1",
      valid: true,
    })
    .record({
      recordType: "ELIGIBILITY_RECORDED",
      occurredAt: "2026-07-02T09:02:00Z",
      policyVersionId: "adult-policy-v1",
      valid: true,
    })
    .record({
      recordType: "TESTER_CLASSIFIED",
      occurredAt: "2026-07-02T09:03:00Z",
      operationalTester: false,
    })
    .record({ recordType: "ENROLLMENT_RECORDED", occurredAt: "2026-07-02T09:04:00Z" })
    .record({ recordType: "SESSION_STARTED", occurredAt: "2026-07-02T09:05:00Z" });

describe("consent and participant state", () => {
  it("creates only complete versioned adult policies approved by the Don", () => {
    const policy = createAdultEligibilityPolicy(policyInput);

    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.permittedJurisdictions)).toBe(true);
    expect(policy).toMatchObject({
      versionId: "adult-policy-v1",
      approvedBy: "Don",
      adultOnly: true,
      consentTerms: policyInput.consentTerms,
      withdrawalTerms: policyInput.withdrawalTerms,
      operationalTesterTreatment: policyInput.operationalTesterTreatment,
    });
    expect(() =>
      createAdultEligibilityPolicy({ ...policyInput, approvedBy: "Product Owner" }),
    ).toThrowError(new ConsentRuleError("Policy requires Don approval"));
    expect(() =>
      createAdultEligibilityPolicy({ ...policyInput, adultOnly: false as true }),
    ).toThrowError(new ConsentRuleError("Policy must be adult-only"));
    expect(() =>
      createAdultEligibilityPolicy({ ...policyInput, withdrawalTerms: " " }),
    ).toThrowError(new ConsentRuleError("Withdrawal terms are required"));
  });

  it("fails invitation policy decisions closed for absent, unknown, early or inapplicable policy", () => {
    const registry = new ConsentPolicyRegistry();
    expect(registry.invitationDecision({ policyVersionId: undefined })).toEqual({
      allowed: false,
      reason: "POLICY_ABSENT",
    });
    expect(registry.invitationDecision({ policyVersionId: "unknown" })).toEqual({
      allowed: false,
      reason: "POLICY_UNKNOWN",
    });
    registry.register(createAdultEligibilityPolicy(policyInput));
    expect(
      registry.invitationDecision({
        policyVersionId: "adult-policy-v1",
        evaluatedAt: "2026-07-01T23:59:59.999Z",
        jurisdiction: "GB",
        externalDeveloper: true,
        projectRelationship: "NONE",
        conflicts: [],
        operationalTester: false,
      }),
    ).toEqual({ allowed: false, reason: "POLICY_NOT_EFFECTIVE" });
    expect(
      registry.invitationDecision({
        policyVersionId: "adult-policy-v1",
        evaluatedAt: "2026-07-02T00:00:00.000Z",
        jurisdiction: "US",
        externalDeveloper: true,
        projectRelationship: "NONE",
        conflicts: [],
        operationalTester: false,
      }),
    ).toEqual({ allowed: false, reason: "POLICY_INAPPLICABLE" });
    expect(
      registry.invitationDecision({
        policyVersionId: "adult-policy-v1",
        evaluatedAt: "2026-07-02T00:00:00.000Z",
        jurisdiction: "GB",
        externalDeveloper: true,
        projectRelationship: "NONE",
        conflicts: [],
        operationalTester: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies invitations before the policy signature even when its effective time is earlier", () => {
    const registry = new ConsentPolicyRegistry();
    registry.register(
      createAdultEligibilityPolicy({
        ...policyInput,
        versionId: "adult-policy-signed-later",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        signedAt: "2026-07-02T00:00:00.000Z",
      }),
    );

    expect(
      registry.invitationDecision({
        policyVersionId: "adult-policy-signed-later",
        evaluatedAt: "2026-07-01T12:00:00.000Z",
        jurisdiction: "GB",
        externalDeveloper: true,
        projectRelationship: "NONE",
        conflicts: [],
        operationalTester: false,
      }),
    ).toEqual({ allowed: false, reason: "POLICY_NOT_EFFECTIVE" });
  });

  it("rejects a second registration for an immutable policy version", () => {
    const registry = new ConsentPolicyRegistry();
    const policy = createAdultEligibilityPolicy(policyInput);
    registry.register(policy);

    expect(() => registry.register(policy)).toThrowError(
      new ConsentRuleError("Policy version adult-policy-v1 is already registered"),
    );
  });

  it("keeps every participant fact distinct and does not collapse consent into activation", () => {
    let ledger = eligibleLedger();
    ledger = ledger
      .record({ recordType: "ACTIVATED", occurredAt: "2026-07-02T09:06:00Z" })
      .record({ recordType: "ROUND_COMPLETED", occurredAt: "2026-07-02T09:07:00Z" })
      .record({ recordType: "SESSION_COMPLETED", occurredAt: "2026-07-02T09:08:00Z" })
      .record({ recordType: "DISTINCT_DAY_RETURNED", occurredAt: "2026-07-03T09:00:00Z" })
      .record({ recordType: "SURVEY_RESPONDED", occurredAt: "2026-07-03T09:05:00Z" })
      .record({
        recordType: "CREDENTIAL_STATUS_RECORDED",
        occurredAt: "2026-07-03T09:06:00Z",
        status: "ACTIVE",
      });

    expect(ledger.facts().map(({ recordType }) => recordType)).toEqual([
      "ANALYSIS_STATE_RECORDED",
      "INVITATION_RECORDED",
      "CONSENT_RECORDED",
      "ELIGIBILITY_RECORDED",
      "TESTER_CLASSIFIED",
      "ENROLLMENT_RECORDED",
      "SESSION_STARTED",
      "ANALYSIS_STATE_RECORDED",
      "ACTIVATED",
      "ROUND_COMPLETED",
      "SESSION_COMPLETED",
      "DISTINCT_DAY_RETURNED",
      "SURVEY_RESPONDED",
      "CREDENTIAL_STATUS_RECORDED",
    ]);
    expect(ledger.facts().find(({ recordType }) => recordType === "CONSENT_RECORDED")).toMatchObject({
      policyVersionId: "adult-policy-v1",
      valid: true,
    });
    expect(Object.isFrozen(ledger.facts())).toBe(true);
  });

  it("includes analysis only after consent, eligibility, non-tester classification and session start", () => {
    let ledger = ParticipantStateLedger.create("lineage-1");
    ledger = ledger.record({
      recordType: "CONSENT_RECORDED",
      occurredAt: "2026-07-02T09:01:00Z",
      policyVersionId: "adult-policy-v1",
      valid: true,
    });
    expect(ledger.analysisState()).toBe("PENDING");
    ledger = ledger.record({
      recordType: "ELIGIBILITY_RECORDED",
      occurredAt: "2026-07-02T09:02:00Z",
      policyVersionId: "adult-policy-v1",
      valid: true,
    });
    ledger = ledger.record({
      recordType: "TESTER_CLASSIFIED",
      occurredAt: "2026-07-02T09:03:00Z",
      operationalTester: false,
    });
    expect(ledger.analysisState()).toBe("PENDING");
    ledger = ledger.record({ recordType: "SESSION_STARTED", occurredAt: "2026-07-02T09:05:00Z" });
    expect(ledger.analysisState()).toBe("INCLUDED");
  });

  it("does not activate a participant without a recorded invitation", () => {
    const ledger = ParticipantStateLedger.create("lineage-1")
      .record({
        recordType: "CONSENT_RECORDED",
        occurredAt: "2026-07-02T09:01:00Z",
        policyVersionId: "adult-policy-v1",
        valid: true,
      })
      .record({
        recordType: "ELIGIBILITY_RECORDED",
        occurredAt: "2026-07-02T09:02:00Z",
        policyVersionId: "adult-policy-v1",
        valid: true,
      })
      .record({ recordType: "ENROLLMENT_RECORDED", occurredAt: "2026-07-02T09:04:00Z" });

    expect(() =>
      ledger.record({ recordType: "ACTIVATED", occurredAt: "2026-07-02T09:06:00Z" }),
    ).toThrowError(
      new ConsentRuleError(
        "Activation requires invitation, enrollment, and matching policy-bound consent and eligibility",
      ),
    );
  });

  it("does not activate when the latest valid consent and eligibility use different policies", () => {
    const ledger = ParticipantStateLedger.create("lineage-1")
      .record({ recordType: "INVITATION_RECORDED", occurredAt: "2026-07-02T09:00:00Z" })
      .record({
        recordType: "CONSENT_RECORDED",
        occurredAt: "2026-07-02T09:01:00Z",
        policyVersionId: "adult-policy-v1",
        valid: true,
      })
      .record({
        recordType: "ELIGIBILITY_RECORDED",
        occurredAt: "2026-07-02T09:02:00Z",
        policyVersionId: "adult-policy-v1",
        valid: true,
      })
      .record({
        recordType: "CONSENT_RECORDED",
        occurredAt: "2026-07-02T09:03:00Z",
        policyVersionId: "adult-policy-v2",
        valid: true,
      })
      .record({ recordType: "ENROLLMENT_RECORDED", occurredAt: "2026-07-02T09:04:00Z" });

    expect(() =>
      ledger.record({ recordType: "ACTIVATED", occurredAt: "2026-07-02T09:06:00Z" }),
    ).toThrowError(
      new ConsentRuleError(
        "Activation requires invitation, enrollment, and matching policy-bound consent and eligibility",
      ),
    );
  });

  it("makes every integrity exclusion terminal without rewriting operational facts", () => {
    const exclusions = [
      {
        reason: "AUTHENTICATED_WITHDRAWAL",
        event: {
          recordType: "WITHDRAWAL_RECORDED",
          occurredAt: "2026-07-02T10:00:00Z",
          authenticationReference: "withdrawal-auth-1",
          approver: "Data Steward",
          formulaTreatment: "exclude prospectively and from frozen analysis",
        },
      },
      {
        reason: "INVALID_ELIGIBILITY",
        event: {
          recordType: "ELIGIBILITY_RECORDED",
          occurredAt: "2026-07-02T10:00:00Z",
          policyVersionId: "adult-policy-v1",
          valid: false,
          approver: "Data Steward",
          formulaTreatment: "exclude prospectively and from frozen analysis",
        },
      },
      {
        reason: "OPERATIONAL_TESTER",
        event: {
          recordType: "TESTER_CLASSIFIED",
          occurredAt: "2026-07-02T10:00:00Z",
          operationalTester: true,
          approver: "Data Steward",
          formulaTreatment: "exclude prospectively and from frozen analysis",
        },
      },
      {
        reason: "DUPLICATE_LINEAGE",
        event: {
          recordType: "DUPLICATE_LINEAGE_RECORDED",
          occurredAt: "2026-07-02T10:00:00Z",
          duplicateOfLineageId: "lineage-original",
          evidenceReference: "duplicate-evidence-1",
          approver: "Data Steward",
          formulaTreatment: "exclude prospectively and from frozen analysis",
        },
      },
      {
        reason: "SIGNED_INTEGRITY_EXCLUSION",
        event: {
          recordType: "SIGNED_INTEGRITY_EXCLUSION",
          occurredAt: "2026-07-02T10:00:00Z",
          signer: "Data Steward",
          signatureId: "integrity-signature-1",
          approver: "Data Steward",
          formulaTreatment: "exclude prospectively and from frozen analysis",
        },
      },
    ] as const;
    for (const { reason, event } of exclusions) {
      const before = eligibleLedger().record({
        recordType: "ROUND_CORRECTION_RECORDED",
        occurredAt: "2026-07-02T09:06:00Z",
        status: "CONTENT_WITHDRAWN",
      });
      expect(before.analysisState()).toBe("INCLUDED");
      const priorFacts = before.facts();
      const excluded = before.record(event);
      expect(excluded.analysisState()).toBe("EXCLUDED");
      expect(excluded.facts().slice(0, priorFacts.length)).toEqual(priorFacts);
      expect(excluded.facts()[priorFacts.length]).toMatchObject({
        recordType: event.recordType,
      });
      expect(excluded.analysisRecord()).toMatchObject({
        state: "EXCLUDED",
        reason,
        effectiveAt: "2026-07-02T10:00:00Z",
        approver: "Data Steward",
        formulaTreatment: "exclude prospectively and from frozen analysis",
      });
      expect(
        excluded.record({ recordType: "SESSION_COMPLETED", occurredAt: "2026-07-02T10:05:00Z" }).analysisState(),
      ).toBe("EXCLUDED");
    }
  });
});
