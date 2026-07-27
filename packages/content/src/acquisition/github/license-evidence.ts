import { createHash } from "node:crypto";

const ALLOWED = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]);
const GIT_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_PATH_CHARACTERS = /^[A-Za-z0-9._/-]+$/u;

interface LicenseInput {
  readonly identifier: string;
  readonly metadataIdentifiers: readonly string[];
  readonly licenseFilePresent: boolean;
  readonly licensePath: string;
  readonly licenseBlobSha: string;
  readonly licenseTextSha256: string;
  readonly licenseBytes: Uint8Array;
  readonly repositoryPolicyVersion: string;
  readonly repositoryPolicyHash: string;
}
export interface LicenseAdmissionEvidence {
  readonly decision: "ADMISSION_SCREENING_ONLY";
  readonly identifier: string;
  readonly licensePath: string;
  readonly licenseBlobSha: string;
  readonly licenseTextSha256: string;
  readonly repositoryPolicyVersion: string;
  readonly repositoryPolicyHash: string;
}
export class LicenseEvidenceError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "LicenseEvidenceError";
  }
}
const fail = (code: string): never => {
  throw new LicenseEvidenceError(code);
};

const validateLicensePath = (path: unknown): void => {
  if (
    typeof path !== "string" || !SAFE_PATH_CHARACTERS.test(path)
    || path.startsWith("/") || path.endsWith("/") || path.includes("\\")
    || path.includes("..")
    || path.split("/").some((segment) => segment === "" || segment === ".")
  ) fail("LICENSE_PATH_REJECTED");
};

const validateLicenseBytes = (input: LicenseInput): void => {
  if (!(input.licenseBytes instanceof Uint8Array)) fail("LICENSE_BLOB_MISMATCH");
  if (input.licenseBytes.byteLength === 0) fail("LICENSE_TEXT_INVALID");
  if (input.licenseBytes.byteLength > 256 * 1024) fail("LICENSE_SIZE_LIMIT");
  if (input.licenseBytes.includes(0)) fail("LICENSE_TEXT_INVALID");
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(input.licenseBytes);
  } catch {
    return fail("LICENSE_TEXT_INVALID");
  }
  const blobSha = createHash("sha1")
    .update(`blob ${input.licenseBytes.byteLength}\0`).update(input.licenseBytes).digest("hex");
  if (!GIT_SHA.test(input.licenseBlobSha) || input.licenseBlobSha !== blobSha) {
    fail("LICENSE_BLOB_MISMATCH");
  }
  const textHash = createHash("sha256").update(input.licenseBytes).digest("hex");
  if (!SHA256.test(input.licenseTextSha256) || input.licenseTextSha256 !== textHash) {
    fail("LICENSE_TEXT_MISMATCH");
  }
};

export const screenLicenseEvidence = (input: LicenseInput): LicenseAdmissionEvidence => {
  if (typeof input.identifier !== "string" || !ALLOWED.has(input.identifier)) {
    fail("LICENSE_IDENTIFIER_REJECTED");
  }
  if (
    !Array.isArray(input.metadataIdentifiers)
    || input.metadataIdentifiers.length !== 1
    || input.metadataIdentifiers[0] !== input.identifier
  ) fail("LICENSE_CONFLICT");
  if (input.licenseFilePresent !== true) fail("LICENSE_ABSENT");
  validateLicensePath(input.licensePath);
  if (
    typeof input.repositoryPolicyVersion !== "string"
    || input.repositoryPolicyVersion.length === 0
    || typeof input.repositoryPolicyHash !== "string"
    || !SHA256.test(input.repositoryPolicyHash)
  ) fail("POLICY_BINDING_REJECTED");
  validateLicenseBytes(input);
  return Object.freeze({
    decision: "ADMISSION_SCREENING_ONLY",
    identifier: input.identifier,
    licensePath: input.licensePath,
    licenseBlobSha: input.licenseBlobSha,
    licenseTextSha256: input.licenseTextSha256,
    repositoryPolicyVersion: input.repositoryPolicyVersion,
    repositoryPolicyHash: input.repositoryPolicyHash,
  });
};
