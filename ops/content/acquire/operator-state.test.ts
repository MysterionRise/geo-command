import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  authorizeOperatorRun,
  canonicalSha256,
  READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
} from "@codeguessr/content/operator/acquisition";
import { OperatorStateError, prepareOperatorState } from "./operator-state";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const receiptTime = "2026-07-27T20:00:00Z";
const operatorRun = () => {
  const entry = {
    entryId: "operator-entry",
    operatorName: "Operator",
    osIdentity: "uid:1",
    repositories: ["owner/repo"],
    purposes: ["LANGUAGE_CANDIDATE"],
    tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
    validFrom: receiptTime,
    approvals: [
      { role: "Release Operator", approverId: "release", approvedAt: receiptTime },
      { role: "Security Reviewer", approverId: "security", approvedAt: receiptTime },
    ],
  } as const;
  const register = { registerVersion: "operators-v1", entries: [entry] };
  return authorizeOperatorRun({
    register,
    binding: {
      registerVersion: register.registerVersion,
      registerHash: canonicalSha256(register),
      entryId: entry.entryId,
    },
    operatorName: "Operator",
    osIdentity: "uid:1",
    repository: "owner/repo",
    commit: "a".repeat(40),
    subtree: "src",
    purpose: "LANGUAGE_CANDIDATE",
    tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
    callerObservationTime: receiptTime,
    authoritativeReceiptTime: receiptTime,
    githubDate: "Mon, 27 Jul 2026 20:00:00 GMT",
  });
};
const environment = (root: string, key = randomBytes(32)) => ({
  CODEGUESSR_ACQUISITION_ROOT: root,
  CODEGUESSR_ACQUISITION_KEY_BASE64: key.toString("base64"),
  CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION: "APPROVED_ENCRYPTED_VOLUME",
  CODEGUESSR_ACQUISITION_OWNERSHIP_ATTESTATION: "ACQUISITION_OWNED",
});

describe("operator external state preflight", () => {
  it("fails closed for missing, relative, in-repository, or unattested state", async () => {
    for (const input of [
      {},
      environment("relative"),
      environment(join(process.cwd(), "state")),
      { ...environment("/tmp/missing"), CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION: "CLAIMED" },
    ]) {
      const error = await prepareOperatorState(input).catch((failure) => failure);
      expect(error).toBeInstanceOf(OperatorStateError);
      expect(error.message).toBe("OPERATOR_STATE_REJECTED");
    }
  });

  it("opens the real encrypted store and audit sink exactly once", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "codeguessr-operator-state-")),
    );
    await chmod(root, 0o700);
    try {
      const prepared = await prepareOperatorState(environment(root));
      const state = await prepared.open(operatorRun());
      const plaintext = new TextEncoder().encode("verified source");
      const objectId = createHash("sha256").update(plaintext).digest("hex");
      const receipt = await state.store.put({
        identity: {
          objectId,
          plaintextSha256: objectId,
          byteLength: plaintext.byteLength,
        },
        plaintext,
      });
      expect(receipt.created).toBe(true);
      await expect(prepared.open(operatorRun())).rejects.toThrow("OPERATOR_STATE_REJECTED");
      prepared.dispose();
      await expect(prepared.open(operatorRun())).rejects.toThrow("OPERATOR_STATE_REJECTED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("opens resume storage once and permits re-bound audit sinks until disposal", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "codeguessr-operator-state-")),
    );
    await chmod(root, 0o700);
    try {
      const prepared = await prepareOperatorState(environment(root));
      const store = await prepared.openStore();
      const plaintext = new TextEncoder().encode("pause metadata");
      const objectId = createHash("sha256").update(plaintext).digest("hex");
      const identity = { objectId, plaintextSha256: objectId, byteLength: plaintext.byteLength };
      await store.put({ identity, plaintext });
      expect(await store.read(identity)).toEqual(plaintext);
      await expect(prepared.openStore()).rejects.toThrow("OPERATOR_STATE_REJECTED");
      await expect(prepared.open(operatorRun())).rejects.toThrow("OPERATOR_STATE_REJECTED");
      expect(await prepared.openAudit(operatorRun())).toBeDefined();
      expect(await prepared.openAudit(operatorRun())).toBeDefined();
      prepared.dispose();
      await expect(prepared.openAudit(operatorRun())).rejects
        .toThrow("OPERATOR_STATE_REJECTED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed child state during preflight and can dispose before opening", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "codeguessr-operator-state-")),
    );
    await chmod(root, 0o700);
    try {
      await writeFile(join(root, "snapshots"), "not a directory");
      await expect(prepareOperatorState(environment(root)))
        .rejects.toThrow("OPERATOR_STATE_REJECTED");
      await rm(join(root, "snapshots"));
      const prepared = await prepareOperatorState(environment(root));
      prepared.dispose();
      await expect(prepared.open(operatorRun())).rejects.toThrow("OPERATOR_STATE_REJECTED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
