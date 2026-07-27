import type { PromotionReceipt } from "./promotion-types";
import { deepFreeze } from "./promotion-values";

const FIELDS = [
  "status", "promotionIdentifier", "mode", "sourceClass", "purpose",
  "draftHash", "catalogueHash", "roundId", "roundVersionId",
  "contentStableId", "contentHash", "contentVersionId", "evidenceVersionId",
] as const;
const SHA256 = /^[0-9a-f]{64}$/u;

const fail = (message: string): never => {
  throw new TypeError(`promotion receipt ${message}`);
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be non-blank`);
  }
  return value.trim();
};

export function parsePromotionReceipt(value: unknown): PromotionReceipt {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail("must be an object");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join("|") !== [...FIELDS].sort().join("|")) {
    fail("has an invalid shape");
  }
  if (input.status !== "PROMOTED_H001"
    || (input.mode !== "language" && input.mode !== "provenance")
    || input.sourceClass !== "licensed-github"
    || (input.purpose !== "LANGUAGE_CANDIDATE"
      && input.purpose !== "RECORDED_AGENT_PARTICIPATION_CANDIDATE")) {
    fail("has invalid immutable semantics");
  }
  for (const field of ["draftHash", "catalogueHash", "contentHash"] as const) {
    if (!SHA256.test(text(input[field], field))) fail(`${field} must be SHA-256`);
  }
  return deepFreeze(Object.fromEntries(FIELDS.map((field) => [
    field,
    text(input[field], field),
  ])) as unknown as PromotionReceipt);
}
