import { describe, expect, it } from "vitest";

import {
  RevealAuthority,
  RevealContainmentError,
  RevealRuleError,
  assertPublicProjectionSafe,
  type AcceptedAnswerEntitlement,
  type ProtectedRevealPayload,
  type RevealGuards,
  type RevealPayloadProvider,
  type RevealRequest,
} from "../src/server/reveal/index.js";

const entitlement = (): AcceptedAnswerEntitlement => ({
  participantLineageId: "participant-lineage-1",
  betaDay: "2026-09-01",
  manifestLineageId: "manifest-lineage-day-1",
  manifestVersionId: "manifest-day-1-v1",
  sessionId: "session-1",
  roundId: "round-3",
  acceptedAnswerId: "accepted-answer-9",
  acceptedAt: "2026-09-01T00:15:00.000Z",
  expiresAt: "2026-09-02T01:00:00.000Z",
  correctionStatus: "ACTIVE",
  revealBlocked: false,
});

const request = (): RevealRequest => ({
  participantLineageId: "participant-lineage-1",
  betaDay: "2026-09-01",
  manifestLineageId: "manifest-lineage-day-1",
  manifestVersionId: "manifest-day-1-v1",
  sessionId: "session-1",
  roundId: "round-3",
  acceptedAnswerId: "accepted-answer-9",
  requestedAt: "2026-09-01T00:16:00.000Z",
});

const guards: RevealGuards = {
  inputValid: true,
  authenticated: true,
  authorized: true,
  credentialValid: true,
  antiForgeryValid: true,
  rateLimitAllowed: true,
};

const payload: ProtectedRevealPayload = {
  correctness: true,
  requiredAttribution: "Approved attribution",
  displayApprovedSourceEvidence: "Display-safe evidence summary",
  explanation: {
    helpfulSignals: ["Signal A"],
    misleadingSignals: ["Signal B"],
  },
  versions: {
    content: "content-version-2",
    candidateSet: "candidate-set-version-4",
    scoring: "scoring-version-1",
    rules: "rules-version-3",
    evidence: "evidence-version-5",
    reveal: "reveal-version-6",
  },
};

class TestProvider implements RevealPayloadProvider {
  public calls = 0;

  public load(): ProtectedRevealPayload {
    this.calls += 1;
    return payload;
  }
}

describe("reveal authorization boundary", () => {
  it("authorizes one exact request and returns the complete display-approved payload", () => {
    const provider = new TestProvider();
    const result = RevealAuthority.issue(entitlement(), provider).authorize(request(), guards);

    expect(result.response).toEqual({ outcome: "AUTHORIZED", payload });
    expect(result.audit).toMatchObject({
      outcome: "AUTHORIZED",
      acceptedAnswerId: "accepted-answer-9",
      revealedAt: "2026-09-01T00:16:00.000Z",
      correctness: true,
      evidenceVersionId: "evidence-version-5",
      revealVersionId: "reveal-version-6",
    });
    expect(provider.calls).toBe(1);
    expect(Object.isFrozen(result.response)).toBe(true);
    expect(Object.isFrozen(result.response.payload)).toBe(true);
  });

  const denialCases = [
    { name: "premature", request: { requestedAt: "2026-09-01T00:14:59.000Z" }, reason: "NOT_READY" },
    { name: "expired", request: { requestedAt: "2026-09-02T01:00:00.001Z" }, reason: "EXPIRED" },
    { name: "cross participant lineage", request: { participantLineageId: "participant-lineage-2" }, reason: "SCOPE_MISMATCH" },
    { name: "cross day", request: { betaDay: "2026-09-02" }, reason: "SCOPE_MISMATCH" },
    { name: "cross manifest lineage", request: { manifestLineageId: "other-lineage" }, reason: "SCOPE_MISMATCH" },
    { name: "cross manifest version", request: { manifestVersionId: "manifest-day-1-v2" }, reason: "SCOPE_MISMATCH" },
    { name: "cross session", request: { sessionId: "session-2" }, reason: "SCOPE_MISMATCH" },
    { name: "cross round", request: { roundId: "round-4" }, reason: "SCOPE_MISMATCH" },
    { name: "cross accepted transition", request: { acceptedAnswerId: "accepted-answer-10" }, reason: "SCOPE_MISMATCH" },
    { name: "invalid input", guards: { inputValid: false }, reason: "GUARD_REJECTED" },
    { name: "unauthenticated", guards: { authenticated: false }, reason: "GUARD_REJECTED" },
    { name: "unauthorized", guards: { authorized: false }, reason: "GUARD_REJECTED" },
    { name: "invalid credential", guards: { credentialValid: false }, reason: "GUARD_REJECTED" },
    { name: "anti-forgery failure", guards: { antiForgeryValid: false }, reason: "GUARD_REJECTED" },
    { name: "rate limited", guards: { rateLimitAllowed: false }, reason: "GUARD_REJECTED" },
    { name: "void round", entitlement: { correctionStatus: "VOID" }, reason: "ROUND_BLOCKED" },
    { name: "withdrawn content", entitlement: { correctionStatus: "CONTENT_WITHDRAWN" }, reason: "ROUND_BLOCKED" },
    { name: "reveal block", entitlement: { revealBlocked: true }, reason: "ROUND_BLOCKED" },
  ] as const;

  it.each(denialCases)("denies $name without invoking the protected provider", (testCase) => {
    const provider = new TestProvider();
    const authority = RevealAuthority.issue(
      { ...entitlement(), ...testCase.entitlement },
      provider,
    );
    const result = authority.authorize(
      { ...request(), ...testCase.request },
      { ...guards, ...testCase.guards },
    );

    expect(result.response).toMatchObject({
      outcome: "DENIED",
      reason: testCase.reason,
    });
    expect(result.audit).toMatchObject({
      outcome: "DENIED",
      reason: testCase.reason,
      deniedAt: (testCase.request as Partial<RevealRequest> | undefined)?.requestedAt ?? request().requestedAt,
    });
    expect(provider.calls).toBe(0);
  });

  it("denies replay without loading the protected payload again", () => {
    const provider = new TestProvider();
    const first = RevealAuthority.issue(entitlement(), provider).authorize(request(), guards);
    const replay = first.next.authorize(request(), guards);

    expect(first.response.outcome).toBe("AUTHORIZED");
    expect(replay.response).toMatchObject({ outcome: "DENIED", reason: "REPLAYED" });
    expect(provider.calls).toBe(1);
  });

  it("denies replay on the same authority instance", () => {
    const provider = new TestProvider();
    const authority = RevealAuthority.issue(entitlement(), provider);
    const first = authority.authorize(request(), guards);
    const replay = authority.authorize(request(), guards);

    expect(first.response.outcome).toBe("AUTHORIZED");
    expect(replay.response).toMatchObject({ outcome: "DENIED", reason: "REPLAYED" });
    expect(provider.calls).toBe(1);
  });

  it.each([
    "participantLineageId",
    "betaDay",
    "manifestLineageId",
    "manifestVersionId",
    "sessionId",
    "roundId",
    "acceptedAnswerId",
  ] as const)("rejects entitlement issuance with blank %s", (field) => {
    expect(() => RevealAuthority.issue({ ...entitlement(), [field]: " " }, new TestProvider()))
      .toThrowError(new RevealRuleError(`entitlement.${field} must not be empty`));
  });

  it("rejects invalid or non-increasing entitlement instants", () => {
    expect(() => RevealAuthority.issue(
      { ...entitlement(), acceptedAt: "not-an-instant" },
      new TestProvider(),
    )).toThrow("entitlement.acceptedAt must be a valid instant");
    expect(() => RevealAuthority.issue(
      { ...entitlement(), expiresAt: "not-an-instant" },
      new TestProvider(),
    )).toThrow("entitlement.expiresAt must be a valid instant");
    expect(() => RevealAuthority.issue(
      { ...entitlement(), expiresAt: entitlement().acceptedAt },
      new TestProvider(),
    )).toThrow("entitlement.acceptedAt must precede entitlement.expiresAt");
  });

  it("rejects unsupported correction state at issuance", () => {
    expect(() => RevealAuthority.issue({
      ...entitlement(),
      correctionStatus: "PENDING" as "ACTIVE",
    }, new TestProvider())).toThrow("entitlement.correctionStatus is not supported");
  });

  it.each([undefined, "false"])(
    "rejects non-boolean revealBlocked value %s at issuance",
    (revealBlocked) => {
      expect(() => RevealAuthority.issue({
        ...entitlement(),
        revealBlocked,
      } as AcceptedAnswerEntitlement, new TestProvider())).toThrow(
        "entitlement.revealBlocked must be a boolean",
      );
    },
  );

  it("fails closed at the exact expiry instant", () => {
    const provider = new TestProvider();
    const result = RevealAuthority.issue(entitlement(), provider).authorize(
      { ...request(), requestedAt: entitlement().expiresAt },
      guards,
    );
    expect(result.response).toMatchObject({ outcome: "DENIED", reason: "EXPIRED" });
    expect(provider.calls).toBe(0);
  });

  it.each([
    { name: "correctness", value: { ...payload, correctness: "yes" } },
    { name: "attribution", value: { ...payload, requiredAttribution: " " } },
    { name: "display evidence", value: { ...payload, displayApprovedSourceEvidence: " " } },
    { name: "content version", value: { ...payload, versions: { ...payload.versions, content: " " } } },
    { name: "candidate version", value: { ...payload, versions: { ...payload.versions, candidateSet: " " } } },
    { name: "scoring version", value: { ...payload, versions: { ...payload.versions, scoring: " " } } },
    { name: "rules version", value: { ...payload, versions: { ...payload.versions, rules: " " } } },
    { name: "evidence version", value: { ...payload, versions: { ...payload.versions, evidence: " " } } },
    { name: "reveal version", value: { ...payload, versions: { ...payload.versions, reveal: " " } } },
    { name: "helpful signals", value: { ...payload, explanation: { ...payload.explanation, helpfulSignals: [" "] } } },
    { name: "misleading signals", value: { ...payload, explanation: { ...payload.explanation, misleadingSignals: [] } } },
  ])("denies malformed provider $name without leaking", ({ value }) => {
    const provider = {
      calls: 0,
      load() {
        this.calls += 1;
        return value as ProtectedRevealPayload;
      },
    };
    const result = RevealAuthority.issue(entitlement(), provider).authorize(request(), guards);
    const serialized = JSON.stringify({ response: result.response, audit: result.audit }).toLowerCase();

    expect(result.response).toMatchObject({ outcome: "DENIED", reason: "PAYLOAD_REJECTED" });
    expect(provider.calls).toBe(1);
    for (const term of ["correct", "answer", "candidate", "attribution", "evidence", "explanation"]) {
      expect(serialized.includes(term)).toBe(false);
    }
  });

  it("keeps denial response and audit recursively free of protected reveal data", () => {
    const provider = new TestProvider();
    const denied = RevealAuthority.issue(entitlement(), provider).authorize(
      { ...request(), acceptedAnswerId: "wrong-transition" },
      guards,
    );
    const serialized = JSON.stringify({
      response: denied.response,
      audit: denied.audit,
    }).toLowerCase();
    const forbidden = [
      "correct",
      "answer",
      "candidate",
      "attribution",
      "evidence",
      "explanation",
      "contentversion",
      "scoringversion",
      "rulesversion",
      "revealversion",
    ];

    for (const term of forbidden) expect(serialized.includes(term)).toBe(false);
    expect(denied.response).toEqual({
      outcome: "DENIED",
      scope: {
        participantLineageId: "participant-lineage-1",
        betaDay: "2026-09-01",
        manifestLineageId: "manifest-lineage-day-1",
        manifestVersionId: "manifest-day-1-v1",
        roundId: "round-3",
      },
      deniedAt: "2026-09-01T00:16:00.000Z",
      reason: "SCOPE_MISMATCH",
    });
  });

  it.each([
    "PUBLIC_BUNDLE",
    "SOURCE_MAP",
    "PREFETCH",
    "ANALYTICS",
    "LOG",
  ] as const)("rejects protected pre-reveal data from %s projection", (channel) => {
    expect(() => assertPublicProjectionSafe(channel, {
      harmless: { futureAnswers: ["candidate-2"] },
    })).toThrowError(new RevealContainmentError(
      `${channel} projection contains protected field futureAnswers`,
    ));
    expect(() => assertPublicProjectionSafe(channel, {
      nested: { restrictedEvidence: "raw" },
    })).toThrow(`${channel} projection contains protected field restrictedEvidence`);
    expect(() => assertPublicProjectionSafe(channel, {
      preRevealAnswer: "candidate-3",
    })).toThrow(`${channel} projection contains protected field preRevealAnswer`);
    for (const field of [
      "Pre-Reveal_Answer",
      "future-answer",
      "FUTURE ANSWERS",
      "restricted_evidence",
      "correct.answer",
    ]) {
      expect(() => assertPublicProjectionSafe(channel, { [field]: "protected" }))
        .toThrow(`${channel} projection contains protected field ${field}`);
    }
  });
});
