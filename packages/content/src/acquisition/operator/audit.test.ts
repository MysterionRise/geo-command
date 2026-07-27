import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendAuditEvent, AuditError, openAuditSink } from "./audit";
import {
  authorizeOperatorRun,
  READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
} from "../policy/operator-authorization";
import { canonicalSha256 } from "../policy/policy-register";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const h64 = "b".repeat(64);
const operatorEntry = {
  entryId: "entry", operatorName: "Operator", osIdentity: "uid:1",
  repositories: ["owner/repo"], purposes: ["LANGUAGE_CANDIDATE"],
  tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
  validFrom: "2026-01-01T00:00:00Z",
  validThrough: "2026-01-01T00:00:10Z",
  approvals: [
    { role: "Release Operator", approverId: "release", approvedAt: "2026-01-01T00:00:00Z" },
    { role: "Security Reviewer", approverId: "security", approvedAt: "2026-01-01T00:00:00Z" },
  ],
} as const;
const operatorRegister = { registerVersion: "v1", entries: [operatorEntry] };
const authorizedRun = authorizeOperatorRun({
  register: operatorRegister,
  binding: {
    registerVersion: operatorRegister.registerVersion,
    registerHash: canonicalSha256(operatorRegister),
    entryId: operatorEntry.entryId,
  },
  operatorName: "Operator", osIdentity: "uid:1", repository: "owner/repo",
  commit: "a".repeat(40), subtree: "src",
  purpose: "LANGUAGE_CANDIDATE", tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
  callerObservationTime: "2026-01-01T00:00:00Z",
  authoritativeReceiptTime: "2026-01-01T00:00:00Z",
  githubDate: "Thu, 01 Jan 2026 00:00:00 GMT",
});
const run = { ...authorizedRun, runId: h64 } as const;
const types = [
  "RUN_STARTED", "RUN_RESUMED", "RUN_REJECTED", "RUN_PAUSED", "RAW_OBJECT_CREATED",
  "RAW_OBJECT_DELETED", "DRAFT_COMPLETED", "REVIEW_TRANSITION", "PROMOTION_HANDOFF",
] as const;

describe("metadata audit chain", () => {
  it("appends every exact event type and returns frozen hashed copies", () => {
    let chain: readonly any[] = [];
    types.forEach((eventType, index) => {
      chain = appendAuditEvent(chain, {
        eventType, eventTime: `2026-01-01T00:00:0${index}Z`,
        eventIdentity: index.toString(16).padStart(64, "0"),
        subjectHash: h64, reasonCode: "AUTHORIZED_EVENT", run,
      });
    });
    expect(chain.length).toBe(types.length);
    expect(Object.isFrozen(chain)).toBe(true);
    expect(Object.isFrozen(chain[0].run)).toBe(true);
    expect("update" in chain).toBe(false);
  });

  it("rejects tamper, duplicates, unknown fields, raw canaries and caller hashes", () => {
    const event = {
      eventType: "RUN_STARTED", eventTime: "2026-01-01T00:00:00Z",
      eventIdentity: "1".repeat(64), subjectHash: h64, reasonCode: "RUN_AUTHORIZED", run,
    } as const;
    const chain = appendAuditEvent([], event);
    expect(() => appendAuditEvent(chain, event)).toThrow(AuditError);
    expect(() => appendAuditEvent([{ ...chain[0], reasonCode: "TAMPERED" }], {
      ...event, eventIdentity: "2".repeat(64),
    })).toThrow("CHAIN_INVALID");
    for (const forbidden of ["code", "path", "token", "secret", "plaintext", "payload", "email", "marker"]) {
      expect(() => appendAuditEvent([], { ...event, [forbidden]: "raw-canary" } as never)).toThrow();
    }
    expect(() => appendAuditEvent([], { ...event, sequence: 1 } as never)).toThrow();
    expect(() => appendAuditEvent([], {
      ...event, eventTime: "2025-12-31T23:59:59Z",
    })).toThrow();
    const later = appendAuditEvent([], { ...event, eventTime: "2026-01-01T00:00:02Z" });
    expect(() => appendAuditEvent(later, {
      ...event, eventIdentity: "2".repeat(64), eventTime: "2026-01-01T00:00:01Z",
    })).toThrow("EVENT_TIME_NONMONOTONIC");
    expect(() => appendAuditEvent([], {
      ...event, run: { ...run, githubDate: "Invalid Date" },
    })).toThrow(AuditError);
    expect(authorizedRun.authorizationValidThrough).toBe("2026-01-01T00:00:10Z");
    expect(() => appendAuditEvent([], {
      ...event,
      eventIdentity: "9".repeat(64),
      eventTime: "2026-01-01T00:00:11Z",
    })).toThrow("AUDIT_AUTHORIZATION_EXPIRED");
  });

  it("persists an exclusive external chain and validates reopen, modes, tamper and symlinks", async () => {
    const created = await mkdtemp(join(tmpdir(), "codeguessr-audit-owned-"));
    const root = await (await import("node:fs/promises")).realpath(created);
    try {
      const sink = await openAuditSink({
        root, ownershipAttestation: "ACQUISITION_OWNED", authorizedRun,
        projectOperatorRegisterHash: canonicalSha256(operatorRegister),
      });
      const event = {
        eventType: "RUN_STARTED", eventTime: "2026-01-01T00:00:00Z",
        eventIdentity: "3".repeat(64), subjectHash: h64, reasonCode: "RUN_AUTHORIZED", run,
      } as const;
      const results = await Promise.allSettled([
        sink.append(event),
        sink.append({ ...event, eventType: "RUN_PAUSED", eventIdentity: "4".repeat(64) }),
      ]);
      expect(results.filter(({ status }) => status === "fulfilled").length).toBe(1);
      expect(results.filter(({ status }) => status === "rejected").length).toBe(1);
      await expect(sink.append({
        ...event,
        eventIdentity: "5".repeat(64),
        run: { ...run, operatorName: "Forged Operator" },
      })).rejects.toThrow("AUDIT_AUTHORIZATION_REJECTED");
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      expect((await stat(join(root, "events"))).mode & 0o777).toBe(0o700);
      const files = await (await import("node:fs/promises")).readdir(join(root, "events"));
      const path = join(root, "events", files[0] as string);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      await expect((await openAuditSink({
        root, ownershipAttestation: "ACQUISITION_OWNED", authorizedRun,
        projectOperatorRegisterHash: canonicalSha256(operatorRegister),
      }))
        .read()).resolves.toHaveLength(1);
      await writeFile(path, `${await readFile(path, "utf8")} `);
      await expect(openAuditSink({
        root, ownershipAttestation: "ACQUISITION_OWNED", authorizedRun,
        projectOperatorRegisterHash: canonicalSha256(operatorRegister),
      }))
        .rejects.toThrow("AUDIT_CHAIN_INVALID");
      await rm(path);
      await symlink("/dev/null", path);
      const failure = await openAuditSink({
        root, ownershipAttestation: "ACQUISITION_OWNED", authorizedRun,
        projectOperatorRegisterHash: canonicalSha256(operatorRegister),
      }).catch((error) => error);
      expect(failure).toBeInstanceOf(AuditError);
      expect(failure.message.includes(root)).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects a structurally valid but unissued operator authorization", async () => {
    const created = await mkdtemp(join(tmpdir(), "codeguessr-audit-owned-"));
    const root = await (await import("node:fs/promises")).realpath(created);
    try {
      const forged = { ...authorizedRun };
      await expect(openAuditSink({
        root,
        ownershipAttestation: "ACQUISITION_OWNED",
        authorizedRun: forged as never,
        projectOperatorRegisterHash: canonicalSha256(operatorRegister),
      })).rejects.toThrow("AUDIT_AUTHORIZATION_REJECTED");
      await expect(openAuditSink({
        root,
        ownershipAttestation: "ACQUISITION_OWNED",
        authorizedRun,
        projectOperatorRegisterHash: "0".repeat(64),
      })).rejects.toThrow("AUDIT_AUTHORIZATION_REJECTED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
