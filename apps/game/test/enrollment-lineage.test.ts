import { describe, expect, it } from "vitest";

import {
  EnrollmentRegistry,
  EnrollmentRuleError,
  type CascadeRevocationPlan,
  type CascadeRevocationPort,
  type LineageIdGenerator,
  type RecruiterVerificationPort,
  type RecruiterVerificationRequest,
  type TokenDigester,
  type TokenGenerator,
} from "../src/server/identity/enrollment/enrollment.js";

class TokenSequence implements TokenGenerator {
  readonly #tokens: string[];

  public constructor(...tokens: string[]) {
    this.#tokens = [...tokens];
  }

  public generate(): string {
    const token = this.#tokens.shift();
    if (token === undefined) throw new Error("test token sequence exhausted");
    return token;
  }
}

class TestDigester implements TokenDigester {
  public digest(rawToken: string): string {
    return `digest:${[...rawToken].reverse().join("")}`;
  }
}

class LineageSequence implements LineageIdGenerator {
  readonly #lineageIds: string[];
  public readonly argumentCounts: number[] = [];

  public constructor(...lineageIds: string[]) {
    this.#lineageIds = [...lineageIds];
  }

  public generate(...args: never[]): string {
    this.argumentCounts.push(args.length);
    const lineageId = this.#lineageIds.shift();
    if (lineageId === undefined) throw new Error("test lineage sequence exhausted");
    return lineageId;
  }
}

class CascadeRecorder implements CascadeRevocationPort {
  public plans: CascadeRevocationPlan[] = [];

  public execute(plan: CascadeRevocationPlan): void {
    this.plans.push(plan);
  }
}

class VerificationDecision implements RecruiterVerificationPort {
  public readonly requests: RecruiterVerificationRequest[] = [];

  public constructor(readonly decision: boolean) {}

  public isRecordedVerification(request: RecruiterVerificationRequest): boolean {
    this.requests.push(request);
    return this.decision;
  }
}

const readyRegistry = (...tokens: string[]) => {
  const cascade = new CascadeRecorder();
  const lineageIds = new LineageSequence("lineage-pseudonym-1");
  const recruiterVerification = new VerificationDecision(true);
  const registry = new EnrollmentRegistry({
    tokenGenerator: new TokenSequence(...tokens),
    tokenDigester: new TestDigester(),
    lineageIdGenerator: lineageIds,
    recruiterVerification,
    cascadeRevocation: cascade,
  });
  registry.recordCohortRule({
    versionId: "cohort-v1",
    signedBy: "Don",
    signatureId: "cohort-signature-1",
    signedAt: "2026-07-01T09:00:00.000Z",
  });
  registry.recordAdultEligibilityPolicy({
    versionId: "adult-policy-v1",
    adultOnly: true,
    approvedBy: "Don",
    signatureId: "policy-signature-1",
    signedAt: "2026-07-01T09:05:00.000Z",
  });
  return { registry, cascade, lineageIds, recruiterVerification };
};

const issue = (registry: EnrollmentRegistry) =>
  registry.issueInvitation({
    invitationId: "invite-1",
    recruitmentChannelRef: "channel-control-ref-1",
    issuedAt: "2026-07-02T10:00:00.000Z",
  });

describe("invitation and enrollment lineage", () => {
  it("blocks recruitment until both signed policy gates are recorded", () => {
    const registry = new EnrollmentRegistry({
      tokenGenerator: new TokenSequence("raw-token-1"),
      tokenDigester: new TestDigester(),
      lineageIdGenerator: new LineageSequence("lineage-pseudonym-1"),
      recruiterVerification: new VerificationDecision(true),
      cascadeRevocation: new CascadeRecorder(),
    });

    expect(() => issue(registry)).toThrowError(
      new EnrollmentRuleError("Recruitment requires a signed fixed-cohort rule"),
    );
    registry.recordCohortRule({
      versionId: "cohort-v1",
      signedBy: "Don",
      signatureId: "cohort-signature-1",
      signedAt: "2026-07-01T09:00:00.000Z",
    });
    expect(() => issue(registry)).toThrowError(
      new EnrollmentRuleError(
        "Recruitment requires a signed adult-only eligibility and consent policy",
      ),
    );
  });

  it("rejects gate artifacts not signed or approved by the Don", () => {
    const registry = new EnrollmentRegistry({
      tokenGenerator: new TokenSequence("raw-token-1"),
      tokenDigester: new TestDigester(),
      lineageIdGenerator: new LineageSequence("lineage-pseudonym-1"),
      recruiterVerification: new VerificationDecision(true),
      cascadeRevocation: new CascadeRecorder(),
    });

    expect(() =>
      registry.recordCohortRule({
        versionId: "cohort-v1",
        signedBy: "Release Operator",
        signatureId: "invalid-signature",
        signedAt: "2026-07-01T09:00:00.000Z",
      }),
    ).toThrowError(new EnrollmentRuleError("Cohort rule requires Don signature"));
    expect(() => issue(registry)).toThrowError(
      new EnrollmentRuleError("Recruitment requires a signed fixed-cohort rule"),
    );

    registry.recordCohortRule({
      versionId: "cohort-v1",
      signedBy: "Don",
      signatureId: "cohort-signature-1",
      signedAt: "2026-07-01T09:00:00.000Z",
    });
    expect(() =>
      registry.recordAdultEligibilityPolicy({
        versionId: "adult-policy-v1",
        adultOnly: true,
        approvedBy: "Product Owner",
        signatureId: "invalid-policy-signature",
        signedAt: "2026-07-01T09:05:00.000Z",
      }),
    ).toThrowError(
      new EnrollmentRuleError("Adult eligibility policy requires Don approval"),
    );
    expect(() => issue(registry)).toThrowError(
      new EnrollmentRuleError(
        "Recruitment requires a signed adult-only eligibility and consent policy",
      ),
    );
  });

  it("returns a 72-hour one-time credential while persisting only its digest", () => {
    const rawToken = "raw-secret-enrollment-token";
    const { registry } = readyRegistry(rawToken);

    const result = issue(registry);

    expect(JSON.stringify(result)).not.toContain(rawToken);
    expect(result).toMatchObject({
      expiresAt: "2026-07-05T10:00:00.000Z",
      participantLineageId: "lineage-pseudonym-1",
    });
    const state = registry.stateForInvitation("invite-1");
    expect(state.credential).toMatchObject({
      recordType: "ENROLLMENT_CREDENTIAL",
      tokenDigest: "digest:nekot-tnemllorne-terces-war",
      status: "ACTIVE",
    });
    expect(JSON.stringify(state)).not.toContain(rawToken);
    expect(JSON.stringify(registry.auditTrail())).not.toContain(rawToken);
    expect(JSON.stringify(registry)).not.toContain(rawToken);

    for (const channel of [
      "QUERY_STRING",
      "ANALYTICS",
      "APPLICATION_LOG",
      "REFERRER",
      "SHARE_OUTPUT",
    ] as const) {
      expect(JSON.stringify(registry.projectCredential("invite-1", channel))).not.toContain(
        rawToken,
      );
    }
    expect(result.takeRawToken()).toBe(rawToken);
    expect(() => result.takeRawToken()).toThrowError(
      new EnrollmentRuleError("Raw enrollment credential has already been delivered"),
    );
  });

  it("accepts an active credential exactly once and keeps record types distinct", () => {
    const { registry } = readyRegistry("raw-token-1");
    issue(registry);

    const enrollment = registry.enroll({
      rawToken: "raw-token-1",
      enrolledAt: "2026-07-02T11:00:00.000Z",
    });

    expect(enrollment).toMatchObject({
      recordType: "ENROLLMENT",
      participantLineageId: "lineage-pseudonym-1",
    });
    const state = registry.stateForInvitation("invite-1");
    expect(state.invitation.recordType).toBe("INVITATION");
    expect(state.lineage.recordType).toBe("PARTICIPANT_LINEAGE");
    expect(state.credential.recordType).toBe("ENROLLMENT_CREDENTIAL");
    expect(state.enrollment?.recordType).toBe("ENROLLMENT");
    expect(() =>
      registry.enroll({
        rawToken: "raw-token-1",
        enrolledAt: "2026-07-02T11:01:00.000Z",
      }),
    ).toThrowError(new EnrollmentRuleError("Enrollment credential is already used"));
  });

  it("rejects expired and revoked enrollment credentials", () => {
    const expired = readyRegistry("expired-token").registry;
    issue(expired);
    expect(() =>
      expired.enroll({
        rawToken: "expired-token",
        enrolledAt: "2026-07-05T10:00:00.000Z",
      }),
    ).toThrowError(new EnrollmentRuleError("Enrollment credential is expired"));

    const revoked = readyRegistry("revoked-token").registry;
    issue(revoked);
    revoked.revokeInvitation({
      invitationId: "invite-1",
      revokedAt: "2026-07-02T12:00:00.000Z",
      descendants: { dailySessionCredentialIds: [], revealCredentialIds: [] },
    });
    expect(() =>
      revoked.enroll({
        rawToken: "revoked-token",
        enrolledAt: "2026-07-02T12:01:00.000Z",
      }),
    ).toThrowError(new EnrollmentRuleError("Enrollment credential is revoked"));

    const {
      registry: recruiterVerified,
      recruiterVerification,
    } = readyRegistry("first-token", "verified-token");
    issue(recruiterVerified);
    const recruiterDelivery = recruiterVerified.reissue({
        invitationId: "invite-1",
        reissuedAt: "2026-07-02T13:00:00.000Z",
        verification: {
          kind: "RECRUITER_VERIFICATION",
          recruiterId: "recruiter-1",
          verificationRecordId: "verification-1",
          verifiedAt: "2026-07-02T12:55:00.000Z",
        },
      });
    expect(recruiterDelivery).toMatchObject({
      participantLineageId: "lineage-pseudonym-1",
    });
    expect(JSON.stringify(recruiterDelivery)).not.toContain("verified-token");
    expect(recruiterDelivery.takeRawToken()).toBe("verified-token");
    expect(recruiterVerification.requests).toEqual([
      {
        invitationId: "invite-1",
        participantLineageId: "lineage-pseudonym-1",
        recruiterId: "recruiter-1",
        verificationRecordId: "verification-1",
        verifiedAt: "2026-07-02T12:55:00.000Z",
      },
    ]);
    expect(recruiterVerification.requests[0]).not.toHaveProperty("rawToken");
  });

  it("rejects recruiter reissue when the authoritative verifier has no record", () => {
    const verifier = new VerificationDecision(false);
    const registry = new EnrollmentRegistry({
      tokenGenerator: new TokenSequence("first-token", "unissued-token"),
      tokenDigester: new TestDigester(),
      lineageIdGenerator: new LineageSequence("lineage-pseudonym-1"),
      recruiterVerification: verifier,
      cascadeRevocation: new CascadeRecorder(),
    });
    registry.recordCohortRule({
      versionId: "cohort-v1",
      signedBy: "Don",
      signatureId: "cohort-signature-1",
      signedAt: "2026-07-01T09:00:00.000Z",
    });
    registry.recordAdultEligibilityPolicy({
      versionId: "adult-policy-v1",
      adultOnly: true,
      approvedBy: "Don",
      signatureId: "policy-signature-1",
      signedAt: "2026-07-01T09:05:00.000Z",
    });
    issue(registry);

    expect(() =>
      registry.reissue({
        invitationId: "invite-1",
        reissuedAt: "2026-07-02T13:00:00.000Z",
        verification: {
          kind: "RECRUITER_VERIFICATION",
          recruiterId: "unrecorded-recruiter",
          verificationRecordId: "unrecorded-verification",
          verifiedAt: "2026-07-02T12:55:00.000Z",
        },
      }),
    ).toThrowError(
      new EnrollmentRuleError(
        "Reissue requires original-channel control or recorded recruiter verification",
      ),
    );
  });

  it("reissues only with verified control, preserves lineage and revokes its predecessor", () => {
    const { registry } = readyRegistry("old-token", "new-token");
    issue(registry);

    expect(() =>
      registry.reissue({
        invitationId: "invite-1",
        reissuedAt: "2026-07-02T12:00:00.000Z",
        verification: undefined as never,
      }),
    ).toThrowError(
      new EnrollmentRuleError(
        "Reissue requires original-channel control or recorded recruiter verification",
      ),
    );
    const reissued = registry.reissue({
      invitationId: "invite-1",
      reissuedAt: "2026-07-02T12:00:00.000Z",
      verification: {
        kind: "ORIGINAL_CHANNEL_CONTROL",
        channelControlRef: "channel-control-ref-1",
      },
    });

    expect(reissued).toMatchObject({
      participantLineageId: "lineage-pseudonym-1",
    });
    expect(JSON.stringify(reissued)).not.toContain("new-token");
    expect(reissued.takeRawToken()).toBe("new-token");
    expect(() => reissued.takeRawToken()).toThrowError(
      new EnrollmentRuleError("Raw enrollment credential has already been delivered"),
    );
    expect(registry.stateForInvitation("invite-1").credentials).toMatchObject([
      { status: "REVOKED" },
      { status: "ACTIVE" },
    ]);
    expect(() =>
      registry.enroll({
        rawToken: "old-token",
        enrolledAt: "2026-07-02T12:01:00.000Z",
      }),
    ).toThrowError(new EnrollmentRuleError("Enrollment credential is revoked"));
  });

  it("cascades invitation revocation through descendant credential references", () => {
    const { registry, cascade } = readyRegistry("raw-token-1");
    issue(registry);

    registry.revokeInvitation({
      invitationId: "invite-1",
      revokedAt: "2026-07-02T12:00:00.000Z",
      descendants: {
        dailySessionCredentialIds: ["daily-1", "daily-2"],
        revealCredentialIds: ["reveal-1"],
      },
    });

    expect(cascade.plans).toEqual([
      {
        invitationId: "invite-1",
        participantLineageId: "lineage-pseudonym-1",
        enrollmentCredentialIds: ["invite-1:credential:1"],
        dailySessionCredentialIds: ["daily-1", "daily-2"],
        revealCredentialIds: ["reveal-1"],
        revokedAt: "2026-07-02T12:00:00.000Z",
      },
    ]);
  });

  it("projects only the pseudonymous lineage into gameplay telemetry", () => {
    const { registry, lineageIds } = readyRegistry("raw-token-1");
    issue(registry);
    registry.enroll({
      rawToken: "raw-token-1",
      enrolledAt: "2026-07-02T11:00:00.000Z",
    });

    expect(registry.gameplayLineageFor("invite-1")).toEqual({
      participantLineageId: "lineage-pseudonym-1",
    });
    expect(Object.keys(registry.gameplayLineageFor("invite-1"))).toEqual([
      "participantLineageId",
    ]);
    expect(lineageIds.argumentCounts).toEqual([0]);
    expect(JSON.stringify(registry.gameplayLineageFor("invite-1"))).not.toContain(
      "channel-control-ref-1",
    );
  });
});
