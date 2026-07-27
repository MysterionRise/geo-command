import { createHash } from "node:crypto";
import { LicenseEvidenceError, screenLicenseEvidence } from "./license-evidence";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as {
  describe(name: string, callback: () => unknown): void;
  expect(actual: unknown): { toBe(value: unknown): void; toBeInstanceOf(value: unknown): void; toEqual(value: unknown): void; toThrow(value?: unknown): void };
  it(name: string, callback: () => unknown): void;
};
const bytes = new TextEncoder().encode("MIT License\nfixture");
const blobSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const textHash = createHash("sha256").update(bytes).digest("hex");
const base = {
  identifier: "MIT",
  metadataIdentifiers: ["MIT"],
  licenseFilePresent: true,
  licensePath: "LICENSE",
  licenseBlobSha: blobSha,
  licenseTextSha256: textHash,
  licenseBytes: bytes,
  repositoryPolicyVersion: "repository-v1",
  repositoryPolicyHash: "a".repeat(64),
} as const;

describe("license admission evidence", () => {
  it("accepts exactly the narrow identifier allowlist", () => {
    for (const identifier of ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]) {
      expect(screenLicenseEvidence({
        ...base,
        identifier,
        metadataIdentifiers: [identifier],
      }).decision).toBe("ADMISSION_SCREENING_ONLY");
    }
  });

  it("rejects missing, NOASSERTION, custom, copyleft, unlisted, and conflicting identifiers", () => {
    for (const identifier of [undefined, "", "NOASSERTION", "LicenseRef-Custom", "GPL-3.0-only", "MPL-2.0"]) {
      expect(() => screenLicenseEvidence({ ...base, identifier } as never))
        .toThrow("LICENSE_IDENTIFIER_REJECTED");
    }
    expect(() => screenLicenseEvidence({
      ...base,
      metadataIdentifiers: ["MIT", "Apache-2.0"],
    })).toThrow("LICENSE_CONFLICT");
  });

  it("rejects absent-at-commit and unsafe license paths", () => {
    expect(() => screenLicenseEvidence({ ...base, licenseFilePresent: false }))
      .toThrow("LICENSE_ABSENT");
    for (const licensePath of [
      "./LICENSE", "licenses/./MIT", "licenses//MIT", "licenses/MIT/",
      "../LICENSE", "licenses/../MIT", "LICENSE..txt", "/LICENSE",
      "docs\\LICENSE", "C:\\LICENSE",
    ]) {
      expect(() => screenLicenseEvidence({ ...base, licensePath })).toThrow("LICENSE_PATH_REJECTED");
    }
  });

  it("rejects invalid UTF-8 and NUL-bearing license bytes", () => {
    for (const licenseBytes of [new Uint8Array([0xff]), new Uint8Array([77, 73, 84, 0])]) {
      const licenseBlobSha = createHash("sha1")
        .update(`blob ${licenseBytes.length}\0`).update(licenseBytes).digest("hex");
      const licenseTextSha256 = createHash("sha256").update(licenseBytes).digest("hex");
      expect(() => screenLicenseEvidence({
        ...base,
        licenseBytes,
        licenseBlobSha,
        licenseTextSha256,
      })).toThrow("LICENSE_TEXT_INVALID");
    }
  });

  it("accepts exactly 256 KiB and rejects larger or empty license text", () => {
    const inputFor = (licenseBytes: Uint8Array) => ({
      ...base,
      licenseBytes,
      licenseBlobSha: createHash("sha1")
        .update(`blob ${licenseBytes.length}\0`).update(licenseBytes).digest("hex"),
      licenseTextSha256: createHash("sha256").update(licenseBytes).digest("hex"),
    });
    expect(screenLicenseEvidence(inputFor(new Uint8Array(256 * 1024).fill(97))).decision)
      .toBe("ADMISSION_SCREENING_ONLY");
    expect(() => screenLicenseEvidence(inputFor(new Uint8Array(256 * 1024 + 1).fill(97))))
      .toThrow("LICENSE_SIZE_LIMIT");
    expect(() => screenLicenseEvidence(inputFor(new Uint8Array())))
      .toThrow("LICENSE_TEXT_INVALID");
  });

  it("recomputes and verifies Git blob and license text hashes", () => {
    expect(() => screenLicenseEvidence({ ...base, licenseBlobSha: "bad" }))
      .toThrow("LICENSE_BLOB_MISMATCH");
    expect(() => screenLicenseEvidence({ ...base, licenseBlobSha: "b".repeat(40) }))
      .toThrow("LICENSE_BLOB_MISMATCH");
    expect(() => screenLicenseEvidence({ ...base, licenseTextSha256: "b".repeat(64) }))
      .toThrow("LICENSE_TEXT_MISMATCH");
  });

  it("requires exact repository-policy version and hash", () => {
    expect(() => screenLicenseEvidence({ ...base, repositoryPolicyVersion: "" }))
      .toThrow("POLICY_BINDING_REJECTED");
    expect(() => screenLicenseEvidence({ ...base, repositoryPolicyHash: "bad" }))
      .toThrow("POLICY_BINDING_REJECTED");
  });

  it("returns immutable screening only with no rights decisions or approvals", () => {
    const result = screenLicenseEvidence(base);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).sort()).toEqual([
      "decision", "identifier", "licenseBlobSha", "licensePath", "licenseTextSha256",
      "repositoryPolicyHash", "repositoryPolicyVersion",
    ]);
  });

  it("uses a non-sensitive categorical error", () => {
    try {
      screenLicenseEvidence({ ...base, licenseBytes: new TextEncoder().encode("raw-canary") });
    } catch (error) {
      expect(error).toBeInstanceOf(LicenseEvidenceError);
      expect((error as Error).message).toBe("LICENSE_BLOB_MISMATCH");
    }
  });
});
