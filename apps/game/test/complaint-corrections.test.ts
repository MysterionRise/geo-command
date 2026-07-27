import { describe, expect, it } from "vitest";

import {
  COMPLAINT_RUBRIC,
  ComplaintCase,
  ComplaintRuleError,
} from "../src/server/content/corrections/corrections.js";

const openCase = (severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") =>
  ComplaintCase.open({
    caseId: `case-${severity.toLowerCase()}`,
    contentId: "content-1",
    roundId: "round-1",
    manifestVersionId: "manifest-v1",
    severity,
    credible: true,
    receivedAt: "2026-07-01T10:00:00.000Z",
    evidenceRefs: ["evidence-ref-1"],
    originalContentEditorId: "editor-1",
    originalRightsSafetyReviewerId: "rights-reviewer-1",
  });

describe("complaints and corrections", () => {
  it("uses a frozen four-level rubric with elapsed-hour and calendar-day deadlines", () => {
    expect(Object.isFrozen(COMPLAINT_RUBRIC)).toBe(true);
    expect(COMPLAINT_RUBRIC).toMatchObject({
      CRITICAL: {
        definition: "Credible ongoing unlawful, secret, personal-data, or imminent harm exposure.",
        examples: ["exposed credential", "personal data disclosure"],
        acknowledgementHours: 48,
        quarantineHours: 4,
        decisionDays: 7,
      },
      HIGH: {
        definition: "Credible material rights, provenance, privacy, or safety harm without critical immediacy.",
        examples: ["material license dispute", "material provenance error"],
        acknowledgementHours: 48,
        quarantineHours: 24,
        decisionDays: 7,
      },
      MEDIUM: {
        definition: "Credible bounded issue with limited impact and no urgent exposure.",
        examples: ["incomplete attribution detail", "non-urgent ambiguity"],
        acknowledgementHours: 48,
        quarantineHours: null,
        decisionDays: 14,
      },
      LOW: {
        definition: "Minor correction or clarification without material harm.",
        examples: ["typographical correction", "clarification request"],
        acknowledgementHours: 48,
        quarantineHours: null,
        decisionDays: 14,
      },
    });
    expect(Object.isFrozen(COMPLAINT_RUBRIC.CRITICAL)).toBe(true);
  });

  it("requires a rationale whenever acknowledgement or quarantine misses its due time", () => {
    expect(() =>
      openCase("CRITICAL").acknowledge({
        acknowledgedAt: "2026-07-03T10:00:00.001Z",
      }),
    ).toThrowError(new ComplaintRuleError("Missed acknowledgement requires a rationale"));

    const acknowledged = openCase("HIGH").acknowledge({
      acknowledgedAt: "2026-07-03T10:00:00.001Z",
      missedDeadlineRationale: "monitoring outage documented",
    });
    expect(() =>
      acknowledged.quarantine({
        quarantinedAt: "2026-07-02T10:00:00.001Z",
        correctionStatus: "VOID",
        alreadyDisplayed: false,
      }),
    ).toThrowError(new ComplaintRuleError("Missed quarantine requires a rationale"));
  });

  it("creates a five-minute emergency containment plan without implicitly revoking credentials", () => {
    const quarantined = openCase("CRITICAL").quarantine({
      quarantinedAt: "2026-07-01T13:00:00.000Z",
      correctionStatus: "CONTENT_WITHDRAWN",
      alreadyDisplayed: true,
    });

    expect(quarantined.snapshot().quarantine).toEqual({
      quarantinedAt: "2026-07-01T13:00:00.000Z",
      contentAccess: "DENIED",
      revealAccess: "DENIED",
      manifestNewIssuance: "INELIGIBLE",
      existingSessionCredentialScope: ["CORRECTION_NOTICE", "UNAFFECTED_TRANSITIONS"],
      credentialRevocation: "UNCHANGED",
      pendingDecisionAvailability: "UNAVAILABLE",
      correctionStatus: "CONTENT_WITHDRAWN",
      notice: "Content was withdrawn.",
      cachePurgeDueAt: "2026-07-01T13:05:00.000Z",
      alreadyDisplayedContent: "NOT_RECALLABLE",
    });
    expect(Object.isFrozen(quarantined.snapshot())).toBe(true);
    expect(Object.isFrozen(quarantined.history())).toBe(true);
  });

  it("keeps explicit credential revocation separate and enforces independent decision review", () => {
    const quarantined = openCase("HIGH").quarantine({
      quarantinedAt: "2026-07-02T09:00:00.000Z",
      correctionStatus: "VOID",
      alreadyDisplayed: false,
    });
    expect(() =>
      quarantined.decide({
        decidedAt: "2026-07-05T10:00:00.000Z",
        reviewerId: "editor-1",
        outcome: "UPHOLD_VOID",
        escalation: "none",
        deletion: "not required",
        completedAt: "2026-07-05T11:00:00.000Z",
      }),
    ).toThrowError(
      new ComplaintRuleError("Decision reviewer must be independent of original reviewers"),
    );
    expect(() =>
      quarantined.decide({
        decidedAt: "2026-07-05T10:00:00.000Z",
        reviewerId: "rights-reviewer-1",
        outcome: "UPHOLD_VOID",
        escalation: "none",
        deletion: "not required",
        completedAt: "2026-07-05T11:00:00.000Z",
      }),
    ).toThrowError(
      new ComplaintRuleError("Decision reviewer must be independent of original reviewers"),
    );
    expect(quarantined.snapshot().quarantine).toMatchObject({
      correctionStatus: "VOID",
      notice: "Round voided.",
      pendingDecisionAvailability: "UNAVAILABLE",
    });

    const revoked = quarantined.explicitlyRevokeCredential({
      credentialId: "session-credential-1",
      revokedAt: "2026-07-02T09:05:00.000Z",
      reason: "credential independently compromised",
    });
    expect(revoked.snapshot().credentialRevocations).toEqual([
      {
        credentialId: "session-credential-1",
        revokedAt: "2026-07-02T09:05:00.000Z",
        reason: "credential independently compromised",
      },
    ]);
  });

  it("rejects a decision before the complaint is acknowledged", () => {
    expect(() =>
      openCase("MEDIUM").decide({
        decidedAt: "2026-07-02T10:00:00.000Z",
        reviewerId: "independent-reviewer",
        outcome: "CLOSE_NO_ACTION",
        escalation: "none",
        deletion: "not required",
        completedAt: "2026-07-02T11:00:00.000Z",
      }),
    ).toThrowError(
      new ComplaintRuleError("Complaint must be acknowledged before decision"),
    );
  });

  it("rejects a credible critical or high decision before provisional quarantine", () => {
    const acknowledged = openCase("CRITICAL").acknowledge({
      acknowledgedAt: "2026-07-01T11:00:00.000Z",
    });

    expect(() =>
      acknowledged.decide({
        decidedAt: "2026-07-02T10:00:00.000Z",
        reviewerId: "independent-reviewer",
        outcome: "UPHOLD_VOID",
        escalation: "none",
        deletion: "not required",
        completedAt: "2026-07-02T11:00:00.000Z",
      }),
    ).toThrowError(
      new ComplaintRuleError(
        "Credible critical/high complaint must be quarantined before decision",
      ),
    );
  });

  it("records complete decision history and requires rationale after the severity deadline", () => {
    const medium = openCase("MEDIUM").acknowledge({
      acknowledgedAt: "2026-07-01T11:00:00.000Z",
    });
    expect(() =>
      medium.decide({
        decidedAt: "2026-07-15T10:00:00.001Z",
        reviewerId: "independent-reviewer",
        outcome: "CLOSE_NO_ACTION",
        escalation: "rights lead consulted",
        deletion: "not required",
        completedAt: "2026-07-15T11:00:00.000Z",
      }),
    ).toThrowError(new ComplaintRuleError("Missed decision requires a rationale"));

    const completed = medium.decide({
      decidedAt: "2026-07-15T10:00:00.001Z",
      reviewerId: "independent-reviewer",
      outcome: "CLOSE_NO_ACTION",
      escalation: "rights lead consulted",
      deletion: "not required",
      completedAt: "2026-07-15T11:00:00.000Z",
      missedDeadlineRationale: "counsel response arrived late",
    });
    expect(completed.snapshot()).toMatchObject({
      severity: "MEDIUM",
      evidenceRefs: ["evidence-ref-1"],
      acknowledgement: { acknowledgedAt: "2026-07-01T11:00:00.000Z" },
      decision: {
        reviewerId: "independent-reviewer",
        correction: "CLOSE_NO_ACTION",
        deletion: "not required",
        escalation: "rights lead consulted",
        completedAt: "2026-07-15T11:00:00.000Z",
        missedDeadlineRationale: "counsel response arrived late",
      },
    });
    expect(completed.history().map(({ event }) => event)).toEqual([
      "RECEIVED",
      "ACKNOWLEDGED",
      "DECIDED",
      "COMPLETED",
    ]);
  });
});
