import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createUtcBetaLifecycle as createUtcBetaLifecycleWithAuthority,
  evaluateReleaseWindow as evaluateReleaseWindowWithAuthority,
} from "../src/server/operations/release/utc-lifecycle.js";

type RecordValue = Record<string, unknown>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const recursivelyFrozen = (value: unknown): boolean => typeof value !== "object" || value === null
  ? true
  : Object.isFrozen(value) && Object.values(value).every(recursivelyFrozen);

const TEST_AUTHORITY_SECRET = "test-only-release-authority-secret";
const TEST_TRUST_DOMAIN = Object.freeze({ id: "test-release-trust-domain" });

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, canonicalValue(nested)]));
};

const digest = (value: unknown): string => JSON.stringify(canonicalValue(value));

const signatureFor = (purpose: string, signerName: string, signerRole: string, signedAt: string, payloadDigest: string): string =>
  createHmac("sha256", TEST_AUTHORITY_SECRET)
    .update([purpose, signerName, signerRole, signedAt, payloadDigest].join("\n"))
    .digest("hex");

const unsigned = (value: Readonly<Record<string, unknown>>): RecordValue => {
  const copy = { ...value };
  delete copy.signatureId;
  return copy;
};

const authority = Object.freeze({
  trustDomain: TEST_TRUST_DOMAIN,
  verifyApproval: (claim: Readonly<Record<string, unknown>>): boolean =>
    typeof claim.purpose === "string" && typeof claim.signerName === "string" && typeof claim.signerRole === "string" &&
    typeof claim.signedAt === "string" && typeof claim.signatureId === "string" && typeof claim.payloadDigest === "string" &&
    claim.signatureId === signatureFor(claim.purpose, claim.signerName, claim.signerRole, claim.signedAt, claim.payloadDigest),
  isAuthenticatedOperator: () => false,
});

const createUtcBetaLifecycle = (value: unknown) => createUtcBetaLifecycleWithAuthority(value, authority);
const evaluateReleaseWindow = (value: unknown) => evaluateReleaseWindowWithAuthority(value, authority);

const activeDayIds = () => Array.from({ length: 14 }, (_, index) => `active-day-${String(index + 1)}`);

const config = (overrides: RecordValue = {}) => {
  const value: RecordValue = {
    lifecycleVersionId: "utc-lifecycle-v1",
    dayCalendarVersionId: "active-day-calendar-v1",
    day1StartDate: "2026-08-01",
    activeDayIds: activeDayIds(),
    graceMinutes: 60,
    signedBy: "Don",
    signedAt: "2026-07-31T12:00:00.000Z",
    ...overrides,
  };
  value.signatureId = Object.hasOwn(overrides, "signatureId") ? overrides.signatureId : signatureFor(
    "UTC_LIFECYCLE", String(value.signedBy), "DON", String(value.signedAt), digest(unsigned(value)),
  );
  return deepFreeze(value);
};

const request = (
  lifecycle: ReturnType<typeof createUtcBetaLifecycle>,
  activeDayId: string,
  action: "ISSUE" | "RESUME" | "WRITE_EVENT" | "READ",
  occurredAt: string,
  sessionStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "WITHDRAWN" = "IN_PROGRESS",
  credentialIssued = true,
  extra: RecordValue = {},
) => deepFreeze({ lifecycle, activeDayId, action, occurredAt, sessionStatus, credentialIssued, ...extra });

describe("fourteen-active-day UTC lifecycle", () => {
  it("creates seven initial half-open windows while reserving fourteen immutable active-day identities", () => {
    const input = config();
    const lifecycle = createUtcBetaLifecycle(input);
    expect(lifecycle).toEqual({
      lifecycleVersionId: "utc-lifecycle-v1",
      dayCalendarVersionId: "active-day-calendar-v1",
      day1StartDate: "2026-08-01",
      activeDayIds: activeDayIds(),
      graceMinutes: 60,
      initialWindows: Array.from({ length: 7 }, (_, index) => ({
        activeDayId: `active-day-${String(index + 1)}`,
        ordinal: index + 1,
        startsAt: `2026-08-0${String(index + 1)}T00:00:00.000Z`,
        endsAt: `2026-08-0${String(index + 2)}T00:00:00.000Z`,
        graceEndsAt: `2026-08-0${String(index + 2)}T01:00:00.000Z`,
      })),
      day7FreezeAt: "2026-08-08T01:00:00.000Z",
      day8Start: null,
    });
    expect(recursivelyFrozen(lifecycle)).toBe(true);
    expect(lifecycle).not.toBe(input);
    expect(lifecycle.activeDayIds).not.toBe(input.activeDayIds);
  });

  it("requires a trusted authority proof and deterministically re-derives from persisted signed source", () => {
    const source = config();
    const first = createUtcBetaLifecycle(source);
    const persistedSource = deepFreeze(JSON.parse(JSON.stringify(source)) as RecordValue);
    const rederived = createUtcBetaLifecycle(persistedSource);
    expect(rederived).toEqual(first);
    expect(rederived).not.toBe(first);
    expect(() => createUtcBetaLifecycle(config({ signatureId: "plausible-but-forged-signature" })))
      .toThrow(/authority|signature|approval|verify/i);
  });

  it("binds certified lifecycle provenance to the verifier trust domain", () => {
    const permissiveAuthority = Object.freeze({
      trustDomain: Object.freeze({ id: "foreign-permissive-domain" }),
      verifyApproval: () => true,
      isAuthenticatedOperator: () => true,
    });
    const foreignLifecycle = createUtcBetaLifecycleWithAuthority(
      config({ signatureId: "forged-but-permissive-domain-accepted" }), permissiveAuthority,
    );
    expect(() => evaluateReleaseWindowWithAuthority(
      request(foreignLifecycle, "active-day-1", "ISSUE", "2026-08-01T00:00:00.000Z", "NOT_STARTED", false), authority,
    )).toThrow(/authority|domain|provenance|verifier/i);
  });

  it.each([
    ["start", "2026-08-01T00:00:00.000Z", true, "ACTIVE"],
    ["last millisecond", "2026-08-01T23:59:59.999Z", true, "ACTIVE"],
    ["day end", "2026-08-02T00:00:00.000Z", false, "ISSUANCE_CLOSED"],
    ["grace", "2026-08-02T00:00:00.000Z", false, "ISSUANCE_CLOSED"],
    ["grace last millisecond", "2026-08-02T00:59:59.999Z", false, "ISSUANCE_CLOSED"],
    ["grace end", "2026-08-02T01:00:00.000Z", false, "ISSUANCE_CLOSED"],
  ])("enforces Day 1 issuance at the half-open %s boundary", (_label, occurredAt, allowed, reason) => {
    const result = evaluateReleaseWindow(request(createUtcBetaLifecycle(config()), "active-day-1", "ISSUE", occurredAt, "NOT_STARTED", false));
    expect(result).toMatchObject({ allowed, reason, activeDayId: "active-day-1", attributedActiveDayId: "active-day-1" });
  });

  it("allows only already-issued incomplete sessions during grace and expires them at the boundary", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "RESUME", "2026-08-02T00:00:00.000Z")))
      .toMatchObject({ allowed: true, phase: "GRACE", attributedActiveDayId: "active-day-1" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "WRITE_EVENT", "2026-08-02T00:59:59.999Z")))
      .toMatchObject({ allowed: true, phase: "GRACE", attributedActiveDayId: "active-day-1" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "RESUME", "2026-08-02T00:30:00.000Z", "IN_PROGRESS", false)))
      .toMatchObject({ allowed: false, reason: "CREDENTIAL_NOT_ISSUED" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "WRITE_EVENT", "2026-08-02T01:00:00.000Z")))
      .toMatchObject({ allowed: false, reason: "SESSION_EXPIRED", resultingSessionStatus: "EXPIRED" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "WRITE_EVENT", "2026-08-02T01:00:00.001Z")))
      .toMatchObject({ allowed: false, reason: "SESSION_EXPIRED", resultingSessionStatus: "EXPIRED" });
  });

  it("rejects pre-Day-1 actions and allows issued active-period resume and writes", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "ISSUE", "2026-07-31T23:59:59.999Z", "NOT_STARTED", false)))
      .toMatchObject({ allowed: false, reason: "DAY_NOT_STARTED", phase: "BEFORE_BETA" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "RESUME", "2026-08-01T12:00:00.000Z")))
      .toMatchObject({ allowed: true, phase: "ACTIVE" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "WRITE_EVENT", "2026-08-01T12:00:00.000Z")))
      .toMatchObject({ allowed: true, phase: "ACTIVE", attributedActiveDayId: "active-day-1" });
  });

  it("keeps the prior-day grace and next-day issuance orthogonal during their overlap", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    const instant = "2026-08-02T00:30:00.000Z";
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "RESUME", instant)))
      .toMatchObject({ allowed: true, phase: "GRACE", attributedActiveDayId: "active-day-1" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-2", "ISSUE", instant, "NOT_STARTED", false)))
      .toMatchObject({ allowed: true, phase: "ACTIVE", attributedActiveDayId: "active-day-2" });
  });

  it("makes completed and expired sessions read-only without generating gate writes", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    for (const sessionStatus of ["COMPLETED", "EXPIRED", "WITHDRAWN"] as const) {
      expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "READ", "2026-08-02T00:30:00.000Z", sessionStatus)))
        .toMatchObject({ allowed: true, reason: "READ_ONLY", resultingSessionStatus: sessionStatus });
      for (const action of ["RESUME", "WRITE_EVENT"] as const) {
        expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", action, "2026-08-02T00:30:00.000Z", sessionStatus)))
          .toMatchObject({ allowed: false, reason: "READ_ONLY", resultingSessionStatus: sessionStatus });
      }
      expect(evaluateReleaseWindow(request(lifecycle, "active-day-1", "READ", "2026-08-03T12:00:00.000Z", sessionStatus)))
        .toMatchObject({ allowed: true, reason: "READ_ONLY", resultingSessionStatus: sessionStatus });
    }
  });

  it("freezes Day 7 at grace end and hard-blocks unresolved Day 8", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-7", "WRITE_EVENT", "2026-08-08T00:59:59.999Z")))
      .toMatchObject({ allowed: true, phase: "GRACE" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-7", "WRITE_EVENT", "2026-08-08T01:00:00.000Z")))
      .toMatchObject({ allowed: false, reason: "DAY7_FROZEN", resultingSessionStatus: "EXPIRED" });
    expect(evaluateReleaseWindow(request(lifecycle, "active-day-8", "ISSUE", "2026-08-09T12:00:00.000Z", "NOT_STARTED", false)))
      .toMatchObject({ allowed: false, reason: "DAY8_OPEN_DECISION_REQUIRED", phase: "PAUSED" });
  });

  it("uses only canonical server UTC and remains invariant across civil-clock change dates", () => {
    const spring = createUtcBetaLifecycle(config({ day1StartDate: "2026-03-28", signedAt: "2026-03-27T12:00:00.000Z" }));
    const autumn = createUtcBetaLifecycle(config({ day1StartDate: "2026-10-24", signedAt: "2026-10-23T12:00:00.000Z" }));
    expect(spring.initialWindows[1]).toMatchObject({ startsAt: "2026-03-29T00:00:00.000Z", endsAt: "2026-03-30T00:00:00.000Z" });
    expect(autumn.initialWindows[1]).toMatchObject({ startsAt: "2026-10-25T00:00:00.000Z", endsAt: "2026-10-26T00:00:00.000Z" });
    expect(() => evaluateReleaseWindow(request(spring, "active-day-1", "ISSUE", "2026-03-28T00:00:00+01:00", "NOT_STARTED", false))).toThrow(/canonical|UTC|instant/i);
    expect(() => evaluateReleaseWindow(request(spring, "active-day-1", "ISSUE", "2026-03-28T00:00:00.000Z", "NOT_STARTED", false, { deviceLocalTime: "2026-03-27T16:00:00-08:00" }))).toThrow(/field|shape|device|extra/i);
  });

  it.each([
    ["zero days", { activeDayIds: [] }],
    ["thirteen days", { activeDayIds: activeDayIds().slice(0, 13) }],
    ["duplicate days", { activeDayIds: [...activeDayIds().slice(0, 13), "active-day-1"] }],
    ["blank day", { activeDayIds: [...activeDayIds().slice(0, 13), " "] }],
    ["wrong grace", { graceMinutes: 59 }],
    ["non-Don approval", { signedBy: "Release Operator" }],
    ["blank signature", { signatureId: " " }],
    ["invalid date", { day1StartDate: "2026-02-30" }],
    ["signature after start", { signedAt: "2026-08-01T00:00:00.001Z" }],
  ])("rejects invalid lifecycle configuration: %s", (_label, overrides) => {
    expect(() => createUtcBetaLifecycle(config(overrides))).toThrow();
  });

  it.each(["lifecycleVersionId", "dayCalendarVersionId", "day1StartDate", "activeDayIds", "graceMinutes", "signedBy", "signatureId", "signedAt"])(
    "rejects missing, null and undefined lifecycle field %s",
    (field) => {
      const valid = config() as unknown as RecordValue;
      const missing = { ...valid }; delete missing[field];
      expect(() => createUtcBetaLifecycle(deepFreeze(missing))).toThrow();
      expect(() => createUtcBetaLifecycle(deepFreeze({ ...valid, [field]: null }))).toThrow();
      expect(() => createUtcBetaLifecycle(deepFreeze({ ...valid, [field]: undefined }))).toThrow();
    },
  );

  it("rejects mutable, extra, unknown-day and noncanonical release requests", () => {
    const mutable = { ...config(), activeDayIds: [...activeDayIds()] };
    expect(() => createUtcBetaLifecycle(mutable)).toThrow(/frozen|immutable|boundary/i);
    expect(() => createUtcBetaLifecycle(deepFreeze({ ...config(), extra: true }))).toThrow(/field|shape|extra/i);
    const lifecycle = createUtcBetaLifecycle(config());
    expect(() => evaluateReleaseWindow(request(lifecycle, "unknown", "ISSUE", "2026-08-01T00:00:00.000Z", "NOT_STARTED", false))).toThrow(/active day|unknown|identity/i);
    expect(() => evaluateReleaseWindow(deepFreeze({ ...request(lifecycle, "active-day-1", "ISSUE", "2026-08-01T00:00:00.000Z", "NOT_STARTED", false), extra: true }))).toThrow(/field|shape|extra/i);
    expect(() => evaluateReleaseWindow({ ...request(lifecycle, "active-day-1", "ISSUE", "2026-08-01T00:00:00.000Z", "NOT_STARTED", false) })).toThrow(/frozen|immutable|boundary/i);
  });

  it("requires an exact typed pre-Day-8 release-request envelope", () => {
    const lifecycle = createUtcBetaLifecycle(config());
    const valid = request(lifecycle, "active-day-1", "WRITE_EVENT", "2026-08-01T12:00:00.000Z") as unknown as RecordValue;
    for (const field of ["lifecycle", "activeDayId", "action", "occurredAt", "sessionStatus", "credentialIssued"]) {
      const missing = { ...valid }; delete missing[field];
      expect(() => evaluateReleaseWindow(deepFreeze(missing))).toThrow();
      expect(() => evaluateReleaseWindow(deepFreeze({ ...valid, [field]: null }))).toThrow();
      expect(() => evaluateReleaseWindow(deepFreeze({ ...valid, [field]: undefined }))).toThrow();
    }
    for (const changed of [
      { ...valid, activeDayId: 1 },
      { ...valid, action: "DELETE" },
      { ...valid, occurredAt: "not-an-instant" },
      { ...valid, occurredAt: "2026-08-01T12:00:00+01:00" },
      { ...valid, sessionStatus: "ANSWERED" },
      { ...valid, credentialIssued: "true" },
    ]) expect(() => evaluateReleaseWindow(deepFreeze(changed))).toThrow(/field|action|status|boolean|UTC|instant|request/i);
  });
});
