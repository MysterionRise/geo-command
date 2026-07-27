import { describe, expect, it } from "vitest";
import { quarantineAffectedRound } from "../../../packages/domain/src/results/index.js";
import { createProviderInventory } from "../src/server/privacy/providers/providers.js";
import { providerSchedule } from "../../../ops/privacy/provider-schedule.js";
import {
  evaluateCachePurge,
  executeFreshDelivery,
} from "../src/server/operations/incidents/index.js";

type RecordValue = Record<string, unknown>;
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, canonical(nested)]));
};
const digest = (value: unknown): string => JSON.stringify(canonical(value));
const QUARANTINE_DOMAIN = "synthetic-quarantine-authority-domain-v1";
const quarantineSignature = (claim: Readonly<Record<string, unknown>>) => {
  const unsigned = { ...claim }; delete unsigned.signatureId;
  return `synthetic-quarantine-signature:${digest(unsigned)}`;
};

const freshnessEvidence = (overrides: RecordValue = {}) => deepFreeze({ evidenceId: "synthetic-freshness-evidence-1",
  scopeId: "manifest-service", controlVersionId: "revocation-control-v7", observedAt: "2026-08-03T12:00:00.000Z", ...overrides });
const deliveryInput = (overrides: RecordValue = {}) => deepFreeze({ action: "MANIFEST", scopeId: "manifest-service",
  expectedControlVersionId: "revocation-control-v7", applicableVersionId: "manifest-v3",
  freshnessEvidence: freshnessEvidence(), ...overrides });
const services = (now: string, verified = true) => {
  const calls: string[] = [];
  return { calls, value: Object.freeze({ clock: Object.freeze({ now: () => now }),
    freshness: Object.freeze({ verify: (_claim: Readonly<Record<string, unknown>>) => verified }),
    delivery: Object.freeze({ issueManifest: () => { calls.push("MANIFEST"); }, authorizeReveal: () => { calls.push("REVEAL"); } }),
  }) };
};

describe("revocation freshness and purge operations", () => {
  it("allows manifest and reveal only through the exact five-minute authoritative boundary", () => {
    const exact = services("2026-08-03T12:05:00.000Z");
    expect(executeFreshDelivery(deliveryInput(), exact.value)).toEqual({ allowed: true, action: "MANIFEST",
      scopeId: "manifest-service", controlVersionId: "revocation-control-v7", applicableVersionId: "manifest-v3",
      freshnessAgeMilliseconds: 300_000 });
    expect(exact.calls).toEqual(["MANIFEST"]);
    const reveal = services("2026-08-03T12:04:59.999Z");
    expect(executeFreshDelivery(deliveryInput({ action: "REVEAL", scopeId: "reveal-service", applicableVersionId: "reveal-v2",
      freshnessEvidence: freshnessEvidence({ scopeId: "reveal-service" }) }), reveal.value)).toMatchObject({ allowed: true, action: "REVEAL" });
    expect(reveal.calls).toEqual(["REVEAL"]);
  });

  it("fails stale, future, mismatched or unverifiable evidence before calling a protected delivery port", () => {
    for (const [input, now, verified, reason] of [
      [deliveryInput(), "2026-08-03T12:05:00.001Z", true, "STALE_CONTROL"],
      [deliveryInput(), "2026-08-03T11:59:59.999Z", true, "FUTURE_EVIDENCE"],
      [deliveryInput({ freshnessEvidence: freshnessEvidence({ scopeId: "other-scope" }) }), "2026-08-03T12:01:00.000Z", true, "SCOPE_MISMATCH"],
      [deliveryInput({ freshnessEvidence: freshnessEvidence({ controlVersionId: "old-control" }) }), "2026-08-03T12:01:00.000Z", true, "VERSION_MISMATCH"],
      [deliveryInput(), "2026-08-03T12:01:00.000Z", false, "UNVERIFIED_EVIDENCE"],
    ] as const) {
      const target = services(now, verified);
      expect(executeFreshDelivery(input, target.value)).toMatchObject({ allowed: false, reason });
      expect(target.calls).toEqual([]);
    }
    const target = services("2026-08-03T12:01:00.000Z");
    expect(() => executeFreshDelivery({ ...deliveryInput() }, target.value)).toThrow(/frozen|immutable/i);
    expect(target.calls).toEqual([]);
  });

  it("verifies scoped cache purge at five minutes and never claims recall of displayed content", () => {
    const quarantine = quarantineAffectedRound({ affectedRoundId: "round-1", affectedManifestVersionId: "manifest-v1",
      replacementManifestVersionId: "manifest-v2", quarantinedAt: "2026-08-03T12:00:00.000Z",
      contentCachePurgedAt: "2026-08-03T12:05:00.000Z", displayed: true, correction: "CONTENT_WITHDRAWN" });
    expect(quarantine).toMatchObject({ contentBlocked: true, revealBlocked: true, affectedManifestEligibleForNewIssuance: false,
      existingCredential: { revoked: false, allowedTransitions: ["CORRECTION_NOTICE", "UNAFFECTED_ROUND", "UNAFFECTED_REVEAL"] },
      displayedContentTreatment: "ALREADY_DISPLAYED_NOT_RECALLABLE", publishedNotice: { text: "Content unavailable" } });
    const unsignedQuarantineAttestation = { attestationId: "synthetic-quarantine-attestation-1",
      authorityDomainId: QUARANTINE_DOMAIN, payloadDigest: digest(quarantine) };
    const quarantineAttestation = Object.freeze({ ...unsignedQuarantineAttestation,
      signatureId: quarantineSignature(unsignedQuarantineAttestation) });
    const input = (overrides: RecordValue = {}) => deepFreeze({ quarantine, affectedScopeId: "round-1",
      correctionVersionId: "correction-v4", quarantineAttestation,
      purgeEvidence: { evidenceId: "synthetic-purge-1", affectedScopeId: "round-1",
        affectedManifestVersionId: "manifest-v1", correctionVersionId: "correction-v4", purgedAt: "2026-08-03T12:05:00.000Z" }, ...overrides });
    const port = (now: string, verified = true, quarantineVerified = true) => Object.freeze({
      clock: Object.freeze({ now: () => now }), purgeEvidence: Object.freeze({ verify: () => verified }),
      quarantine: Object.freeze({ trustDomainId: QUARANTINE_DOMAIN,
        verify: (claim: Readonly<Record<string, unknown>>) => quarantineVerified &&
          claim.authorityDomainId === QUARANTINE_DOMAIN && claim.signatureId === quarantineSignature(claim) }),
    });
    expect(evaluateCachePurge(input(), port("2026-08-03T12:05:00.000Z"))).toEqual({ status: "PASS",
      purgedWithinFiveMinutes: true, affectedManifestVersionId: "manifest-v1", correctionVersionId: "correction-v4",
      displayedContentTreatment: "ALREADY_DISPLAYED_NOT_RECALLABLE", recallClaim: "NOT_MADE" });
    for (const [changed, now] of [
      [input({ purgeEvidence: { ...input().purgeEvidence as RecordValue, purgedAt: "2026-08-03T12:05:00.001Z" } }), "2026-08-03T12:05:00.001Z"],
      [input({ purgeEvidence: { ...input().purgeEvidence as RecordValue, purgedAt: "2026-08-03T12:06:00.000Z" } }), "2026-08-03T12:05:00.000Z"],
      [input({ purgeEvidence: { ...input().purgeEvidence as RecordValue, affectedScopeId: "other-round" } }), "2026-08-03T12:05:00.000Z"],
      [input({ purgeEvidence: { ...input().purgeEvidence as RecordValue, correctionVersionId: "other-correction" } }), "2026-08-03T12:05:00.000Z"],
    ] as const) expect(evaluateCachePurge(changed, port(now))).toMatchObject({ status: "FAIL", purgedWithinFiveMinutes: false });
    expect(evaluateCachePurge(input(), port("2026-08-03T12:05:00.000Z", false))).toMatchObject({ status: "FAIL" });
    for (const forgedQuarantine of [
      { ...quarantine, cachePurgedWithinDeadline: false },
      { ...quarantine, cachePurgeDeadline: "2026-08-03T12:10:00.000Z" },
      { ...quarantine, existingCredential: { ...quarantine.existingCredential, revoked: true } },
      { ...quarantine, publishedNotice: { kind: "CONTENT_WITHDRAWN", text: "Content recalled" } },
    ]) expect(evaluateCachePurge(input({ quarantine: deepFreeze(forgedQuarantine) }),
      port("2026-08-03T12:05:00.000Z"))).toMatchObject({ status: "FAIL", purgedWithinFiveMinutes: false });
    expect(evaluateCachePurge(input(), port("2026-08-03T12:05:00.000Z", true, false)))
      .toMatchObject({ status: "FAIL", purgedWithinFiveMinutes: false });
  });

  it("keeps the real provider schedule operationally blocked despite synthetic technical ports", () => {
    const inventory = createProviderInventory(providerSchedule);
    expect(inventory.blockers).toHaveLength(7);
    expect(inventory.deploymentDecision()).toEqual({ deployment: "BLOCKED", processing: "BLOCKED",
      status: "BLOCKED_PENDING_DON_PROVIDER_SCHEDULE" });
  });
});
