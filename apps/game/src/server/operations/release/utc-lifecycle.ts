import {
  asRecord,
  assertDeepFrozen,
  boolean,
  canonicalInstant,
  exact,
  fail,
  isAuthorization,
  registerLifecycle,
  requireAuthority,
  requireLifecycle,
  text,
  utcDate,
  verifyApproval,
  type ActiveDayWindow,
  type AllowedDay8Authorization,
  type AuthorityVerifier,
  type Day8Authorization,
  type UtcBetaLifecycle,
} from "./types.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const isoAt = (timestamp: number): string => new Date(timestamp).toISOString();

const makeWindow = (activeDayId: string, ordinal: number, startsAt: number): ActiveDayWindow => Object.freeze({
  activeDayId,
  ordinal,
  startsAt: isoAt(startsAt),
  endsAt: isoAt(startsAt + DAY_MS),
  graceEndsAt: isoAt(startsAt + DAY_MS + HOUR_MS),
});

export const createUtcBetaLifecycle = (value: unknown, authorityInput: unknown): UtcBetaLifecycle => {
  const authority = requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const raw = asRecord(value, "UTC lifecycle configuration");
  exact(raw, ["lifecycleVersionId", "dayCalendarVersionId", "day1StartDate", "activeDayIds", "graceMinutes", "signedBy", "signatureId", "signedAt"], "UTC lifecycle configuration");
  const lifecycleVersionId = text(raw.lifecycleVersionId, "Lifecycle version");
  const dayCalendarVersionId = text(raw.dayCalendarVersionId, "Day-calendar version");
  const day1StartDate = utcDate(raw.day1StartDate, "Day 1 start date");
  if (!Array.isArray(raw.activeDayIds) || raw.activeDayIds.length !== 14) fail("Exactly fourteen active-day identities are required");
  const activeDayIds = raw.activeDayIds.map((entry) => text(entry, "Active-day identity"));
  if (new Set(activeDayIds).size !== 14) fail("Active-day identities must be distinct");
  if (raw.graceMinutes !== 60) fail("Grace duration must equal sixty minutes");
  if (raw.signedBy !== "Don") fail("Day calendar requires Don signature");
  const signatureId = text(raw.signatureId, "Day-calendar signature");
  const signedAt = canonicalInstant(raw.signedAt, "Day-calendar signature time");
  const day1Start = Date.parse(`${day1StartDate}T00:00:00.000Z`);
  if (Date.parse(signedAt) > day1Start) fail("Day calendar must be signed no later than Day 1 start");
  const unsignedConfiguration = Object.freeze({ lifecycleVersionId, dayCalendarVersionId, day1StartDate,
    activeDayIds: Object.freeze([...activeDayIds]), graceMinutes: 60, signedBy: "Don", signedAt });
  if (!verifyApproval(authority, "UTC_LIFECYCLE", "Don", "DON", signedAt, signatureId, unsignedConfiguration)) {
    fail("Day-calendar signature authority verification failed");
  }
  const initialWindows = Object.freeze(activeDayIds.slice(0, 7).map((activeDayId, index) => makeWindow(activeDayId, index + 1, day1Start + index * DAY_MS)));
  const lifecycle = Object.freeze({
    lifecycleVersionId,
    dayCalendarVersionId,
    day1StartDate,
    activeDayIds: Object.freeze([...activeDayIds]),
    graceMinutes: 60 as const,
    initialWindows,
    day7FreezeAt: initialWindows[6]!.graceEndsAt,
    day8Start: null,
  });
  return registerLifecycle(lifecycle, authority);
};

type Action = "ISSUE" | "RESUME" | "WRITE_EVENT" | "READ";
type SessionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "WITHDRAWN";

const action = (value: unknown): Action => {
  if (value !== "ISSUE" && value !== "RESUME" && value !== "WRITE_EVENT" && value !== "READ") fail("Release action is invalid");
  return value;
};

const sessionStatus = (value: unknown): SessionStatus => {
  if (value !== "NOT_STARTED" && value !== "IN_PROGRESS" && value !== "COMPLETED" && value !== "EXPIRED" && value !== "WITHDRAWN") fail("Session status is invalid");
  return value;
};

const secondHalfWindow = (lifecycle: UtcBetaLifecycle, authorization: AllowedDay8Authorization, ordinal: number): ActiveDayWindow =>
  makeWindow(lifecycle.activeDayIds[ordinal - 1]!, ordinal, Date.parse(authorization.day8Start) + (ordinal - 8) * DAY_MS);

const result = (input: Readonly<Record<string, unknown>>) => Object.freeze(input);

export const evaluateReleaseWindow = (value: unknown, authorityInput: unknown) => {
  const authority: AuthorityVerifier = requireAuthority(authorityInput);
  assertDeepFrozen(value);
  const raw = asRecord(value, "release-window request");
  const fields = Object.hasOwn(raw, "day8Authorization")
    ? ["lifecycle", "day8Authorization", "activeDayId", "action", "occurredAt", "sessionStatus", "credentialIssued"]
    : ["lifecycle", "activeDayId", "action", "occurredAt", "sessionStatus", "credentialIssued"];
  exact(raw, fields, "release-window request");
  const lifecycle = requireLifecycle(raw.lifecycle, authority);
  const activeDayId = text(raw.activeDayId, "Release request active-day identity");
  const ordinalIndex = lifecycle.activeDayIds.indexOf(activeDayId);
  if (ordinalIndex < 0) fail("Unknown active-day identity");
  const ordinal = ordinalIndex + 1;
  const requestedAction = action(raw.action);
  const occurredAt = canonicalInstant(raw.occurredAt, "Authoritative server UTC instant");
  const status = sessionStatus(raw.sessionStatus);
  const credentialIssued = boolean(raw.credentialIssued, "Credential-issued state");

  let authorization: Day8Authorization | undefined;
  if (Object.hasOwn(raw, "day8Authorization")) {
    if (!isAuthorization(raw.day8Authorization, authority)) fail("Day 8 authorization provenance is invalid");
    authorization = raw.day8Authorization;
  }
  if (ordinal >= 8) {
    if (authorization === undefined) {
      if (requestedAction !== "ISSUE") fail("Post-Day-8 request requires an authorization record");
      return result({ allowed: false, reason: "DAY8_OPEN_DECISION_REQUIRED", phase: "PAUSED", activeDayId, attributedActiveDayId: activeDayId });
    }
    if (!authorization.allowed) {
      return result({ allowed: false, reason: "DAY8_OPEN_DECISION_REQUIRED", phase: "PAUSED", activeDayId, attributedActiveDayId: activeDayId });
    }
    if (authorization.lifecycleVersionId !== lifecycle.lifecycleVersionId) fail("Day 8 authorization lifecycle binding is invalid");
  }

  const window = ordinal <= 7
    ? lifecycle.initialWindows[ordinal - 1]!
    : secondHalfWindow(lifecycle, authorization as AllowedDay8Authorization, ordinal);
  const at = Date.parse(occurredAt);
  const startsAt = Date.parse(window.startsAt);
  const endsAt = Date.parse(window.endsAt);
  const graceEndsAt = Date.parse(window.graceEndsAt);

  if (ordinal >= 8 && at < startsAt) {
    return result({ allowed: false, reason: ordinal === 8 ? "DAY8_NOT_STARTED" : "DAY_NOT_STARTED", phase: "PAUSED", activeDayId, attributedActiveDayId: activeDayId });
  }
  if (ordinal === 1 && at < startsAt) {
    return result({ allowed: false, reason: "DAY_NOT_STARTED", phase: "BEFORE_BETA", activeDayId, attributedActiveDayId: activeDayId });
  }

  const terminal = status === "COMPLETED" || status === "EXPIRED" || status === "WITHDRAWN";
  if (terminal) {
    return result({ allowed: requestedAction === "READ", reason: "READ_ONLY", phase: at < endsAt ? "ACTIVE" : at < graceEndsAt ? "GRACE" : "READ_ONLY",
      activeDayId, attributedActiveDayId: activeDayId, resultingSessionStatus: status });
  }

  if (at < startsAt) return result({ allowed: false, reason: "DAY_NOT_STARTED", phase: "NOT_STARTED", activeDayId, attributedActiveDayId: activeDayId });
  if (at < endsAt) {
    if (requestedAction !== "ISSUE" && !credentialIssued) return result({ allowed: false, reason: "CREDENTIAL_NOT_ISSUED", phase: "ACTIVE", activeDayId, attributedActiveDayId: activeDayId });
    return result({ allowed: true, reason: "ACTIVE", phase: "ACTIVE", activeDayId, attributedActiveDayId: activeDayId, resultingSessionStatus: status });
  }
  if (at < graceEndsAt) {
    if (requestedAction === "ISSUE") return result({ allowed: false, reason: "ISSUANCE_CLOSED", phase: "GRACE", activeDayId, attributedActiveDayId: activeDayId });
    if (!credentialIssued) return result({ allowed: false, reason: "CREDENTIAL_NOT_ISSUED", phase: "GRACE", activeDayId, attributedActiveDayId: activeDayId });
    return result({ allowed: true, reason: "GRACE", phase: "GRACE", activeDayId, attributedActiveDayId: activeDayId, resultingSessionStatus: status });
  }
  if (ordinal === 14 && requestedAction === "ISSUE") {
    return result({ allowed: false, reason: "BETA_ENDED", phase: "AFTER_BETA", activeDayId, attributedActiveDayId: activeDayId });
  }
  if (requestedAction === "ISSUE") return result({ allowed: false, reason: "ISSUANCE_CLOSED", phase: "CLOSED", activeDayId, attributedActiveDayId: activeDayId });
  return result({ allowed: false, reason: ordinal === 7 ? "DAY7_FROZEN" : "SESSION_EXPIRED", phase: ordinal === 7 ? "FROZEN" : "CLOSED",
    activeDayId, attributedActiveDayId: activeDayId, resultingSessionStatus: "EXPIRED" });
};

export type { UtcBetaLifecycle } from "./types.js";
