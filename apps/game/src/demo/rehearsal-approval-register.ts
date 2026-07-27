import { createHash } from "node:crypto";

export type RehearsalApprovalRegisterEntry = Readonly<{
  approvalId: string;
  artifactId: string;
  artifactHash: string;
  decision: "APPROVED_NON_PUBLIC_REHEARSAL";
  languagePromotionIdentifier: string;
  provenancePromotionIdentifier: string;
  languageCatalogueHash: string;
  provenanceCatalogueHash: string;
}>;

export type RehearsalApprovalRegister = Readonly<{
  versionId: string;
  entries: readonly RehearsalApprovalRegisterEntry[];
  registerHash: string;
}>;

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) =>
      `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
};

const hash = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");

export const hashRehearsalApprovalArtifact = (
  value: Readonly<Record<string, unknown>>,
): string => hash(value);

export const hashRehearsalApprovalRegister = (
  versionId: string,
  entries: readonly RehearsalApprovalRegisterEntry[],
): string => hash({ versionId, entries });

const versionId = "non-public-rehearsal-register-v1";
const entries = Object.freeze([]) as readonly RehearsalApprovalRegisterEntry[];

export const ACTIVE_REHEARSAL_APPROVAL_REGISTER: RehearsalApprovalRegister =
  Object.freeze({
    versionId,
    entries,
    registerHash: hashRehearsalApprovalRegister(versionId, entries),
  });
