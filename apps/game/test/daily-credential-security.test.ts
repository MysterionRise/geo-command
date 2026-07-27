import { describe, expect, it } from "vitest";

import {
  CredentialRuleError,
  DailyCredentialRegistry,
  type AuthorizationRequest,
  type CredentialTransition,
} from "../src/server/security/daily-credentials.js";

const operator = { name: "Alice Operator", role: "CREDENTIAL_OPERATOR" as const };
const digest = (value: string) => {
  let hash = 2_166_136_261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  return `digest:${hash >>> 0}`;
};
const makeRegistry = (
  rateAllowed = true,
  approvedParticipantLineageIds = ["lineage-1", "lineage-2"],
) => {
  let generated = 0;
  const registry = new DailyCredentialRegistry({
    tokenGenerator: { generate: () => `raw-session-${++generated}` },
    digester: { digest },
    rateLimiter: { allow: () => rateAllowed },
    approvedParticipantLineageIds,
    maximumInputBytes: 128,
  });
  return { registry, generated: () => generated };
};

const issue = (
  registry: DailyCredentialRegistry,
  overrides: Partial<Parameters<DailyCredentialRegistry["issue"]>[0]> = {},
) =>
  registry.issue({
    credentialId: "daily-1",
    invitationId: "invite-1",
    participantLineageId: "lineage-1",
    betaDay: "2026-07-02",
    manifestVersionId: "manifest-v1",
    permittedTransitions: ["SESSION_START", "ANSWER_SUBMIT", "CORRECTION_NOTICE"],
    issuedAt: "2026-07-02T00:00:00.000Z",
    antiForgeryToken: "csrf-1",
    operator,
    ...overrides,
  });

const request = (overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({
  credentialId: "daily-1",
  rawToken: "raw-session-1",
  participantLineageId: "lineage-1",
  betaDay: "2026-07-02",
  manifestVersionId: "manifest-v1",
  transition: "ANSWER_SUBMIT",
  roundId: "round-1",
  occurredAt: "2026-07-02T12:00:00.000Z",
  mutationKey: "mutation-1",
  antiForgeryToken: "csrf-1",
  rateLimitKey: "lineage-1:answer",
  inputBytes: 64,
  ...overrides,
});

describe("daily credential and endpoint security", () => {
  it("issues one closure-delivered token per lineage and UTC day while storing only its digest", () => {
    const { registry, generated } = makeRegistry();
    const delivery = issue(registry);

    expect(delivery.expiresAt).toBe("2026-07-03T01:00:00.000Z");
    expect(delivery.takeRawToken()).toBe("raw-session-1");
    expect(() => delivery.takeRawToken()).toThrowError("Raw token already consumed");
    expect(JSON.stringify(delivery)).not.toContain("raw-session-1");
    expect(registry.credentialRecord("daily-1")).toMatchObject({
      tokenDigest: digest("raw-session-1"),
      participantLineageId: "lineage-1",
      betaDay: "2026-07-02",
      manifestVersionId: "manifest-v1",
    });
    expect(JSON.stringify(registry.credentialRecord("daily-1"))).not.toContain("raw-session-1");
    expect(() => issue(registry, { credentialId: "daily-2" })).toThrowError(
      "Daily credential already issued for lineage and beta day",
    );
    expect(generated()).toBe(1);
  });

  it("rejects an unapproved participant lineage before generating a token", () => {
    const { registry, generated } = makeRegistry(true, ["lineage-1"]);
    expect(() => issue(registry, { participantLineageId: "lineage-unknown" })).toThrowError(
      "Participant lineage is not approved",
    );
    expect(generated()).toBe(0);
  });

  it("uses the earlier expiry ceiling and rejects the exact expiry boundary", () => {
    const { registry } = makeRegistry();
    issue(registry, {
      issuedAt: "2026-07-01T22:00:00.000Z",
    });
    expect(registry.credentialRecord("daily-1").expiresAt).toBe("2026-07-03T00:00:00.000Z");
    expect(
      registry.authorizeAndApply(
        request({ occurredAt: "2026-07-03T00:00:00.000Z" }),
        () => undefined,
      ),
    ).toEqual({ allowed: false, reason: "EXPIRED" });
  });

  it.each([
    ["wrong lineage", { participantLineageId: "lineage-2" }, "SCOPE_MISMATCH"],
    ["wrong day", { betaDay: "2026-07-03" }, "SCOPE_MISMATCH"],
    ["wrong manifest", { manifestVersionId: "manifest-v2" }, "SCOPE_MISMATCH"],
    ["unpermitted action", { transition: "SESSION_COMPLETE" }, "TRANSITION_NOT_PERMITTED"],
    ["wrong raw token", { rawToken: "wrong" }, "TOKEN_INVALID"],
    ["oversized input", { inputBytes: 129 }, "INPUT_BOUNDS"],
    ["bad anti-forgery proof", { antiForgeryToken: "bad" }, "ANTI_FORGERY"],
    ["empty anti-forgery proof", { antiForgeryToken: "" }, "ANTI_FORGERY"],
    ["missing anti-forgery proof", { antiForgeryToken: undefined }, "ANTI_FORGERY"],
    ["empty mutation key", { mutationKey: "" }, "MUTATION_KEY_REQUIRED"],
    ["missing mutation key", { mutationKey: undefined }, "MUTATION_KEY_REQUIRED"],
  ] as const)("denies %s", (_label, overrides, reason) => {
    const { registry } = makeRegistry();
    issue(registry);
    let applied = 0;
    expect(
      registry.authorizeAndApply(request(overrides as Partial<AuthorizationRequest>), () => applied++),
    ).toEqual({
      allowed: false,
      reason,
    });
    expect(applied).toBe(0);
    expect(registry.auditRecords().at(-1)).toMatchObject({ outcome: "DENIED", reason });
  });

  it("rate-limits before applying and records an auditable denial", () => {
    const { registry } = makeRegistry(false);
    issue(registry);
    let applied = 0;
    expect(registry.authorizeAndApply(request(), () => applied++)).toEqual({
      allowed: false,
      reason: "RATE_LIMITED",
    });
    expect(applied).toBe(0);
    expect(registry.auditRecords().at(-1)).toMatchObject({ outcome: "DENIED", reason: "RATE_LIMITED" });
  });

  it("applies a mutation once and rejects token or mutation-key replay", () => {
    const { registry } = makeRegistry();
    issue(registry);
    let applied = 0;
    expect(registry.authorizeAndApply(request(), () => applied++)).toEqual({ allowed: true });
    expect(registry.authorizeAndApply(request(), () => applied++)).toEqual({
      allowed: false,
      reason: "REPLAY",
    });
    expect(applied).toBe(1);
  });

  it("rejects explicit revocation and participant withdrawal", () => {
    const revoked = makeRegistry().registry;
    issue(revoked);
    revoked.revoke({ credentialId: "daily-1", occurredAt: "2026-07-02T10:00:00Z", operator });
    expect(revoked.authorizeAndApply(request(), () => undefined)).toEqual({
      allowed: false,
      reason: "REVOKED",
    });

    const withdrawn = makeRegistry().registry;
    issue(withdrawn);
    withdrawn.recordParticipantWithdrawal({
      participantLineageId: "lineage-1",
      occurredAt: "2026-07-02T10:00:00Z",
      operator,
    });
    expect(withdrawn.authorizeAndApply(request(), () => undefined)).toEqual({
      allowed: false,
      reason: "PARTICIPANT_WITHDRAWN",
    });
  });

  it.each(["VOID", "CONTENT_WITHDRAWN"] as const)(
    "narrows a %s round to its correction notice without revoking other transitions",
    (status) => {
    const { registry } = makeRegistry();
    issue(registry);
    registry.recordRoundCorrection({
      credentialId: "daily-1",
      roundId: "round-1",
      status,
      occurredAt: "2026-07-02T10:00:00Z",
      operator,
    });
    expect(registry.authorizeAndApply(request(), () => undefined)).toEqual({
      allowed: false,
      reason: "ROUND_CORRECTED",
    });
    expect(
      registry.authorizeAndApply(
        request({ transition: "CORRECTION_NOTICE", mutationKey: "notice-1" }),
        () => undefined,
      ),
    ).toEqual({ allowed: true });
    expect(
      registry.authorizeAndApply(
        request({ roundId: "round-2", mutationKey: "mutation-2" }),
        () => undefined,
      ),
    ).toEqual({ allowed: true });
    },
  );

  it("requires named least-privilege operators and cascades only named descendants", () => {
    const { registry } = makeRegistry();
    expect(() => issue(registry, { operator: { name: "", role: "CREDENTIAL_OPERATOR" } })).toThrowError(
      new CredentialRuleError("Named operator is required"),
    );
    expect(() => issue(registry, { operator: { name: "Admin", role: "CONTENT_OPERATOR" } })).toThrowError(
      new CredentialRuleError("Credential operator role is required"),
    );
    issue(registry);
    for (const invalidOperator of [
      { name: "", role: "CREDENTIAL_OPERATOR" as const },
      { name: "Admin", role: "CONTENT_OPERATOR" as const },
    ]) {
      expect(() =>
        registry.revoke({
          credentialId: "daily-1",
          occurredAt: "2026-07-02T10:00:00Z",
          operator: invalidOperator,
        }),
      ).toThrowError();
      expect(() =>
        registry.cascadeRevoke({
          invitationId: "invite-1",
          participantLineageId: "lineage-1",
          descendantCredentialIds: ["daily-1"],
          occurredAt: "2026-07-02T10:00:00Z",
          operator: invalidOperator,
        }),
      ).toThrowError();
    }
    registry.cascadeRevoke({
      invitationId: "invite-1",
      participantLineageId: "lineage-1",
      descendantCredentialIds: ["daily-1"],
      occurredAt: "2026-07-02T10:00:00Z",
      operator,
    });
    expect(registry.authorizeAndApply(request(), () => undefined)).toEqual({
      allowed: false,
      reason: "REVOKED",
    });
    expect(registry.auditRecords()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "ISSUE", operatorName: "Alice Operator" }),
        expect.objectContaining({ action: "CASCADE_REVOKE", operatorName: "Alice Operator" }),
      ]),
    );
    expect(Object.isFrozen(registry.auditRecords())).toBe(true);
    expect(registry.auditRecords().every((record) => Object.isFrozen(record))).toBe(true);
  });

  it("cascades every named descendant while leaving an unrelated credential usable", () => {
    const { registry } = makeRegistry();
    issue(registry);
    issue(registry, {
      credentialId: "daily-2",
      betaDay: "2026-07-03",
      issuedAt: "2026-07-03T00:00:00Z",
    });
    issue(registry, {
      credentialId: "daily-3",
      invitationId: "invite-2",
      participantLineageId: "lineage-2",
    });
    registry.cascadeRevoke({
      invitationId: "invite-1",
      participantLineageId: "lineage-1",
      descendantCredentialIds: ["daily-1", "daily-2"],
      occurredAt: "2026-07-02T10:00:00Z",
      operator,
    });
    expect(registry.credentialRecord("daily-1").status).toBe("REVOKED");
    expect(registry.credentialRecord("daily-2").status).toBe("REVOKED");
    expect(registry.credentialRecord("daily-3").status).toBe("ACTIVE");
    expect(
      registry.authorizeAndApply(
        request({
          credentialId: "daily-3",
          rawToken: "raw-session-3",
          participantLineageId: "lineage-2",
          mutationKey: "unrelated-1",
        }),
        () => undefined,
      ),
    ).toEqual({ allowed: true });
  });

  it("keeps raw credentials out of safe projections and minimized audits", () => {
    const { registry } = makeRegistry();
    issue(registry);
    registry.authorizeAndApply(request(), () => undefined);
    const outputs = {
      url: registry.safeUrlParameters("daily-1"),
      log: registry.safeLogProjection("daily-1"),
      analytics: registry.safeAnalyticsProjection("daily-1"),
      audit: registry.auditRecords(),
    };
    expect(JSON.stringify(outputs)).not.toContain("raw-session-1");
    expect(JSON.stringify(outputs)).not.toContain(digest("raw-session-1"));
    expect(outputs.url).not.toHaveProperty("token");
    expect(outputs.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: "ALLOWED" }),
      ]),
    );
  });

  it("derives the rate-limit key from credential scope and action", () => {
    let receivedKey = "";
    const registry = new DailyCredentialRegistry({
      tokenGenerator: { generate: () => "raw-session-1" },
      digester: { digest },
      rateLimiter: { allow: (key) => ((receivedKey = key), true) },
      approvedParticipantLineageIds: ["lineage-1"],
      maximumInputBytes: 128,
    });
    issue(registry);
    registry.authorizeAndApply(request({ rateLimitKey: "caller-controlled" }), () => undefined);
    expect(receivedKey).toBe(
      "daily-1:lineage-1:2026-07-02:manifest-v1:ANSWER_SUBMIT",
    );
  });

  it.each([
    ["occurredAt", { occurredAt: "" }],
    ["missing occurredAt", { occurredAt: undefined }],
    ["roundId", { roundId: "" }],
    ["missing roundId", { roundId: undefined }],
    ["rateLimitKey", { rateLimitKey: "" }],
    ["missing rateLimitKey", { rateLimitKey: undefined }],
  ] as const)("bounds blank %s before apply or credential ports", (_label, overrides) => {
    let digestCalls = 0;
    let rateCalls = 0;
    const registry = new DailyCredentialRegistry({
      tokenGenerator: { generate: () => "raw-session-1" },
      digester: { digest: (value) => ((digestCalls += 1), digest(value)) },
      rateLimiter: { allow: () => ((rateCalls += 1), true) },
      approvedParticipantLineageIds: ["lineage-1"],
      maximumInputBytes: 128,
    });
    issue(registry);
    digestCalls = 0;
    let applied = 0;
    expect(
      registry.authorizeAndApply(
        request(overrides as Partial<AuthorizationRequest>),
        () => applied++,
      ),
    ).toEqual({ allowed: false, reason: "INPUT_BOUNDS" });
    expect({ applied, digestCalls, rateCalls }).toEqual({ applied: 0, digestCalls: 0, rateCalls: 0 });
    expect(registry.auditRecords().at(-1)).toMatchObject({ outcome: "DENIED", reason: "INPUT_BOUNDS" });
  });

  it("audits a thrown mutation as failed and consumes its idempotency key", () => {
    const { registry } = makeRegistry();
    issue(registry);
    let attempts = 0;
    expect(
      registry.authorizeAndApply(request(), () => {
        attempts += 1;
        throw new Error("storage failed");
      }),
    ).toEqual({ allowed: false, reason: "MUTATION_FAILED" });
    expect(registry.auditRecords().at(-1)).toMatchObject({
      action: "AUTHORIZE",
      outcome: "DENIED",
      reason: "MUTATION_FAILED",
    });
    expect(registry.auditRecords().at(-1)).not.toMatchObject({ outcome: "ALLOWED" });
    expect(registry.authorizeAndApply(request(), () => attempts++)).toEqual({
      allowed: false,
      reason: "REPLAY",
    });
    expect(attempts).toBe(1);
  });

  it("derives cascade descendants authoritatively and rejects mismatched supplied IDs atomically", () => {
    const { registry } = makeRegistry();
    issue(registry);
    issue(registry, { credentialId: "daily-2", betaDay: "2026-07-03", issuedAt: "2026-07-03T00:00:00Z" });
    issue(registry, { credentialId: "daily-3", invitationId: "invite-2", participantLineageId: "lineage-2" });
    expect(() =>
      registry.cascadeRevoke({
        invitationId: "invite-1",
        participantLineageId: "lineage-1",
        descendantCredentialIds: ["daily-1", "daily-3"],
        occurredAt: "2026-07-02T10:00:00Z",
        operator,
      }),
    ).toThrowError("Cascade descendant scope mismatch");
    expect(registry.credentialRecord("daily-1").status).toBe("ACTIVE");
    registry.cascadeRevoke({
      invitationId: "invite-1",
      participantLineageId: "lineage-1",
      descendantCredentialIds: ["daily-1"],
      occurredAt: "2026-07-02T10:01:00Z",
      operator,
    });
    expect(registry.credentialRecord("daily-1").status).toBe("REVOKED");
    expect(registry.credentialRecord("daily-2").status).toBe("REVOKED");
    expect(registry.credentialRecord("daily-3").status).toBe("ACTIVE");
  });

  it.each([
    ["impossible UTC day", { betaDay: "2026-02-30" }],
    ["empty scope", { permittedTransitions: [] }],
    ["unknown transition", { permittedTransitions: ["UNKNOWN" as CredentialTransition] }],
    ["duplicate transition", { permittedTransitions: ["SESSION_START", "SESSION_START"] }],
  ] as const)("rejects issuance with %s before token generation", (_label, overrides) => {
    const { registry, generated } = makeRegistry();
    expect(() => issue(registry, overrides)).toThrowError();
    expect(generated()).toBe(0);
  });

  it.each(["raw-session-1", "csrf-1"] as const)(
    "rejects a blank digest for %s before persistence or delivery",
    (blankFor) => {
      const registry = new DailyCredentialRegistry({
        tokenGenerator: { generate: () => "raw-session-1" },
        digester: { digest: (value) => (value === blankFor ? "" : digest(value)) },
        rateLimiter: { allow: () => true },
        approvedParticipantLineageIds: ["lineage-1"],
        maximumInputBytes: 128,
      });
      expect(() => issue(registry)).toThrowError("Credential digests must be nonblank");
      expect(() => registry.credentialRecord("daily-1")).toThrowError("Credential does not exist");
    },
  );

  it("audits every denied privileged operator attempt without credential secrets", () => {
    const { registry } = makeRegistry();
    for (const invalidOperator of [
      { name: "", role: "CREDENTIAL_OPERATOR" as const },
      { name: "Wrong Role", role: "CONTENT_OPERATOR" as const },
    ]) {
      const beforeIssue = registry.auditRecords().length;
      expect(() => issue(registry, { operator: invalidOperator })).toThrowError();
      expect(registry.auditRecords()).toHaveLength(beforeIssue + 1);
      expect(registry.auditRecords().at(-1)).toMatchObject({ action: "ISSUE", outcome: "DENIED", ...(invalidOperator.name ? { operatorName: invalidOperator.name } : {}) });
    }
    issue(registry);
    for (const invalidOperator of [
      { name: "", role: "CREDENTIAL_OPERATOR" as const },
      { name: "Wrong Role", role: "CONTENT_OPERATOR" as const },
    ]) {
      for (const action of ["REVOKE", "CASCADE_REVOKE"] as const) {
        const before = registry.auditRecords().length;
        const call = () =>
          action === "REVOKE"
            ? registry.revoke({ credentialId: "daily-1", occurredAt: "2026-07-02T10:00:00Z", operator: invalidOperator })
            : registry.cascadeRevoke({ invitationId: "invite-1", participantLineageId: "lineage-1", descendantCredentialIds: ["daily-1"], occurredAt: "2026-07-02T10:00:00Z", operator: invalidOperator });
        expect(call).toThrowError();
        expect(registry.auditRecords()).toHaveLength(before + 1);
        expect(registry.auditRecords().at(-1)).toMatchObject({ action, outcome: "DENIED", ...(invalidOperator.name ? { operatorName: invalidOperator.name } : {}) });
      }
    }
    const serialized = JSON.stringify(registry.auditRecords());
    expect(serialized).not.toContain("raw-session-1");
    expect(serialized).not.toContain(digest("raw-session-1"));
    expect(Object.isFrozen(registry.auditRecords())).toBe(true);
    expect(registry.auditRecords().every(Object.isFrozen)).toBe(true);
  });

  it("audits a valid-operator issue failure exactly once", () => {
    const { registry } = makeRegistry();
    expect(() => issue(registry, { participantLineageId: "unapproved" })).toThrowError();
    expect(registry.auditRecords()).toHaveLength(1);
    expect(registry.auditRecords()[0]).toMatchObject({ action: "ISSUE", outcome: "DENIED", operatorName: "Alice Operator" });
  });

  it("audits a valid-operator revoke failure exactly once", () => {
    const { registry } = makeRegistry();
    expect(() => registry.revoke({ credentialId: "unknown", occurredAt: "2026-07-02T10:00:00Z", operator })).toThrowError();
    expect(registry.auditRecords()).toHaveLength(1);
    expect(registry.auditRecords()[0]).toMatchObject({ action: "REVOKE", outcome: "DENIED", operatorName: "Alice Operator" });
  });

  it("audits a valid-operator cascade failure exactly once", () => {
    const { registry } = makeRegistry();
    issue(registry);
    issue(registry, {
      credentialId: "daily-3",
      invitationId: "invite-2",
      participantLineageId: "lineage-2",
    });
    const before = registry.auditRecords().length;
    expect(() => registry.cascadeRevoke({
        invitationId: "invite-1",
        participantLineageId: "lineage-1",
        descendantCredentialIds: ["daily-3"],
        occurredAt: "2026-07-02T10:00:00Z",
        operator,
      })).toThrowError();
    expect(registry.auditRecords()).toHaveLength(before + 1);
    expect(registry.auditRecords().at(-1)).toMatchObject({ action: "CASCADE_REVOKE", outcome: "DENIED", operatorName: "Alice Operator" });
    const serialized = JSON.stringify(registry.auditRecords());
    expect(serialized).not.toContain("raw-session-1");
    expect(serialized).not.toContain(digest("raw-session-1"));
  });
});
