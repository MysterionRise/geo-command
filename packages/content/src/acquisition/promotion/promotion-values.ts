export const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
};

export const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
};

export const PROMOTION_RIGHTS = Object.freeze({
  fileCoverageDecision: "APPROVED_FILE_COVERAGE",
  noticeDecision: "APPROVED_NOTICE",
  redistributionDecision: "APPROVED_EXCERPT_REDISTRIBUTION",
  attributionTimingDecision: "APPROVED_REVEAL_ONLY",
  embeddedThirdPartyVendorAssessment:
    "APPROVED_NO_UNRESOLVED_EMBEDDED_THIRD_PARTY_VENDOR_MATERIAL",
  presentationDesignApproval:
    "APPROVED_DELAYED_ATTRIBUTION_PRESENTATION",
});
