import type { RestoreLedger } from "../../content/vault/vault.js";

export class ProviderRuleError extends Error {
  public constructor(message: string, public readonly code = "RULE_DENIED") { super(message); this.name = "ProviderRuleError"; }
}

export type ProviderCategory = "STORE" | "LOG" | "BACKUP" | "EXPORT" | "SUPPORT_SYSTEM" | "OPERATOR_COPY" | "SUBPROCESSOR";
const CATEGORIES: readonly ProviderCategory[] = ["STORE", "LOG", "BACKUP", "EXPORT", "SUPPORT_SYSTEM", "OPERATOR_COPY", "SUBPROCESSOR"];
const USAGES: readonly DataFlowNode["usage"][] = ["USED", "NOT_USED", "UNRESOLVED"];
const FORBIDDEN = new Set(["rawCode", "prompt", "freeText", "ipFingerprint", "fullUserAgent", "secret", "recruitmentIdentity"]);
const required = (value: string, label: string) => { const text = value.trim(); if (!text) throw new ProviderRuleError(`${label} is required`); return text; };
const positiveDays = (value: number, label: string) => { if (!Number.isInteger(value) || value <= 0) throw new ProviderRuleError(`${label} must be a positive integer`); return value; };
const nonnegativeDays = (value: number, label: string) => { if (!Number.isInteger(value) || value < 0) throw new ProviderRuleError(`${label} must be a nonnegative integer`); return value; };
const uniqueFields = (fields: readonly string[]) => {
  if (!fields.length) throw new ProviderRuleError("Fields are required");
  const frozen = Object.freeze(fields.map((field) => required(field, "Field")));
  if (new Set(frozen).size !== frozen.length) throw new ProviderRuleError("Fields must be unique");
  if (frozen.some((field) => FORBIDDEN.has(field))) throw new ProviderRuleError("Forbidden telemetry field");
  return frozen;
};

interface SignedCeiling { readonly signedBy: string; readonly ceilingDays: number }
export interface DataFlowNode {
  readonly entryId: string; readonly category: ProviderCategory; readonly fields: readonly string[];
  readonly processingBasisApplicable: boolean; readonly retention: SignedCeiling; readonly backup: SignedCeiling;
  readonly usage: "USED" | "NOT_USED" | "UNRESOLVED";
  readonly providerIdentity?: string; readonly purpose?: string; readonly processingBasis?: string; readonly accessOwner?: string;
  readonly deletionCapability?: string; readonly propagationRule?: string; readonly restorationBehavior?: "SEALED_PENDING_RECONCILIATION";
  readonly approval?: { readonly approvalId: string; readonly approvalHash: string; readonly approvedAt: string; readonly approver: string };
  readonly decisionEvidence?: string; readonly decisionReason?: string; readonly blocker?: string;
  readonly decisionApproval?: { readonly approvalId: string; readonly approvalHash: string; readonly approvedAt: string; readonly approver: string };
}
export interface ProviderEntry {
  readonly entryId: string; readonly category: ProviderCategory; readonly approvedBy: string;
  readonly purpose: string; readonly processingBasis: string; readonly fields: readonly string[];
  readonly accessOwner: string; readonly retention: SignedCeiling; readonly deletionCapability: string;
  readonly propagationRule: string; readonly backupExpiryDays: number;
  readonly restorationBehavior: "SEALED_PENDING_RECONCILIATION";
  readonly actualGuarantees: { readonly retentionDays: number; readonly backupExpiryDays: number; readonly deletionSupported: boolean };
  readonly providerIdentity: string;
  readonly approval: { readonly approvalId: string; readonly approvalHash: string; readonly approvedAt: string; readonly approver: string };
}
export interface ProviderInventoryInput {
  readonly dataFlowRegister: { readonly versionId: string; readonly approvedBy?: string; readonly nodes: readonly DataFlowNode[] };
  readonly providerInventoryVersionId: string;
  readonly entries: readonly ProviderEntry[];
}

export const createProviderInventory = (input: ProviderInventoryInput) => {
  required(input.dataFlowRegister.versionId, "Data-flow register version");
  required(input.providerInventoryVersionId, "Provider inventory version");
  const nodeIds = input.dataFlowRegister.nodes.map(({ entryId }) => required(entryId, "Register entry ID"));
  const entryIds = input.entries.map(({ entryId }) => required(entryId, "Inventory entry ID"));
  if (new Set(nodeIds).size !== nodeIds.length || new Set(entryIds).size !== entryIds.length) throw new ProviderRuleError("Entry IDs must be unique");
  if (input.dataFlowRegister.nodes.some(({ usage }) => !USAGES.includes(usage))) throw new ProviderRuleError("Register usage is invalid");
  const usedIds = input.dataFlowRegister.nodes.filter(({ usage }) => usage === "USED").map(({ entryId }) => entryId);
  if (usedIds.length !== entryIds.length || usedIds.some((id) => !entryIds.includes(id))) throw new ProviderRuleError("Inventory IDs must exactly match USED register IDs");
  if (CATEGORIES.some((category) => !input.dataFlowRegister.nodes.some((node) => node.category === category)) || input.dataFlowRegister.nodes.some((node) => !CATEGORIES.includes(node.category))) throw new ProviderRuleError("Every provider category must be explicit");
  const nodes = input.dataFlowRegister.nodes.map((node) => {
    const fields = node.fields.length > 0 || node.usage === "USED" ? uniqueFields(node.fields) : Object.freeze([]);
    if (node.usage === "USED") {
      for (const value of [node.providerIdentity, node.purpose, node.accessOwner, node.deletionCapability, node.propagationRule]) required(value ?? "", "USED register value");
      if (node.processingBasisApplicable) required(node.processingBasis ?? "", "USED register processing basis");
      if (node.restorationBehavior !== "SEALED_PENDING_RECONCILIATION") throw new ProviderRuleError("USED restoration must be sealed");
      if (node.retention.signedBy.trim() !== "Don" || node.backup.signedBy.trim() !== "Don") throw new ProviderRuleError("Register ceilings require Don signature");
      positiveDays(node.retention.ceilingDays, "Register retention ceiling"); positiveDays(node.backup.ceilingDays, "Register backup ceiling");
      if (node.approval === undefined || node.approval.approver.trim() !== "Don") throw new ProviderRuleError("USED approval evidence is required");
      required(node.approval.approvalId, "Approval ID"); required(node.approval.approvalHash, "Approval hash");
      if (!Number.isFinite(Date.parse(node.approval.approvedAt))) throw new ProviderRuleError("Approval time is invalid");
    } else if (node.usage === "NOT_USED") {
      required(node.decisionEvidence ?? "", "Decision evidence"); required(node.decisionReason ?? "", "Decision reason");
      if (node.decisionApproval === undefined || node.decisionApproval.approver !== "Don") throw new ProviderRuleError("NOT_USED requires Don decision approval");
      required(node.decisionApproval.approvalId, "Decision approval ID"); required(node.decisionApproval.approvalHash, "Decision approval hash");
      if (!Number.isFinite(Date.parse(node.decisionApproval.approvedAt))) throw new ProviderRuleError("Decision approval time is invalid");
    }
    else required(node.blocker ?? "", "Unresolved blocker");
    return Object.freeze({
      ...node,
      entryId: node.entryId.trim(), fields,
      retention: Object.freeze({ ...node.retention }), backup: Object.freeze({ ...node.backup }),
      ...(node.approval === undefined ? {} : { approval: Object.freeze({ ...node.approval }) }),
      ...(node.decisionApproval === undefined ? {} : { decisionApproval: Object.freeze({ ...node.decisionApproval }) }),
    });
  });
  const entries = input.entries.map((entry) => {
    const node = nodes.find(({ entryId }) => entryId === entry.entryId);
    if (node === undefined) throw new ProviderRuleError("Unregistered provider entry");
    const fields = uniqueFields(entry.fields);
    if (entry.category !== node.category || fields.length !== node.fields.length || fields.some((field) => !node.fields.includes(field))) throw new ProviderRuleError("Inventory scope must match register");
    if (entry.approvedBy.trim() !== "Don") throw new ProviderRuleError("Provider entry requires Don approval");
    required(entry.purpose, "Purpose");
    if (node.processingBasisApplicable) required(entry.processingBasis, "Processing basis");
    required(entry.accessOwner, "Access owner");
    positiveDays(entry.retention.ceilingDays, "Inventory retention ceiling"); positiveDays(entry.backupExpiryDays, "Inventory backup ceiling");
    if (entry.retention.signedBy.trim() !== "Don" || entry.retention.ceilingDays !== node.retention.ceilingDays || entry.backupExpiryDays !== node.backup.ceilingDays) throw new ProviderRuleError("Inventory ceilings must match signed register");
    required(entry.deletionCapability, "Deletion capability"); required(entry.propagationRule, "Propagation rule");
    if (entry.restorationBehavior !== "SEALED_PENDING_RECONCILIATION") throw new ProviderRuleError("Restore must begin sealed");
    nonnegativeDays(entry.actualGuarantees.retentionDays, "Actual retention"); nonnegativeDays(entry.actualGuarantees.backupExpiryDays, "Actual backup expiry");
    if (!entry.actualGuarantees.deletionSupported || entry.actualGuarantees.retentionDays > node.retention.ceilingDays || entry.actualGuarantees.backupExpiryDays > node.backup.ceilingDays) throw new ProviderRuleError("Provider guarantees exceed register ceilings");
    if (entry.providerIdentity !== node.providerIdentity || JSON.stringify(entry.approval) !== JSON.stringify(node.approval)) throw new ProviderRuleError("Provider identity and approval evidence must exactly match register");
    if (entry.purpose !== node.purpose || (node.processingBasisApplicable && entry.processingBasis !== node.processingBasis) || entry.accessOwner !== node.accessOwner || entry.deletionCapability !== node.deletionCapability || entry.propagationRule !== node.propagationRule || entry.restorationBehavior !== node.restorationBehavior) throw new ProviderRuleError("Provider operating terms must exactly match register");
    return Object.freeze({ ...entry, fields, retention: Object.freeze({ ...entry.retention }), actualGuarantees: Object.freeze({ ...entry.actualGuarantees }), approval: Object.freeze({ ...entry.approval }) });
  });
  const blockers = Object.freeze(nodes.filter(({ usage }) => usage === "UNRESOLVED").map((node) => Object.freeze({ entryId: node.entryId, category: node.category, blocker: node.blocker })));
  return Object.freeze({
    dataFlowRegister: Object.freeze({ ...input.dataFlowRegister, nodes: Object.freeze(nodes) }),
    providerInventoryVersionId: input.providerInventoryVersionId,
    entries: Object.freeze(entries),
    blockers,
    deploymentDecision: () => blockers.length > 0
      ? Object.freeze({ deployment: "BLOCKED" as const, processing: "BLOCKED" as const, status: "BLOCKED_PENDING_DON_PROVIDER_SCHEDULE" as const })
      : Object.freeze({ deployment: "ALLOWED" as const, processing: "ALLOWED" as const, status: "VALIDATED_TEST_FIXTURE" as const }),
  });
};

export interface RestoreActor { readonly operatorId: string; readonly operatorName: string; readonly role: "RESTORE_OPERATOR" | "RESTORE_VERIFIER" }
export interface ReplayEffects { readonly withdrawnCopyIds: readonly string[]; readonly nonconsentingCopyIds: readonly string[]; readonly deletedCopyIds: readonly string[]; readonly revokedCopyIds: readonly string[] }
export interface ReplayEvidence {
  readonly restoreId: string; readonly ledger: RestoreLedger; readonly evidenceId: string; readonly evidenceHash: string;
  readonly watermark: string; readonly outcome: "PASSED"; readonly effects: ReplayEffects; readonly operator: RestoreActor; readonly replayedAt: string;
}
export interface RestrictedVaultRestorePort {
  beginSealed(input: { readonly restoreId: string; readonly copyIds: readonly string[] }): void;
  applyLedger(input: { readonly restoreId: string; readonly ledger: RestoreLedger; readonly watermark: string; readonly evidenceId: string; readonly effects: ReplayEffects }): void;
  release(input: { readonly restoreId: string; readonly includedCopyIds: readonly string[] }): void;
}
interface RestoreState { readonly restoreId: string; readonly initiatorId: string; readonly copyIds: readonly string[]; readonly startedAt: string; readonly evidence: Map<RestoreLedger, ReplayEvidence>; reconciliation: "PENDING" | "PASSED"; reconciledAt?: string; reachability: "SEALED" | "RELEASED"; includedCopyIds: readonly string[] }
const ORDER: readonly RestoreLedger[] = ["WITHDRAWAL", "CONSENT", "DELETION", "REVOCATION"];
const instant = (value: string) => { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new ProviderRuleError("Invalid time", "INVALID_TIME"); return new Date(parsed).toISOString(); };

export class RestoreCoordinator {
  readonly #vault: RestrictedVaultRestorePort; readonly #watermarks: Record<RestoreLedger, string>;
  readonly #primary: RestoreActor; readonly #backup: RestoreActor; readonly #verifier: RestoreActor; readonly #states = new Map<string, RestoreState>(); readonly #audits: object[] = [];
  public constructor(input: { readonly vault: RestrictedVaultRestorePort; readonly currentWatermarks: Record<RestoreLedger, string>; readonly primaryOperator: RestoreActor; readonly backupOperator: RestoreActor; readonly configuredVerifier: RestoreActor }) {
    this.#validateRestoreOperator(input.primaryOperator); this.#validateRestoreOperator(input.backupOperator);
    if (input.primaryOperator.operatorId === input.backupOperator.operatorId || input.primaryOperator.operatorName === input.backupOperator.operatorName) throw new ProviderRuleError("Primary and backup operators must be distinct");
    this.#validateVerifier(input.configuredVerifier);
    if ([input.primaryOperator, input.backupOperator].some(({ operatorId, operatorName }) => operatorId === input.configuredVerifier.operatorId || operatorName === input.configuredVerifier.operatorName)) throw new ProviderRuleError("Verifier must be distinct from restore operators");
    this.#vault = input.vault; this.#watermarks = Object.freeze({ ...input.currentWatermarks }); this.#primary = Object.freeze({ ...input.primaryOperator }); this.#backup = Object.freeze({ ...input.backupOperator }); this.#verifier = Object.freeze({ ...input.configuredVerifier });
  }
  public begin(input: { readonly restoreId: string; readonly operator: RestoreActor; readonly copyIds: readonly string[]; readonly startedAt: string }): void {
    try {
      const occurredAt = instant(input.startedAt); const id = required(input.restoreId, "Restore ID"); this.#configured(input.operator);
      if (this.#states.has(id)) throw new ProviderRuleError("Restore already exists");
      const copyIds = Object.freeze(input.copyIds.map((copyId) => required(copyId, "Copy ID")));
      if (new Set(copyIds).size !== copyIds.length) throw new ProviderRuleError("Copy IDs must be unique");
      this.#vault.beginSealed({ restoreId: id, copyIds });
      this.#states.set(id, { restoreId: id, initiatorId: input.operator.operatorId, copyIds, startedAt: occurredAt, evidence: new Map(), reconciliation: "PENDING", reachability: "SEALED", includedCopyIds: Object.freeze([]) });
      this.#audit("BEGIN", "ALLOWED", input.operator, id, occurredAt);
    } catch (error) { this.#audit("BEGIN", "DENIED", input.operator, input.restoreId, input.startedAt, undefined, this.#reason(error)); throw error; }
  }
  public recordReplay(input: ReplayEvidence): void {
    try {
      const occurredAt = instant(input.replayedAt); const state = this.#state(input.restoreId); this.#configured(input.operator);
      required(input.evidenceId, "Evidence ID"); required(input.evidenceHash, "Evidence hash");
      if (Date.parse(occurredAt) < Date.parse(state.startedAt)) throw new ProviderRuleError("Replay cannot precede restore begin", "INVALID_CHRONOLOGY");
      if (input.outcome !== "PASSED") throw new ProviderRuleError("Replay must pass");
      if (input.watermark !== this.#watermarks[input.ledger]) throw new ProviderRuleError("Replay watermark is stale");
      if (state.evidence.has(input.ledger)) throw new ProviderRuleError("Ledger evidence must be unique", "DUPLICATE_LEDGER");
      const frozen = Object.freeze({ ...input, operator: Object.freeze({ ...input.operator }), effects: Object.freeze({ withdrawnCopyIds: Object.freeze([...input.effects.withdrawnCopyIds]), nonconsentingCopyIds: Object.freeze([...input.effects.nonconsentingCopyIds]), deletedCopyIds: Object.freeze([...input.effects.deletedCopyIds]), revokedCopyIds: Object.freeze([...input.effects.revokedCopyIds]) }) });
      state.evidence.set(input.ledger, frozen); this.#audit("REPLAY", "ALLOWED", input.operator, input.restoreId, occurredAt, input.ledger);
    } catch (error) { this.#audit("REPLAY", "DENIED", input.operator, input.restoreId, input.replayedAt, input.ledger, this.#reason(error)); throw error; }
  }
  public replayEvidence(restoreId: string): readonly ReplayEvidence[] { return Object.freeze([...this.#state(restoreId).evidence.values()]); }
  public reconcile(input: { readonly restoreId: string; readonly operator: RestoreActor; readonly passed: boolean; readonly reconciledAt: string }): void {
    try {
      const occurredAt = instant(input.reconciledAt); const state = this.#state(input.restoreId); this.#configured(input.operator);
      if (state.reconciliation !== "PENDING") throw new ProviderRuleError("Restore was already reconciled", "DUPLICATE_RECONCILIATION");
      if (!input.passed || ORDER.some((ledger) => !state.evidence.has(ledger))) throw new ProviderRuleError("All current ledgers must pass reconciliation");
      if ([...state.evidence.values()].some(({ replayedAt }) => Date.parse(occurredAt) < Date.parse(replayedAt))) throw new ProviderRuleError("Reconciliation cannot precede replay", "INVALID_CHRONOLOGY");
      const excluded = new Set<string>();
      for (const ledger of ORDER) {
        const evidence = state.evidence.get(ledger)!;
        this.#vault.applyLedger({ restoreId: state.restoreId, ledger, watermark: evidence.watermark, evidenceId: evidence.evidenceId, effects: evidence.effects });
        for (const values of Object.values(evidence.effects)) for (const copyId of values) excluded.add(copyId);
      }
      state.includedCopyIds = Object.freeze(state.copyIds.filter((id) => !excluded.has(id))); state.reconciliation = "PASSED"; state.reconciledAt = occurredAt; this.#audit("RECONCILE", "ALLOWED", input.operator, input.restoreId, occurredAt);
    } catch (error) { this.#audit("RECONCILE", "DENIED", input.operator, input.restoreId, input.reconciledAt, undefined, this.#reason(error)); throw error; }
  }
  public release(input: { readonly restoreId: string; readonly verifier: RestoreActor; readonly releasedAt: string }): void {
    try {
      const occurredAt = instant(input.releasedAt); const state = this.#state(input.restoreId); this.#configuredVerifier(input.verifier);
      if (state.reachability === "RELEASED") throw new ProviderRuleError("Restore was already released", "DUPLICATE_RELEASE");
      if (state.reconciliation !== "PASSED" || state.reconciledAt === undefined) throw new ProviderRuleError("Passed reconciliation is required");
      if (Date.parse(occurredAt) < Date.parse(state.reconciledAt)) throw new ProviderRuleError("Release cannot precede reconciliation", "INVALID_CHRONOLOGY");
      this.#vault.release({ restoreId: state.restoreId, includedCopyIds: state.includedCopyIds }); state.reachability = "RELEASED"; this.#audit("RELEASE", "ALLOWED", input.verifier, input.restoreId, occurredAt);
    } catch (error) { this.#audit("RELEASE", "DENIED", input.verifier, input.restoreId, input.releasedAt, undefined, this.#reason(error)); throw error; }
  }
  public safeStatus(restoreId: string) { const state = this.#state(restoreId); return Object.freeze({ restoreId, reachability: state.reachability, reconciliation: state.reconciliation, deletedDataClaim: "NEVER_RESTORED" as const }); }
  public auditRecords(): readonly object[] { return Object.freeze([...this.#audits]); }
  #state(id: string) { const state = this.#states.get(id); if (!state) throw new ProviderRuleError("Restore was not found"); return state; }
  #validateRestoreOperator(actor: RestoreActor) { required(actor.operatorId, "Operator ID"); required(actor.operatorName, "Operator name"); if (actor.role !== "RESTORE_OPERATOR") throw new ProviderRuleError("Restore operator role required"); }
  #validateVerifier(actor: RestoreActor) { required(actor.operatorId, "Verifier ID"); required(actor.operatorName, "Verifier name"); if (actor.role !== "RESTORE_VERIFIER") throw new ProviderRuleError("Restore verifier role required"); }
  #configured(actor: RestoreActor) {
    this.#validateRestoreOperator(actor);
    const configured = actor.operatorId === this.#primary.operatorId ? this.#primary : actor.operatorId === this.#backup.operatorId ? this.#backup : undefined;
    if (configured === undefined || configured.operatorName !== actor.operatorName) throw new ProviderRuleError("Restore operator identity mismatch", "OPERATOR_IDENTITY_MISMATCH");
  }
  #configuredVerifier(actor: RestoreActor) {
    if (actor.operatorId !== this.#verifier.operatorId || actor.operatorName !== this.#verifier.operatorName || actor.role !== "RESTORE_VERIFIER") throw new ProviderRuleError("Restore verifier identity mismatch", "OPERATOR_IDENTITY_MISMATCH");
  }
  #reason(error: unknown) { return error instanceof ProviderRuleError ? error.code : "UNEXPECTED_DENIAL"; }
  #audit(action: string, outcome: string, actor: RestoreActor, restoreId: string, occurredAt: string, ledger?: RestoreLedger, reasonCode?: string) {
    const normalizedTime = Number.isFinite(Date.parse(occurredAt)) ? new Date(Date.parse(occurredAt)).toISOString() : "INVALID";
    const actorName = reasonCode === "OPERATOR_IDENTITY_MISMATCH" ? "UNVERIFIED" : actor.operatorName.trim() || "UNNAMED";
    this.#audits.push(Object.freeze({ sequence: this.#audits.length + 1, action, outcome, actorName, restoreId, occurredAt: normalizedTime, ...(ledger === undefined ? {} : { ledger }), ...(reasonCode === undefined ? {} : { reasonCode }) }));
  }
}
