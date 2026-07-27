import type { ProviderCategory, ProviderInventoryInput } from "../../apps/game/src/server/privacy/providers/providers.js";

const categories: readonly ProviderCategory[] = ["STORE", "LOG", "BACKUP", "EXPORT", "SUPPORT_SYSTEM", "OPERATOR_COPY", "SUBPROCESSOR"];
export const providerSchedule: ProviderInventoryInput = Object.freeze({
  dataFlowRegister: Object.freeze({
    versionId: "data-flow-provider-schedule-pending-v1",
    nodes: Object.freeze(categories.map((category) => Object.freeze({ entryId: category.toLowerCase(), category, usage: "UNRESOLVED" as const, fields: Object.freeze([]), processingBasisApplicable: true, retention: Object.freeze({ signedBy: "UNRESOLVED", ceilingDays: 0 }), backup: Object.freeze({ signedBy: "UNRESOLVED", ceilingDays: 0 }), blocker: "Named provider, guarantees, and durable approval evidence are not yet available" }))),
  }),
  providerInventoryVersionId: "provider-inventory-pending-v1",
  entries: Object.freeze([]),
});
