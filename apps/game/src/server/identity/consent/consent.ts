export class ConsentRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConsentRuleError";
  }
}

export interface AdultEligibilityPolicyInput {
  readonly versionId: string;
  readonly approvedBy: string;
  readonly signatureId: string;
  readonly signedAt: string;
  readonly effectiveFrom: string;
  readonly adultOnly: true;
  readonly permittedJurisdictions: readonly string[];
  readonly externalDeveloperCriteria: string;
  readonly requiresExternalDeveloper: boolean;
  readonly permittedProjectRelationships: readonly string[];
  readonly disqualifyingConflicts: readonly string[];
  readonly consentTerms: string;
  readonly withdrawalTerms: string;
  readonly operationalTesterTreatment: string;
}

export interface AdultEligibilityPolicy extends AdultEligibilityPolicyInput {
  readonly adultOnly: true;
}

const requireText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) throw new ConsentRuleError(`${label} is required`);
  return normalized;
};

const requireInstant = (value: string, label: string): string => {
  const normalized = requireText(value, label);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw new ConsentRuleError(`${label} must be a valid instant`);
  }
  return normalized;
};

const requireList = (values: readonly string[], label: string): readonly string[] => {
  if (values.length === 0) throw new ConsentRuleError(`${label} are required`);
  return Object.freeze(values.map((value) => requireText(value, label)));
};

export const createAdultEligibilityPolicy = (
  input: AdultEligibilityPolicyInput,
): AdultEligibilityPolicy => {
  if (input.approvedBy.trim() !== "Don") {
    throw new ConsentRuleError("Policy requires Don approval");
  }
  if (input.adultOnly !== true) throw new ConsentRuleError("Policy must be adult-only");
  if (input.withdrawalTerms.trim().length === 0) {
    throw new ConsentRuleError("Withdrawal terms are required");
  }

  return Object.freeze({
    versionId: requireText(input.versionId, "Policy version ID"),
    approvedBy: "Don",
    signatureId: requireText(input.signatureId, "Policy signature ID"),
    signedAt: requireInstant(input.signedAt, "Policy signature time"),
    effectiveFrom: requireInstant(input.effectiveFrom, "Policy effective time"),
    adultOnly: true,
    permittedJurisdictions: requireList(input.permittedJurisdictions, "Permitted jurisdictions"),
    externalDeveloperCriteria: requireText(
      input.externalDeveloperCriteria,
      "External developer criteria",
    ),
    requiresExternalDeveloper: input.requiresExternalDeveloper,
    permittedProjectRelationships: requireList(
      input.permittedProjectRelationships,
      "Permitted project relationships",
    ),
    disqualifyingConflicts: requireList(input.disqualifyingConflicts, "Disqualifying conflicts"),
    consentTerms: requireText(input.consentTerms, "Consent terms"),
    withdrawalTerms: input.withdrawalTerms.trim(),
    operationalTesterTreatment: requireText(
      input.operationalTesterTreatment,
      "Operational tester treatment",
    ),
  });
};

export type InvitationPolicyDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | "POLICY_ABSENT"
        | "POLICY_UNKNOWN"
        | "POLICY_NOT_EFFECTIVE"
        | "POLICY_INAPPLICABLE";
    };

export interface InvitationPolicyContext {
  readonly policyVersionId: string | undefined;
  readonly evaluatedAt?: string;
  readonly jurisdiction?: string;
  readonly externalDeveloper?: boolean;
  readonly projectRelationship?: string;
  readonly conflicts?: readonly string[];
  readonly operationalTester?: boolean;
}

export class ConsentPolicyRegistry {
  readonly #policies = new Map<string, AdultEligibilityPolicy>();

  public register(policy: AdultEligibilityPolicy): void {
    const verified = createAdultEligibilityPolicy(policy);
    if (this.#policies.has(verified.versionId)) {
      throw new ConsentRuleError(`Policy version ${verified.versionId} is already registered`);
    }
    this.#policies.set(verified.versionId, verified);
  }

  public invitationDecision(context: InvitationPolicyContext): InvitationPolicyDecision {
    if (context.policyVersionId === undefined || context.policyVersionId.trim().length === 0) {
      return Object.freeze({ allowed: false, reason: "POLICY_ABSENT" });
    }
    const policy = this.#policies.get(context.policyVersionId);
    if (policy === undefined) {
      return Object.freeze({ allowed: false, reason: "POLICY_UNKNOWN" });
    }
    const evaluatedAt = context.evaluatedAt === undefined ? Number.NaN : Date.parse(context.evaluatedAt);
    if (!Number.isFinite(evaluatedAt)) {
      return Object.freeze({ allowed: false, reason: "POLICY_INAPPLICABLE" });
    }
    if (evaluatedAt < Date.parse(policy.effectiveFrom) || evaluatedAt < Date.parse(policy.signedAt)) {
      return Object.freeze({ allowed: false, reason: "POLICY_NOT_EFFECTIVE" });
    }
    if (
      context.jurisdiction === undefined ||
      !policy.permittedJurisdictions.includes(context.jurisdiction) ||
      context.projectRelationship === undefined ||
      !policy.permittedProjectRelationships.includes(context.projectRelationship) ||
      context.conflicts === undefined ||
      context.conflicts.some((conflict) => policy.disqualifyingConflicts.includes(conflict)) ||
      context.operationalTester !== false ||
      (policy.requiresExternalDeveloper && context.externalDeveloper !== true)
    ) {
      return Object.freeze({ allowed: false, reason: "POLICY_INAPPLICABLE" });
    }
    return Object.freeze({ allowed: true });
  }
}

export type AnalysisState = "PENDING" | "INCLUDED" | "EXCLUDED";
export type ExclusionReason =
  | "AUTHENTICATED_WITHDRAWAL"
  | "INVALID_ELIGIBILITY"
  | "OPERATIONAL_TESTER"
  | "DUPLICATE_LINEAGE"
  | "SIGNED_INTEGRITY_EXCLUSION";

interface EventBase {
  readonly occurredAt: string;
}

interface ExclusionEvidence {
  readonly approver: string;
  readonly formulaTreatment: string;
}

export type ParticipantEventInput =
  | (EventBase & { readonly recordType: "INVITATION_RECORDED" })
  | (EventBase & {
      readonly recordType: "CONSENT_RECORDED";
      readonly policyVersionId: string;
      readonly valid: boolean;
    })
  | (EventBase & {
      readonly recordType: "ELIGIBILITY_RECORDED";
      readonly policyVersionId: string;
      readonly valid: true;
    })
  | (EventBase & ExclusionEvidence & {
      readonly recordType: "ELIGIBILITY_RECORDED";
      readonly policyVersionId: string;
      readonly valid: false;
    })
  | (EventBase & {
      readonly recordType: "TESTER_CLASSIFIED";
      readonly operationalTester: false;
    })
  | (EventBase & ExclusionEvidence & {
      readonly recordType: "TESTER_CLASSIFIED";
      readonly operationalTester: true;
    })
  | (EventBase & {
      readonly recordType:
        | "ENROLLMENT_RECORDED"
        | "SESSION_STARTED"
        | "ACTIVATED"
        | "ROUND_COMPLETED"
        | "SESSION_COMPLETED"
        | "DISTINCT_DAY_RETURNED"
        | "SURVEY_RESPONDED";
    })
  | (EventBase & {
      readonly recordType: "CREDENTIAL_STATUS_RECORDED";
      readonly status: string;
    })
  | (EventBase & {
      readonly recordType: "ROUND_CORRECTION_RECORDED";
      readonly status: "VOID" | "CONTENT_WITHDRAWN";
    })
  | (EventBase & ExclusionEvidence & {
      readonly recordType: "WITHDRAWAL_RECORDED";
      readonly authenticationReference: string;
    })
  | (EventBase & ExclusionEvidence & {
      readonly recordType: "DUPLICATE_LINEAGE_RECORDED";
      readonly duplicateOfLineageId: string;
      readonly evidenceReference: string;
    })
  | (EventBase & ExclusionEvidence & {
      readonly recordType: "SIGNED_INTEGRITY_EXCLUSION";
      readonly signer: string;
      readonly signatureId: string;
    });

type AnalysisRecord =
  | { readonly recordType: "ANALYSIS_STATE_RECORDED"; readonly state: "PENDING" }
  | {
      readonly recordType: "ANALYSIS_STATE_RECORDED";
      readonly state: "INCLUDED";
      readonly occurredAt: string;
    }
  | {
      readonly recordType: "ANALYSIS_STATE_RECORDED";
      readonly state: "EXCLUDED";
      readonly reason: ExclusionReason;
      readonly effectiveAt: string;
      readonly approver: string;
      readonly formulaTreatment: string;
    };

export type ParticipantFact = ParticipantEventInput | AnalysisRecord;

const exclusionReason = (event: ParticipantEventInput): ExclusionReason | undefined => {
  if (event.recordType === "ELIGIBILITY_RECORDED" && !event.valid) return "INVALID_ELIGIBILITY";
  if (event.recordType === "TESTER_CLASSIFIED" && event.operationalTester) {
    return "OPERATIONAL_TESTER";
  }
  if (event.recordType === "WITHDRAWAL_RECORDED") return "AUTHENTICATED_WITHDRAWAL";
  if (event.recordType === "DUPLICATE_LINEAGE_RECORDED") return "DUPLICATE_LINEAGE";
  if (event.recordType === "SIGNED_INTEGRITY_EXCLUSION") return "SIGNED_INTEGRITY_EXCLUSION";
  return undefined;
};

const exclusionEvidence = (
  event: ParticipantEventInput,
): ExclusionEvidence | undefined =>
  "approver" in event && "formulaTreatment" in event
    ? { approver: event.approver, formulaTreatment: event.formulaTreatment }
    : undefined;

export class ParticipantStateLedger {
  readonly #participantLineageId: string;
  readonly #facts: readonly ParticipantFact[];

  private constructor(participantLineageId: string, facts: readonly ParticipantFact[]) {
    this.#participantLineageId = participantLineageId;
    this.#facts = Object.freeze(facts.map((fact) => Object.freeze({ ...fact })));
    Object.freeze(this);
  }

  public static create(participantLineageId: string): ParticipantStateLedger {
    return new ParticipantStateLedger(requireText(participantLineageId, "Participant lineage ID"), [
      { recordType: "ANALYSIS_STATE_RECORDED", state: "PENDING" },
    ]);
  }

  public record(event: ParticipantEventInput): ParticipantStateLedger {
    this.#validateEvent(event);
    if (event.recordType === "ACTIVATED" && !this.#isActivationEligible()) {
      throw new ConsentRuleError(
        "Activation requires invitation, enrollment, and matching policy-bound consent and eligibility",
      );
    }

    const facts: ParticipantFact[] = [...this.#facts, Object.freeze({ ...event })];
    const reason = exclusionReason(event);
    if (reason !== undefined && this.analysisState() !== "EXCLUDED") {
      const evidence = exclusionEvidence(event);
      if (evidence === undefined) throw new ConsentRuleError("Exclusion evidence is required");
      facts.push(
        Object.freeze({
          recordType: "ANALYSIS_STATE_RECORDED",
          state: "EXCLUDED",
          reason,
          effectiveAt: event.occurredAt,
          approver: evidence.approver,
          formulaTreatment: evidence.formulaTreatment,
        }),
      );
    } else if (this.analysisState() === "PENDING" && this.#isAnalysisEligible(facts)) {
      facts.push(
        Object.freeze({
          recordType: "ANALYSIS_STATE_RECORDED",
          state: "INCLUDED",
          occurredAt: event.occurredAt,
        }),
      );
    }
    return new ParticipantStateLedger(this.#participantLineageId, facts);
  }

  public facts(): readonly ParticipantFact[] {
    return this.#facts;
  }

  public analysisState(): AnalysisState {
    return this.analysisRecord().state;
  }

  public analysisRecord(): AnalysisRecord {
    for (let index = this.#facts.length - 1; index >= 0; index -= 1) {
      const fact = this.#facts[index];
      if (fact?.recordType === "ANALYSIS_STATE_RECORDED") return fact;
    }
    throw new ConsentRuleError("Analysis state is missing");
  }

  #validateEvent(event: ParticipantEventInput): void {
    requireInstant(event.occurredAt, "Event time");
    if ("policyVersionId" in event) requireText(event.policyVersionId, "Policy version ID");
    if ("status" in event) requireText(event.status, "Status");
    if ("approver" in event) {
      requireText(event.approver, "Exclusion approver");
      requireText(event.formulaTreatment, "Formula treatment");
    }
    if (event.recordType === "WITHDRAWAL_RECORDED") {
      requireText(event.authenticationReference, "Withdrawal authentication reference");
    }
    if (event.recordType === "DUPLICATE_LINEAGE_RECORDED") {
      requireText(event.duplicateOfLineageId, "Original lineage ID");
      requireText(event.evidenceReference, "Duplicate evidence reference");
    }
    if (event.recordType === "SIGNED_INTEGRITY_EXCLUSION") {
      requireText(event.signer, "Integrity exclusion signer");
      requireText(event.signatureId, "Integrity exclusion signature ID");
    }
  }

  #isActivationEligible(): boolean {
    let consentPolicyVersion: string | undefined;
    let eligibilityPolicyVersion: string | undefined;
    for (let index = this.#facts.length - 1; index >= 0; index -= 1) {
      const fact = this.#facts[index];
      if (
        consentPolicyVersion === undefined &&
        fact?.recordType === "CONSENT_RECORDED" &&
        fact.valid
      ) {
        consentPolicyVersion = fact.policyVersionId;
      }
      if (
        eligibilityPolicyVersion === undefined &&
        fact?.recordType === "ELIGIBILITY_RECORDED" &&
        fact.valid
      ) {
        eligibilityPolicyVersion = fact.policyVersionId;
      }
      if (consentPolicyVersion !== undefined && eligibilityPolicyVersion !== undefined) break;
    }
    return (
      this.#facts.some((fact) => fact.recordType === "INVITATION_RECORDED") &&
      this.#facts.some((fact) => fact.recordType === "ENROLLMENT_RECORDED") &&
      consentPolicyVersion !== undefined &&
      consentPolicyVersion === eligibilityPolicyVersion
    );
  }

  #isAnalysisEligible(facts: readonly ParticipantFact[]): boolean {
    return (
      facts.some((fact) => fact.recordType === "CONSENT_RECORDED" && fact.valid) &&
      facts.some((fact) => fact.recordType === "ELIGIBILITY_RECORDED" && fact.valid) &&
      facts.some(
        (fact) => fact.recordType === "TESTER_CLASSIFIED" && !fact.operationalTester,
      ) &&
      facts.some((fact) => fact.recordType === "SESSION_STARTED")
    );
  }
}
